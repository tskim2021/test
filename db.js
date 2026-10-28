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
  const byId = db.prepare('SELECT * FROM deposits WHERE dedupe_key = ?');

  return {
    // 같은 알림이 같은 분에 중복 전송돼도 한 번만 저장한다. 새로 저장됐으면 row, 중복이면 null.
    add({ amount, sender, balance, raw }, at = new Date()) {
      const iso = at.toISOString();
      const key = createHash('sha1').update(`${raw}|${iso.slice(0, 16)}`).digest('hex');
      const r = insert.run(key, amount, sender, balance, raw, iso);
      return r.changes ? byId.get(key) : null;
    },
    // from/to: 'YYYY-MM-DD'(한국시간 기준, 양 끝 포함), q: 입금자 부분일치. 조건에 맞는 건수/합계도 함께 돌려준다.
    search({ from, to, q, limit = 20, offset = 0 } = {}) {
      const where = [];
      const args = [];
      if (from) { where.push('received_at >= ?'); args.push(kstStart(from)); }
      if (to) { where.push('received_at <= ?'); args.push(kstEnd(to)); }
      if (q) { where.push("sender LIKE ? ESCAPE '\\'"); args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const agg = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM deposits ${w}`).get(...args);
      const rows = db.prepare(`SELECT * FROM deposits ${w} ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
      return { rows, count: agg.count, total: agg.total };
    },
  };
}
