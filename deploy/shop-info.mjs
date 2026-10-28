// 읽기 전용: SHOP_DB_* 환경변수로 접속해 주문 건수와 최근 주문 시각을 JSON 한 줄로 출력한다.
import mysql from 'mysql2/promise';
const e = process.env, P = e.SHOP_TABLE_PREFIX || 'g5_';
if (!/^[A-Za-z0-9_]*$/.test(P)) { console.log(JSON.stringify({ error: 'bad prefix' })); process.exit(0); }
try {
  const c = await mysql.createConnection({
    ...(e.SHOP_DB_SOCKET ? { socketPath: e.SHOP_DB_SOCKET } : { host: e.SHOP_DB_HOST, port: Number(e.SHOP_DB_PORT || 3306) }),
    user: e.SHOP_DB_USER, password: e.SHOP_DB_PASSWORD, database: e.SHOP_DB_NAME, charset: 'utf8mb4', connectTimeout: 5000,
  });
  const [[r]] = await c.query(`SELECT COUNT(*) AS n, MAX(od_time) AS latest FROM ${P}shop_order`);
  const [[u]] = await c.query(`SELECT COUNT(*) AS n FROM ${P}shop_order WHERE od_status = '주문'`);
  const latest = r.latest instanceof Date ? r.latest.toISOString().slice(0, 19).replace('T', ' ') : String(r.latest ?? '없음');
  console.log(JSON.stringify({ orders: Number(r.n), pending: Number(u.n), latest }));
  await c.end();
} catch (err) {
  console.log(JSON.stringify({ error: err.code || err.message }));
}
