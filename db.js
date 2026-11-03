import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const kstStart = (d) => new Date(`${d}T00:00:00+09:00`).toISOString();
export const kstEnd = (d) => new Date(`${d}T23:59:59.999+09:00`).toISOString();

const BASE = 'SELECT d.*, m.od_id AS order_id, m.manual AS order_manual, m.confirmed_at AS processed_at FROM deposits d LEFT JOIN matches m ON m.deposit_id = d.id';

// done: 'hide'=처리된 입금 숨김, 'only'=처리된 입금만, 'all'=전부(기본)
const doneCond = (done) => (done === 'hide' ? 'm.od_id IS NULL' : done === 'only' ? 'm.od_id IS NOT NULL' : null);

// 문자 본문의 거래 시각(월/일 시:분)·입금액·입금자. 없으면 null(카카오뱅크 앱 알림 등은 기존 방식).
export function smsKey(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ');
  const w = t.match(/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/);
  const a = t.match(/입금 ?([\d,]+) ?원/);
  if (!w || !a) return null;
  // 입금자: 카카오뱅크는 시각 뒤 '입금 N원' 다음, 농협은 계좌번호(352-****-6720-13) 다음
  const nh = t.match(/ \d+-\*+-[\d-]+ (.+?)(?: 잔액 ?[\d,]+ ?원|$)/);
  const kb = t.slice(w.index).match(/입금 ?[\d,]+ ?원 ?([^\s]*)/);
  const name = nh ? nh[1] : kb && !/^잔액/.test(kb[1]) ? kb[1] : '';
  return `${+w[1]}/${+w[2]} ${+w[3]}:${w[4]}|${a[1].replace(/,/g, '')}|${name}`;
}

export function openDb(path = process.env.DB_PATH || './deposits.db') {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      sender TEXT,
      balance INTEGER,
      raw TEXT,
      received_at TEXT NOT NULL
    )
  `);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO deposits (dedupe_key, amount, sender, balance, raw, received_at) VALUES (?,?,?,?,?,?)'
  );
  // 소프트 삭제: hidden=1 이면 목록/합계에서 빠지지만 DB에는 남는다(중복 방지 키도 유지).
  if (!db.prepare('PRAGMA table_info(deposits)').all().some((c) => c.name === 'hidden')) {
    db.exec('ALTER TABLE deposits ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
  }
  if (!db.prepare('PRAGMA table_info(deposits)').all().some((c) => c.name === 'memo')) {
    db.exec("ALTER TABLE deposits ADD COLUMN memo TEXT NOT NULL DEFAULT ''");
  }
  const hideStmt = db.prepare('UPDATE deposits SET hidden = 1 WHERE id = ? AND hidden = 0');
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      deposit_id INTEGER PRIMARY KEY,
      od_id TEXT NOT NULL UNIQUE,
      confirmed_at TEXT NOT NULL
    )
  `);
  if (!db.prepare('PRAGMA table_info(matches)').all().some((c) => c.name === 'manual')) {
    db.exec('ALTER TABLE matches ADD COLUMN manual INTEGER NOT NULL DEFAULT 0');
  }
  // 푸시 발송 기록: 보낸 시점에 앱(푸시 서비스)/웹 화면이 몇 개 연결돼 있었는지 남긴다.
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      event TEXT NOT NULL,
      deposit_id INTEGER,
      label TEXT NOT NULL DEFAULT '',
      apps INTEGER NOT NULL,
      webs INTEGER NOT NULL
    )
  `);
  // iPhone 푸시(APNs) 기기 토큰
  db.exec('CREATE TABLE IF NOT EXISTS apns_tokens (token TEXT PRIMARY KEY, sandbox INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL)');
  const apnsSet = db.prepare('INSERT INTO apns_tokens (token, sandbox, at) VALUES (?,?,?) ON CONFLICT(token) DO UPDATE SET sandbox = excluded.sandbox, at = excluded.at');
  const pushLogIns = db.prepare('INSERT INTO push_log (at, event, deposit_id, label, apps, webs) VALUES (?,?,?,?,?,?)');
  // 처리 종류(matches.manual): 0=자동(시스템이 이름·금액 일치로 자동 처리) 1=수동(사유 입력) 2=기처리 연결 3=일치처리(관리자가 일치 건을 확인 후 처리)
  // 자동 처리 기능이 생기기 전의 0 은 모두 관리자가 버튼으로 처리한 것이므로 한 번만 3 으로 옮긴다.
  if (db.prepare('PRAGMA user_version').get().user_version < 1) {
    db.exec('UPDATE matches SET manual = 3 WHERE manual = 0');
    db.exec('PRAGMA user_version = 1');
  }
  db.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  const metaGet = db.prepare('SELECT v FROM meta WHERE k = ?');
  const metaSet = db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
  const memoStmt = db.prepare('UPDATE deposits SET memo = ? WHERE id = ?');
  const byId = db.prepare('SELECT * FROM deposits WHERE dedupe_key = ?');
  const getOne = db.prepare('SELECT * FROM deposits WHERE id = ?');
  const claimStmt = db.prepare('INSERT OR IGNORE INTO matches (deposit_id, od_id, confirmed_at, manual) VALUES (?,?,?,?)');
  const releaseStmt = db.prepare('DELETE FROM matches WHERE deposit_id = ?');
  const matchOf = db.prepare('SELECT od_id FROM matches WHERE deposit_id = ?');

  return {
    // 같은 알림이 같은 분에 중복 전송돼도 한 번만 저장한다. 새로 저장됐으면 row, 중복이면 null.
    add({ amount, sender, balance, raw }, at = new Date()) {
      const iso = at.toISOString();
      // 카카오뱅크 문자처럼 본문에 거래 시각이 있으면 '연도+시각+금액+입금자'로 한 건을 구분한다.
      // 같은 문자가 여러 경로(문자 직접 수신·문자 앱 알림·재전송)로 문구가 조금 다르게 와도 한 번만 저장돼 이중 처리가 생기지 않는다.
      const sk = smsKey(raw);
      const key = createHash('sha1').update(sk ? `sms|${iso.slice(0, 4)}|${sk}` : `${raw}|${iso.slice(0, 16)}`).digest('hex');
      const r = insert.run(key, amount, sender, balance, raw, iso);
      return r.changes ? byId.get(key) : null;
    },
    get: (id) => getOne.get(id),
    // 같은 입금자·금액의 다른 입금(숨김 포함)이 ms 안에 들어온 적이 있으면 그 행
    similarNear: (row, ms) => db.prepare(
      `SELECT id FROM deposits WHERE id <> ? AND amount = ? AND IFNULL(sender,'') = IFNULL(?, '')
         AND ABS(strftime('%s', received_at) - strftime('%s', ?)) * 1000 <= ? LIMIT 1`).get(row.id, row.amount, row.sender, row.received_at, ms) || null,
    getMeta: (k) => metaGet.get(k)?.v ?? null,
    setMeta: (k, v) => metaSet.run(k, String(v)),
    // 자동 처리 대상: 기준 시각 이후에 들어왔고 아직 처리되지 않은(숨김 제외) 입금, 오래된 것부터
    unprocessedSince: (iso, limit = 100) => db.prepare(`${BASE} WHERE d.hidden = 0 AND m.od_id IS NULL AND d.received_at >= ? ORDER BY d.id ASC LIMIT ?`).all(iso, limit),
    addApnsToken: (token, sandbox) => apnsSet.run(token, sandbox ? 1 : 0, new Date().toISOString()),
    apnsTokens: () => db.prepare('SELECT token, sandbox FROM apns_tokens').all(),
    removeApnsToken: (token) => db.prepare('DELETE FROM apns_tokens WHERE token = ?').run(token),
    logPush: ({ event, depositId = null, label = '', apps, webs }, at = new Date()) => pushLogIns.run(at.toISOString(), event, depositId, label, apps, webs),
    pushLog: (limit = 100) => db.prepare('SELECT * FROM push_log ORDER BY id DESC LIMIT ?').all(limit),
    // 앱 푸시 따라잡기용
    maxId: () => db.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM deposits').get().n,
    after: (id, limit = 50) => db.prepare(`${BASE} WHERE d.id > ? AND d.hidden = 0 ORDER BY d.id ASC LIMIT ?`).all(id, limit),
    processedSince: (iso, limit = 50) => db.prepare(
      `SELECT d.id, d.sender, d.amount, d.memo, m.od_id, m.manual, m.confirmed_at AS at
         FROM matches m JOIN deposits d ON d.id = m.deposit_id WHERE m.confirmed_at > ? ORDER BY m.confirmed_at ASC LIMIT ?`).all(iso, limit),
    hide(ids) {
      let n = 0;
      for (const id of ids) n += hideStmt.run(id).changes;
      return n;
    },
    // 입금 1건을 주문 1건에 연결한다. 이미 연결됐거나 그 주문이 다른 입금과 연결돼 있으면 false.
    // kind: 0=자동 1=수동 2=기처리 연결 3=일치처리(관리자 확인). true/false 도 받는다(수동/자동).
    claim: (depositId, odId, kind = 0) => claimStmt.run(depositId, String(odId), new Date().toISOString(), kind === true ? 1 : kind === false ? 0 : Number(kind)).changes === 1,
    setMemo: (id, memo) => memoStmt.run(String(memo), id).changes === 1,
    release: (depositId) => releaseStmt.run(depositId),
    matchedOrder: (depositId) => matchOf.get(depositId)?.od_id ?? null,
    // 주문번호 목록 중 입금 모니터가 자동 처리(manual=0)한 것
    autoProcessed(odIds) {
      if (!odIds.length) return new Set();
      return new Set(db.prepare('SELECT od_id FROM matches WHERE manual = 0 AND od_id IN (SELECT value FROM json_each(?))').all(JSON.stringify(odIds)).map((r) => r.od_id));
    },
    // 주문일자 검색용: 이름/금액/연결 주문번호 중 하나라도 걸리는 입금(숨김 제외)을 전부 돌려준다(페이지 처리는 호출 쪽에서).
    candidates({ q, names = [], ranges = [], odIds = [], done = 'all', limit = 5000 } = {}) {
      const where = ['d.hidden = 0'];
      const args = [];
      if (doneCond(done)) where.push(doneCond(done));
      // 인자는 SQL 의 ? 순서와 같아야 한다: q 조건이 먼저, 그 다음 json_each 세 개(이름 목록, 금액 범위 [[최소,최대]…], 주문번호 목록)
      if (q) { where.push("d.sender LIKE ? ESCAPE '\\'"); args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); }
      args.push(JSON.stringify(names), JSON.stringify(ranges), JSON.stringify(odIds));
      return db.prepare(`${BASE} WHERE ${where.join(' AND ')}
          AND ( REPLACE(d.sender, ' ', '') IN (SELECT value FROM json_each(?))
             OR EXISTS (SELECT 1 FROM json_each(?) j WHERE d.amount BETWEEN json_extract(j.value, '$[0]') AND json_extract(j.value, '$[1]'))
             OR m.od_id IN (SELECT value FROM json_each(?)) )
        ORDER BY d.received_at DESC, d.id DESC LIMIT ${Number(limit)}`).all(...args);
    },
    // 기간(입금 시각)에 해당하는 입금 전부(페이지 처리 없음)
    all({ from, to, q, done = 'all', limit = 5000 } = {}) {
      const where = ['d.hidden = 0'];
      const args = [];
      if (doneCond(done)) where.push(doneCond(done));
      if (from) { where.push('d.received_at >= ?'); args.push(kstStart(from)); }
      if (to) { where.push('d.received_at <= ?'); args.push(kstEnd(to)); }
      if (q) { where.push("d.sender LIKE ? ESCAPE '\\'"); args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); }
      return db.prepare(`${BASE} WHERE ${where.join(' AND ')} ORDER BY d.received_at DESC, d.id DESC LIMIT ${Number(limit)}`).all(...args);
    },
    // from/to: 'YYYY-MM-DD'(한국시간 기준, 양 끝 포함), q: 입금자 부분일치. 조건에 맞는 건수/합계도 함께 돌려준다.
    search({ from, to, q, done = 'all', limit = 20, offset = 0 } = {}) {
      const where = ['d.hidden = 0'];
      const args = [];
      if (doneCond(done)) where.push(doneCond(done));
      if (from) { where.push('d.received_at >= ?'); args.push(kstStart(from)); }
      if (to) { where.push('d.received_at <= ?'); args.push(kstEnd(to)); }
      if (q) { where.push("d.sender LIKE ? ESCAPE '\\'"); args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); }
      const w = `WHERE ${where.join(' AND ')}`;
      const agg = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(d.amount),0) AS total, COALESCE(SUM(CASE WHEN m.od_id IS NOT NULL AND m.manual = 0 THEN 1 ELSE 0 END),0) AS auto, COALESCE(SUM(CASE WHEN m.manual = 1 THEN 1 ELSE 0 END),0) AS manual, COALESCE(SUM(CASE WHEN m.manual = 2 THEN 1 ELSE 0 END),0) AS linked, COALESCE(SUM(CASE WHEN m.manual = 3 THEN 1 ELSE 0 END),0) AS matched FROM deposits d LEFT JOIN matches m ON m.deposit_id = d.id ${w}`).get(...args);
      const rows = db.prepare(`${BASE} ${w} ORDER BY d.received_at DESC, d.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
      return { rows, count: agg.count, total: agg.total, auto: agg.auto, manual: agg.manual, linked: agg.linked, matched: agg.matched };
    },
  };
}
