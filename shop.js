// 그누보드5 쇼핑몰 DB(g5_shop_order / g5_shop_cart) 연동.
// 접속 정보는 환경변수(SHOP_DB_HOST/PORT/USER/PASSWORD/NAME, SHOP_TABLE_PREFIX)로만 받는다.

const httpErr = (status, message) => Object.assign(new Error(message), { status });

export async function createShop(env = process.env) {
  if (!env.SHOP_DB_NAME) return null;
  const mysql = (await import('mysql2/promise')).default;
  const pool = mysql.createPool({
    ...(env.SHOP_DB_SOCKET
      ? { socketPath: env.SHOP_DB_SOCKET }
      : { host: env.SHOP_DB_HOST || '127.0.0.1', port: Number(env.SHOP_DB_PORT || 3306) }),
    user: env.SHOP_DB_USER,
    password: env.SHOP_DB_PASSWORD,
    database: env.SHOP_DB_NAME,
    charset: 'utf8mb4',
    connectionLimit: 3,
    waitForConnections: true,
  });
  return shopFromPool(pool, env.SHOP_TABLE_PREFIX ?? 'g5_');
}

export function shopFromPool(pool, prefix = 'g5_') {
  if (!/^[A-Za-z0-9_]*$/.test(prefix)) throw new Error('SHOP_TABLE_PREFIX 형식 오류');
  const O = `${prefix}shop_order`;
  const C = `${prefix}shop_cart`;
  const norm = (s) => String(s || '').replace(/\s+/g, '');

  return {
    close: () => pool.end(),
    // 연결 확인용: 주문 테이블 건수
    async ping() {
      const [[r]] = await pool.query(`SELECT COUNT(*) AS n FROM ${O}`);
      return Number(r.n);
    },
    // 주문번호 목록 -> { od_id: [{name, option, qty}] } (목록에 작게 보여줄 용도)
    async itemsByOrder(odIds) {
      const out = {};
      if (!odIds.length) return out;
      const [items] = await pool.query(
        `SELECT od_id, it_name, io_id, ct_qty FROM ${C} WHERE od_id IN (?) ORDER BY ct_id`, [odIds]);
      for (const i of items) (out[String(i.od_id)] ||= []).push({ name: i.it_name, option: i.io_id || '', qty: i.ct_qty });
      return out;
    },
    // 입금 목록 중 '주문' 상태 주문과 입금자명+금액이 일치하는 입금 id 집합(쿼리 1번).
    async matchedIds(list) {
      const amounts = [...new Set(list.map((d) => d.amount))];
      if (!amounts.length) return new Set();
      const [orders] = await pool.query(
        `SELECT od_misu, od_name, od_deposit_name FROM ${O} WHERE od_status = '주문' AND od_misu IN (?)`, [amounts]);
      const keys = new Set(orders.map((o) => `${Number(o.od_misu)}|${norm(o.od_deposit_name || o.od_name)}`));
      return new Set(list.filter((d) => keys.has(`${d.amount}|${norm(d.sender)}`)).map((d) => d.id));
    },
    // 입금자명과 금액이 모두 일치하는 '주문' 상태 주문(미수금 = 입금액)과 그 장바구니 상품을 돌려준다.
    async candidatesFor({ sender, amount }) {
      const name = norm(sender);
      if (!name) return [];
      const [orders] = await pool.query(
        `SELECT od_id, od_name, od_deposit_name, od_settle_case, od_status, od_misu, od_cart_price,
                od_send_cost, od_send_cost2, od_time
           FROM ${O}
          WHERE od_status = '주문' AND od_misu = ?
            AND REPLACE(IF(od_deposit_name <> '', od_deposit_name, od_name), ' ', '') = ?
          ORDER BY od_time DESC LIMIT 10`,
        [amount, name]
      );
      if (!orders.length) return [];
      const [items] = await pool.query(
        `SELECT od_id, it_id, it_name, io_id, ct_qty, ct_price, io_price, ct_status
           FROM ${C} WHERE od_id IN (?) ORDER BY ct_id`,
        [orders.map((o) => o.od_id)]
      );
      return orders.map((o) => ({
        ...o,
        od_id: String(o.od_id),
        od_time: o.od_time instanceof Date ? o.od_time.toISOString() : o.od_time,
        items: items
          .filter((i) => String(i.od_id) === String(o.od_id))
          .map((i) => ({
            it_id: i.it_id, name: i.it_name, option: i.io_id || '', qty: i.ct_qty,
            price: i.ct_price + i.io_price, subtotal: (i.ct_price + i.io_price) * i.ct_qty, status: i.ct_status,
          })),
      }));
    },

    // 그누보드 관리자의 '입금' 처리와 같은 결과로 바꾼다(입금액/미수금/입금시간/상태, 장바구니 상태). 한 트랜잭션.
    async confirm(odId, amount) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT od_status, od_misu FROM ${O} WHERE od_id = ? FOR UPDATE`, [odId]);
        if (!rows.length) throw httpErr(404, '주문을 찾을 수 없습니다');
        if (rows[0].od_status !== '주문') throw httpErr(409, `이미 처리된 주문입니다 (상태: ${rows[0].od_status})`);
        if (Number(rows[0].od_misu) !== amount) throw httpErr(409, '주문 금액이 입금액과 다릅니다');
        await conn.query(
          `UPDATE ${O} SET od_receipt_price = od_receipt_price + ?, od_misu = od_misu - ?,
                  od_receipt_time = NOW(), od_status = '입금' WHERE od_id = ?`,
          [amount, amount, odId]
        );
        await conn.query(`UPDATE ${C} SET ct_status = '입금' WHERE od_id = ? AND ct_status = '주문'`, [odId]);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  };
}
