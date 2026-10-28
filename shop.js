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

const orderTotal = (o) => Number(o.od_cart_price) + Number(o.od_send_cost) + Number(o.od_send_cost2);
const RANK = { full: 4, other: 3, name: 2, amount: 1 };
const WINDOW_DAYS = 60;
const norm = (s) => String(s || '').replace(/\s+/g, '');

// 입금 1건과 주문 1건의 관계. full=이름+금액 일치(처리 가능), name=이름만, amount=금액만,
// other='주문' 상태가 아닌데 이름+금액이 맞는 주문(이미 입금 처리됐을 가능성)
export function classify(o, dep) {
  const n = norm(dep.sender);
  const nameHit = !!n && (norm(o.od_deposit_name) === n || norm(o.od_name) === n);
  const effHit = !!n && norm(o.od_deposit_name || o.od_name) === n;
  const pending = o.od_status === '주문';
  const misuHit = Number(o.od_misu) === dep.amount;
  const amtHit = misuHit || orderTotal(o) === dep.amount || Number(o.od_receipt_price) === dep.amount;
  if (pending) {
    if (effHit && misuHit) return 'full';
    if (nameHit) return 'name';
    return amtHit ? 'amount' : null;
  }
  return nameHit && amtHit ? 'other' : null;
}
export const bestLevel = (levels) => levels.reduce((b, l) => (l && (!b || RANK[l] > RANK[b]) ? l : b), null);

export function shopFromPool(pool, prefix = 'g5_') {
  if (!/^[A-Za-z0-9_]*$/.test(prefix)) throw new Error('SHOP_TABLE_PREFIX 형식 오류');
  const O = `${prefix}shop_order`;
  const C = `${prefix}shop_cart`;
  let recent = { at: 0, rows: [] };

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
    // 입금 목록 -> Map(id -> 'full'|'other'|'name'|'amount'). 최근 60일 주문을 한 번 읽어(10초 캐시) 판정한다.
    async matchLevels(list) {
      const out = new Map();
      if (!list.length) return out;
      if (Date.now() - recent.at > 10_000) {
        const [rows] = await pool.query(
          `SELECT od_id, od_name, od_deposit_name, od_status, od_misu, od_receipt_price, od_cart_price, od_send_cost, od_send_cost2
             FROM ${O} WHERE od_time >= NOW() - INTERVAL ${WINDOW_DAYS} DAY LIMIT 20000`);
        recent = { at: Date.now(), rows };
      }
      for (const d of list) {
        const lv = bestLevel(recent.rows.map((o) => classify(o, d)));
        if (lv) out.set(d.id, lv);
      }
      return out;
    },
    // 입금 1건과 관련된 주문(최근 60일)을 관계별로 묶어 상품과 함께 돌려준다.
    async relatedFor(dep) {
      const n = norm(dep.sender);
      const [orders] = await pool.query(
        `SELECT od_id, od_name, od_deposit_name, od_settle_case, od_status, od_misu, od_receipt_price, od_cart_price,
                od_send_cost, od_send_cost2, od_time
           FROM ${O}
          WHERE od_time >= NOW() - INTERVAL ${WINDOW_DAYS} DAY
            AND ( (? <> '' AND (REPLACE(od_deposit_name, ' ', '') = ? OR REPLACE(od_name, ' ', '') = ?))
                  OR od_misu = ? OR od_receipt_price = ? OR (od_cart_price + od_send_cost + od_send_cost2) = ? )
          ORDER BY od_time DESC LIMIT 60`,
        [n, n, n, dep.amount, dep.amount, dep.amount]);
      const groups = { full: [], other: [], name: [], amount: [] };
      const picked = [];
      for (const o of orders) {
        const lv = classify(o, dep);
        if (lv && groups[lv].length < 10) { picked.push([lv, o]); groups[lv].push(o); }
      }
      const items = picked.length
        ? (await pool.query(`SELECT od_id, it_id, it_name, io_id, ct_qty, ct_price, io_price, ct_status FROM ${C} WHERE od_id IN (?) ORDER BY ct_id`,
            [picked.map(([, o]) => o.od_id)]))[0]
        : [];
      const shape = (o) => ({
        od_id: String(o.od_id), od_name: o.od_name, od_deposit_name: o.od_deposit_name, od_status: o.od_status,
        od_misu: Number(o.od_misu), od_receipt_price: Number(o.od_receipt_price), od_total: orderTotal(o),
        od_send_cost: Number(o.od_send_cost), od_time: o.od_time instanceof Date ? o.od_time.toISOString() : o.od_time,
        items: items.filter((i) => String(i.od_id) === String(o.od_id)).map((i) => ({
          name: i.it_name, option: i.io_id || '', qty: i.ct_qty, price: i.ct_price + i.io_price,
          subtotal: (i.ct_price + i.io_price) * i.ct_qty, status: i.ct_status })),
      });
      return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map(shape)]));
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
