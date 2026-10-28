import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

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
  const recent = db.prepare('SELECT * FROM deposits ORDER BY id DESC LIMIT ?');
  const stats = db.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM deposits WHERE substr(received_at,1,10) = ?"
  );

  return {
    // 같은 알림이 같은 분에 중복 전송돼도 한 번만 저장한다. 새로 저장됐으면 row, 중복이면 null.
    add({ amount, sender, balance, raw }, at = new Date()) {
      const iso = at.toISOString();
      const key = createHash('sha1').update(`${raw}|${iso.slice(0, 16)}`).digest('hex');
      const r = insert.run(key, amount, sender, balance, raw, iso);
      return r.changes ? byId.get(key) : null;
    },
    recent: (n = 100) => recent.all(n),
    today: () => stats.get(new Date().toISOString().slice(0, 10)),
  };
}
