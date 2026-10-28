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
    // 날짜는 DB에 저장된 값 그대로('YYYY-MM-DD HH:MM:SS', 쇼핑몰 시간) 받는다. Date 로 바꾸면 서버 시간대 때문에 어긋난다.
    dateStrings: true,
    connectionLimit: 3,
    waitForConnections: true,
  });
  return shopFromPool(pool, env.SHOP_TABLE_PREFIX ?? 'g5_');
}

const num = (v) => Number(v);
const orderTotal = (o) => num(o.od_cart_price) + num(o.od_send_cost) + num(o.od_send_cost2);
const RANK = { full: 4, other: 3, name: 2, amount: 1 };
const WINDOW_DAYS = 60;
const norm = (s) => String(s || '').replace(/\s+/g, '');
// 그누보드는 PHP 한국시간으로 시각을 기록하므로 같은 형식으로 맞춘다.
const kstNow = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

// 입금 1건과 주문 1건의 관계. full=이름+금액 일치(처리 가능), name=이름만, amount=금액만,
// other='주문' 상태가 아닌데 이름+금액이 맞는 주문(이미 입금 처리됐을 가능성)
export function classify(o, dep) {
  const n = norm(dep.sender);
  const nameHit = !!n && (norm(o.od_deposit_name) === n || norm(o.od_name) === n);
  const effHit = !!n && norm(o.od_deposit_name || o.od_name) === n;
  const pending = o.od_status === '주문';
  const misuHit = num(o.od_misu) === dep.amount;
  const amtHit = misuHit || orderTotal(o) === dep.amount || num(o.od_receipt_price) === dep.amount;
  if (pending) {
    if (effHit && misuHit) return 'full';
    if (nameHit) return 'name';
    return amtHit ? 'amount' : null;
  }
  return nameHit && amtHit ? 'other' : null;
}
// 주문 목록에서 입금 후보를 좁히는 키(이름, 미입금 주문의 금액, 주문번호)
export function orderKeys(orders) {
  const names = new Set(), amounts = new Set(), odIds = new Set();
  for (const o of orders) {
    odIds.add(String(o.od_id));
    for (const n of [norm(o.od_deposit_name), norm(o.od_name)]) if (n) names.add(n);
    if (o.od_status === '주문') for (const a of [num(o.od_misu), orderTotal(o), num(o.od_receipt_price)]) amounts.add(a);
  }
  return { names, amounts, odIds };
}
// 주문 목록과 관계가 있는 입금 id 집합. 처리(연결)된 입금은 연결된 주문이 목록에 있을 때만, 그 외는 이름/금액 관계로 판정한다.
export function relatedDepositIds(orders, deposits) {
  const byName = new Map(), byAmt = new Map(), ids = new Set();
  const push = (m, k, o) => { if (!m.has(k)) m.set(k, []); m.get(k).push(o); };
  for (const o of orders) {
    ids.add(String(o.od_id));
    for (const n of new Set([norm(o.od_deposit_name), norm(o.od_name)])) if (n) push(byName, n, o);
    if (o.od_status === '주문') for (const a of new Set([num(o.od_misu), orderTotal(o), num(o.od_receipt_price)])) push(byAmt, a, o);
  }
  const out = new Set();
  for (const d of deposits) {
    if (d.order_id) { if (ids.has(String(d.order_id))) out.add(d.id); continue; }
    const cands = [...(byName.get(norm(d.sender)) || []), ...(byAmt.get(d.amount) || [])];
    if (cands.some((o) => classify(o, d))) out.add(d.id);
  }
  return out;
}
export const bestLevel = (levels) => levels.reduce((b, l) => (l && (!b || RANK[l] > RANK[b]) ? l : b), null);

const COLS = `od_id, od_name, od_deposit_name, od_settle_case, od_status, od_misu, od_receipt_price,
              od_cart_price, od_send_cost, od_send_cost2, od_time`;

export function shopFromPool(pool, prefix = 'g5_') {
  if (!/^[A-Za-z0-9_]*$/.test(prefix)) throw new Error('SHOP_TABLE_PREFIX 형식 오류');
  const O = `${prefix}shop_order`;
  const C = `${prefix}shop_cart`;
  let cache = { key: '', at: 0, rows: [] };

  const itemsOf = async (odIds) => {
    if (!odIds.length) return [];
    const [items] = await pool.query(
      `SELECT od_id, it_id, it_name, io_id, ct_qty, ct_price, io_price, ct_status
         FROM ${C} WHERE od_id IN (?) ORDER BY ct_id`, [odIds]);
    return items;
  };
  const shapeItem = (i) => {
    const price = num(i.ct_price) + num(i.io_price);
    return { it_id: i.it_id, name: i.it_name, option: i.io_id || '', qty: num(i.ct_qty), price, subtotal: price * num(i.ct_qty), status: i.ct_status };
  };
  const shapeOrder = (o, items) => ({
    od_id: String(o.od_id), od_name: o.od_name, od_deposit_name: o.od_deposit_name, od_status: o.od_status,
    od_misu: num(o.od_misu), od_receipt_price: num(o.od_receipt_price), od_total: orderTotal(o),
    od_send_cost: num(o.od_send_cost), od_time: o.od_time,
    items: items.filter((i) => String(i.od_id) === String(o.od_id)).map(shapeItem),
  });

  return {
    close: () => pool.end(),
    // 연결 확인용: 주문 테이블 건수
    async ping() {
      const [[r]] = await pool.query(`SELECT COUNT(*) AS n FROM ${O}`);
      return num(r.n);
    },
    // 주문번호 목록 -> { od_id: [{name, option, qty}] } (목록에 작게 보여줄 용도)
    async itemsByOrder(odIds) {
      const out = {};
      for (const i of await itemsOf(odIds)) (out[String(i.od_id)] ||= []).push({ name: i.it_name, option: i.io_id || '', qty: num(i.ct_qty) });
      return out;
    },
    // 주문일자(쇼핑몰 주문 시각, 한국시간 문자열) 기간의 주문. from/to 는 'YYYY-MM-DD'.
    async ordersInRange(from, to) {
      const where = [];
      const args = [];
      if (from) { where.push('od_time >= ?'); args.push(`${from} 00:00:00`); }
      if (to) { where.push('od_time <= ?'); args.push(`${to} 23:59:59`); }
      const [rows] = await pool.query(
        `SELECT ${COLS} FROM ${O} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY od_time DESC LIMIT 20000`, args);
      return rows;
    },
    // 입금 목록 -> Map(id -> 'full'|'other'|'name'|'amount').
    // 목록의 입금자·금액에 해당하는 최근 60일 주문만 골라 읽는다(주문이 아무리 많아도 누락되지 않게). 10초 캐시.
    async matchLevels(list) {
      const out = new Map();
      if (!list.length) return out;
      const key = JSON.stringify(list.map((d) => [norm(d.sender), d.amount]));
      if (cache.key !== key || Date.now() - cache.at > 10_000) {
        const names = [...new Set(list.map((d) => norm(d.sender)).filter(Boolean))];
        const amounts = [...new Set(list.map((d) => d.amount))];
        const win = `od_time >= NOW() - INTERVAL ${WINDOW_DAYS} DAY`;
        // 이름이 맞는 주문(모든 상태)과 금액이 맞는 미입금 주문을 따로 읽는다. 한쪽이 많아도 다른 쪽이 잘리지 않게.
        const [byName] = names.length
          ? await pool.query(
              `SELECT ${COLS} FROM ${O} WHERE ${win} AND (REPLACE(od_deposit_name, ' ', '') IN (?) OR REPLACE(od_name, ' ', '') IN (?))
                ORDER BY od_time DESC LIMIT 5000`, [names, names])
          : [[]];
        const [byAmount] = await pool.query(
          `SELECT ${COLS} FROM ${O} WHERE ${win} AND od_status = '주문'
              AND (od_misu IN (?) OR od_receipt_price IN (?) OR (od_cart_price + od_send_cost + od_send_cost2) IN (?))
            ORDER BY od_time DESC LIMIT 5000`, [amounts, amounts, amounts]);
        const seen = new Set();
        const rows = [...byName, ...byAmount].filter((o) => !seen.has(String(o.od_id)) && seen.add(String(o.od_id)));
        cache = { key, at: Date.now(), rows };
      }
      for (const d of list) {
        const lv = bestLevel(cache.rows.map((o) => classify(o, d)));
        if (lv) out.set(d.id, lv);
      }
      return out;
    },
    // 입금 1건과 관련된 주문(최근 60일)을 관계별로 묶어 상품과 함께 돌려준다.
    async relatedFor(dep) {
      const n = norm(dep.sender);
      const win = `od_time >= NOW() - INTERVAL ${WINDOW_DAYS} DAY`;
      const [byName] = n
        ? await pool.query(
            `SELECT ${COLS} FROM ${O} WHERE ${win} AND (REPLACE(od_deposit_name, ' ', '') = ? OR REPLACE(od_name, ' ', '') = ?)
              ORDER BY od_time DESC LIMIT 60`, [n, n])
        : [[]];
      const [byAmount] = await pool.query(
        `SELECT ${COLS} FROM ${O} WHERE ${win} AND od_status = '주문'
            AND (od_misu = ? OR od_receipt_price = ? OR (od_cart_price + od_send_cost + od_send_cost2) = ?)
          ORDER BY od_time DESC LIMIT 60`, [dep.amount, dep.amount, dep.amount]);
      const seen = new Set();
      const orders = [...byName, ...byAmount].filter((o) => !seen.has(String(o.od_id)) && seen.add(String(o.od_id)));
      const groups = { full: [], other: [], name: [], amount: [] };
      for (const o of orders) {
        const lv = classify(o, dep);
        if (lv && groups[lv].length < 10) groups[lv].push(o);
      }
      const items = await itemsOf(Object.values(groups).flat().map((o) => o.od_id));
      return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((o) => shapeOrder(o, items))]));
    },
    // 입금자명과 금액이 모두 일치하는 '주문' 상태 주문(미수금 = 입금액)과 그 장바구니 상품을 돌려준다.
    async candidatesFor({ sender, amount }) {
      const name = norm(sender);
      if (!name) return [];
      const [orders] = await pool.query(
        `SELECT ${COLS} FROM ${O}
          WHERE od_status = '주문' AND od_misu = ?
            AND REPLACE(IF(od_deposit_name <> '', od_deposit_name, od_name), ' ', '') = ?
          ORDER BY od_time DESC LIMIT 10`,
        [amount, name]);
      const items = await itemsOf(orders.map((o) => o.od_id));
      return orders.map((o) => shapeOrder(o, items));
    },

    // 그누보드 관리자의 '입금' 처리와 같은 결과로 바꾼다(입금액=주문 미수금 전액, 미수금 0, 입금시간, 상태, 장바구니 상태). 한 트랜잭션.
    // expectMisu 가 있으면 주문 미수금이 그 값과 같을 때만 처리한다(자동 일치 처리). null 이면 금액 검사 없이 처리(수동 처리).
    async confirm(odId, { expectMisu = null } = {}) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT od_status, od_misu FROM ${O} WHERE od_id = ? FOR UPDATE`, [odId]);
        if (!rows.length) throw httpErr(404, '주문을 찾을 수 없습니다');
        if (rows[0].od_status !== '주문') throw httpErr(409, `이미 처리된 주문입니다 (상태: ${rows[0].od_status})`);
        if (expectMisu !== null && num(rows[0].od_misu) !== expectMisu) throw httpErr(409, '주문 금액이 입금액과 다릅니다');
        await conn.query(
          `UPDATE ${O} SET od_receipt_price = od_receipt_price + od_misu, od_misu = 0,
                  od_receipt_time = ?, od_status = '입금' WHERE od_id = ?`,
          [kstNow(), odId]);
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
