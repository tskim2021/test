import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const kstStart = (d) => new Date(`${d}T00:00:00+09:00`).toISOString();
export const kstEnd = (d) => new Date(`${d}T23:59:59.999+09:00`).toISOString();

const BASE = 'SELECT d.*, m.od_id AS order_id, m.manual AS order_manual FROM deposits d LEFT JOIN matches m ON m.deposit_id = d.id';

// done: 'hide'=처리된 입금 숨김, 'only'=처리된 입금만, 'all'=전부(기본)
const doneCond = (done) => (done === 'hide' ? 'm.od_id IS NULL' : done === 'only' ? 'm.od_id IS NOT NULL' : null);

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
  const pushLogIns = db.prepare('INSERT INTO push_log (at, event, deposit_id, label, apps, webs) VALUES (?,?,?,?,?,?)');
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
      const key = createHash('sha1').update(`${raw}|${iso.slice(0, 16)}`).digest('hex');
      const r = insert.run(key, amount, sender, balance, raw, iso);
      return r.changes ? byId.get(key) : null;
    },
    get: (id) => getOne.get(id),
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
    // kind: 0=자동(이름·금액 일치 처리) 1=수동(사유 입력 처리) 2=기처리 연결(쇼핑몰에서 이미 처리된 주문과 연결). true/false 도 받는다(수동/자동).
    claim: (depositId, odId, kind = 0) => claimStmt.run(depositId, String(odId), new Date().toISOString(), kind === true ? 1 : kind === false ? 0 : Number(kind)).changes === 1,
    setMemo: (id, memo) => memoStmt.run(String(memo), id).changes === 1,
    release: (depositId) => releaseStmt.run(depositId),
    matchedOrder: (depositId) => matchOf.get(depositId)?.od_id ?? null,
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
      const agg = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(d.amount),0) AS total, COALESCE(SUM(CASE WHEN m.manual = 1 THEN 1 ELSE 0 END),0) AS manual, COALESCE(SUM(CASE WHEN m.manual = 2 THEN 1 ELSE 0 END),0) AS linked FROM deposits d LEFT JOIN matches m ON m.deposit_id = d.id ${w}`).get(...args);
      const rows = db.prepare(`${BASE} ${w} ORDER BY d.received_at DESC, d.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
      return { rows, count: agg.count, total: agg.total, manual: agg.manual, linked: agg.linked };
    },
  };
}
