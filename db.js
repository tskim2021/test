import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const kstStart = (d) => new Date(`${d}T00:00:00+09:00`).toISOString();
export const kstEnd = (d) => new Date(`${d}T23:59:59.999+09:00`).toISOString();

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
  const hideStmt = db.prepare('UPDATE deposits SET hidden = 1 WHERE id = ? AND hidden = 0');
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      deposit_id INTEGER PRIMARY KEY,
      od_id TEXT NOT NULL UNIQUE,
      confirmed_at TEXT NOT NULL
    )
  `);
  const byId = db.prepare('SELECT * FROM deposits WHERE dedupe_key = ?');
  const getOne = db.prepare('SELECT * FROM deposits WHERE id = ?');
  const claimStmt = db.prepare('INSERT OR IGNORE INTO matches (deposit_id, od_id, confirmed_at) VALUES (?,?,?)');
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
    hide(ids) {
      let n = 0;
      for (const id of ids) n += hideStmt.run(id).changes;
      return n;
    },
    // 입금 1건을 주문 1건에 연결한다. 이미 연결됐거나 그 주문이 다른 입금과 연결돼 있으면 false.
    claim: (depositId, odId) => claimStmt.run(depositId, String(odId), new Date().toISOString()).changes === 1,
    release: (depositId) => releaseStmt.run(depositId),
    matchedOrder: (depositId) => matchOf.get(depositId)?.od_id ?? null,
    // from/to: 'YYYY-MM-DD'(한국시간 기준, 양 끝 포함), q: 입금자 부분일치. 조건에 맞는 건수/합계도 함께 돌려준다.
    search({ from, to, q, limit = 20, offset = 0 } = {}) {
      const where = ['hidden = 0'];
      const args = [];
      if (from) { where.push('received_at >= ?'); args.push(kstStart(from)); }
      if (to) { where.push('received_at <= ?'); args.push(kstEnd(to)); }
      if (q) { where.push("sender LIKE ? ESCAPE '\\'"); args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const agg = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM deposits ${w}`).get(...args);
      const rows = db.prepare(`SELECT d.*, m.od_id AS order_id FROM deposits d LEFT JOIN matches m ON m.deposit_id = d.id ${w} ORDER BY received_at DESC, d.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
      return { rows, count: agg.count, total: agg.total };
    },
  };
}
