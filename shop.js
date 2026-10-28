// 그누보드5 쇼핑몰 DB(g5_shop_order / g5_shop_cart / g5_shop_item) 연동.
// 접속 정보는 환경변수(SHOP_DB_HOST/PORT/USER/PASSWORD/NAME, SHOP_TABLE_PREFIX)로만 받는다.
//
// 이 쇼핑몰은 상품·주문 금액이 달러(USD)이고, 고객은 원화로 입금한다. 입금 요청액은
//   원화 = ceil( USD 금액 × 환율 / 100 ) × 100   (100원 단위 올림)
// 이다. 환율은 SHOP_USD_KRW 설정 → 쇼핑몰 사이트(고객이 보는 상품 페이지의 exchange_rate) → 쇼핑몰 DB 순서로 찾는다.
// 금액이 원화인 쇼핑몰이면 SHOP_CURRENCY=KRW 로 환산을 끈다.

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
  return shopFromPool(pool, env.SHOP_TABLE_PREFIX ?? 'g5_', {
    currency: (env.SHOP_CURRENCY || 'USD').toUpperCase(),
    usdKrw: env.SHOP_USD_KRW,
    shopUrl: (env.SHOP_URL || 'https://ameyokovip.com').replace(/\/+$/, ''),
  });
}

const num = (v) => Number(v);
const orderTotal = (o) => num(o.od_cart_price) + num(o.od_send_cost) + num(o.od_send_cost2);
const RANK = { full: 4, other: 3, name: 2, amount: 1 };
const WINDOW_DAYS = 60;
const TOL = 100; // 환산 금액과 입금액이 이만큼(원)까지 다르면 같은 금액으로 본다(올림 방식 차이 흡수)
const norm = (s) => String(s || '').replace(/\s+/g, '');
// 그누보드는 PHP 한국시간으로 시각을 기록하므로 같은 형식으로 맞춘다.
const kstNow = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

// 쇼핑몰이 입금을 요청하는 원화 금액(100원 단위 올림). 1e-9 는 부동소수점 잡음 제거용.
export const krwOf = (usd, rate) => Math.ceil((num(usd) * rate) / 100 - 1e-9) * 100;

// rate 가 있으면 주문 금액(USD)을 원화로 환산해 입금액과 비교하고, 없으면 금액을 그대로(원화) 비교한다.
const amountHit = (usd, dep, rate) => {
  const v = num(usd);
  if (!(v > 0)) return false;
  return rate ? Math.abs(krwOf(v, rate) - dep.amount) <= TOL : v === dep.amount;
};

// 입금 1건과 주문 1건의 관계. full=이름+금액 일치(처리 가능), name=이름만, amount=금액만,
// other='주문' 상태가 아닌데 이름+금액이 맞는 주문(이미 입금 처리됐을 가능성)
export function classify(o, dep, rate = null) {
  const n = norm(dep.sender);
  const nameHit = !!n && (norm(o.od_deposit_name) === n || norm(o.od_name) === n);
  const effHit = !!n && norm(o.od_deposit_name || o.od_name) === n;
  const pending = o.od_status === '주문';
  const misuHit = amountHit(o.od_misu, dep, rate);
  const amtHit = misuHit || amountHit(orderTotal(o), dep, rate) || amountHit(o.od_receipt_price, dep, rate);
  if (pending) {
    if (effHit && misuHit) return 'full';
    if (nameHit) return 'name';
    return amtHit ? 'amount' : null;
  }
  return nameHit && amtHit ? 'other' : null;
}

// 주문 목록에서 입금 후보를 좁히는 키: 이름, 주문번호, 입금액 범위([최소, 최대] 원)
export function orderKeys(orders, rate = null) {
  const names = new Set(), odIds = new Set(), ranges = new Map();
  for (const o of orders) {
    odIds.add(String(o.od_id));
    for (const n of [norm(o.od_deposit_name), norm(o.od_name)]) if (n) names.add(n);
    if (o.od_status === '주문') {
      for (const v of [o.od_misu, orderTotal(o), o.od_receipt_price]) {
        if (!(num(v) > 0)) continue;
        const k = rate ? krwOf(v, rate) : num(v);
        const t = rate ? TOL : 0;
        ranges.set(`${k - t}|${k + t}`, [k - t, k + t]);
      }
    }
  }
  return { names, odIds, ranges: [...ranges.values()] };
}

// 주문 목록과 관계가 있는 입금 id 집합. 처리(연결)된 입금은 연결된 주문이 목록에 있을 때만, 그 외는 이름/금액 관계로 판정한다.
export function relatedDepositIds(orders, deposits, rate = null) {
  const byName = new Map(), byAmt = new Map(), ids = new Set();
  const push = (m, k, o) => { if (!m.has(k)) m.set(k, []); m.get(k).push(o); };
  const bucket = (krw) => Math.round(krw / 100);
  for (const o of orders) {
    ids.add(String(o.od_id));
    for (const n of new Set([norm(o.od_deposit_name), norm(o.od_name)])) if (n) push(byName, n, o);
    if (o.od_status === '주문') {
      for (const v of new Set([num(o.od_misu), orderTotal(o), num(o.od_receipt_price)])) {
        if (v > 0) push(byAmt, bucket(rate ? krwOf(v, rate) : v), o);
      }
    }
  }
  const out = new Set();
  for (const d of deposits) {
    if (d.order_id) { if (ids.has(String(d.order_id))) out.add(d.id); continue; }
    const cands = [...(byName.get(norm(d.sender)) || [])];
    for (let b = bucket(d.amount) - 2; b <= bucket(d.amount) + 2; b++) cands.push(...(byAmt.get(b) || []));
    if (cands.some((o) => classify(o, d, rate))) out.add(d.id);
  }
  return out;
}
export const bestLevel = (levels) => levels.reduce((b, l) => (l && (!b || RANK[l] > RANK[b]) ? l : b), null);

const COLS = `od_id, od_name, od_deposit_name, od_settle_case, od_status, od_misu, od_receipt_price,
              od_cart_price, od_send_cost, od_send_cost2, od_time`;

// 입금액 A(원)에 해당할 수 있는 주문 금액(USD) 범위로 SQL 조건을 만든다(후보를 넉넉히 읽고 정확한 판정은 classify).
function amountSql(amounts, rate) {
  const conds = [];
  const args = [];
  for (const a of amounts) {
    const [lo, hi] = rate ? [(a - 2 * TOL) / rate, (a + TOL) / rate] : [a, a];
    conds.push('(od_misu BETWEEN ? AND ? OR od_receipt_price BETWEEN ? AND ? OR (od_cart_price + od_send_cost + od_send_cost2) BETWEEN ? AND ?)');
    args.push(lo, hi, lo, hi, lo, hi);
  }
  return { sql: conds.join(' OR ') || '0', args };
}

export function shopFromPool(pool, prefix = 'g5_', opts = {}) {
  if (!/^[A-Za-z0-9_]*$/.test(prefix)) throw new Error('SHOP_TABLE_PREFIX 형식 오류');
  const { currency = 'KRW', usdKrw = null, shopUrl = 'https://ameyokovip.com' } = opts;
  const O = `${prefix}shop_order`;
  const C = `${prefix}shop_cart`;
  const I = `${prefix}shop_item`;
  let cache = { key: '', at: 0, rows: [] };
  let rateCache = { at: 0, v: null };

  async function rateFromDb() {
    const [cols] = await pool.query(
      `SELECT table_name AS t, column_name AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND (column_name LIKE '%exchange%' OR column_name LIKE '%rate%')
          AND data_type IN ('decimal','float','double','int','bigint','varchar','char')
          AND table_name NOT IN (?, ?)
          AND table_name NOT REGEXP 'log|hist|bak|backup|old|tmp|temp'
          AND column_name NOT REGEXP 'old|prev|before|bak|log'
        LIMIT 30`, [O, C]);
    for (const { t, c } of cols) {
      if (!/^[A-Za-z0-9_]+$/.test(t) || !/^[A-Za-z0-9_]+$/.test(c)) continue;
      const [r] = await pool.query(`SELECT \`${c}\` AS v FROM \`${t}\` LIMIT 1`);
      const n = Number(r[0]?.v);
      if (n >= 500 && n <= 3000) return { rate: n, source: `쇼핑몰 DB(${t}.${c})` };
    }
    return null;
  }
  async function rateFromSite() {
    const [[it]] = await pool.query(`SELECT it_id FROM ${I} LIMIT 1`);
    if (!it) return null;
    const res = await fetch(`${shopUrl}/shop/item.php?it_id=${encodeURIComponent(it.it_id)}`, { signal: AbortSignal.timeout(8000) });
    const m = (await res.text()).match(/id=["']exchange_rate["'][^>]*value=["']([\d.]+)["']/);
    const n = m ? Number(m[1]) : NaN;
    return n >= 500 && n <= 3000 ? { rate: n, source: '쇼핑몰 사이트 환율' } : null;
  }
  // { rate, source } 또는 null(원화 쇼핑몰이거나 환율을 못 찾음). 10분 캐시.
  async function getRate() {
    if (currency === 'KRW') return null;
    if (Date.now() - rateCache.at < 600_000) return rateCache.v;
    let v = null;
    if (usdKrw && Number(usdKrw) > 0) v = { rate: Number(usdKrw), source: '설정(SHOP_USD_KRW)' };
    for (const f of [rateFromSite, rateFromDb]) {
      if (v) break;
      try { v = await f(); } catch (e) { console.error('환율 조회 실패:', f.name, e.message); }
    }
    rateCache = { at: Date.now(), v };
    return v;
  }

  const imageUrl = (f) => (f ? (/^https?:\/\//.test(f) ? f : `${shopUrl}/data/item/${f}`) : '');
  const itemsOf = async (odIds) => {
    if (!odIds.length) return [];
    try {
      const [items] = await pool.query(
        `SELECT c.od_id, c.it_id, c.it_name, c.io_id, c.ct_qty, c.ct_price, c.io_price, c.ct_status, i.it_img1
           FROM ${C} c LEFT JOIN ${I} i ON i.it_id = c.it_id WHERE c.od_id IN (?) ORDER BY c.ct_id`, [odIds]);
      return items;
    } catch (e) { // 상품 테이블/이미지 컬럼이 다른 쇼핑몰: 이미지 없이 계속
      const [items] = await pool.query(
        `SELECT od_id, it_id, it_name, io_id, ct_qty, ct_price, io_price, ct_status FROM ${C} WHERE od_id IN (?) ORDER BY ct_id`, [odIds]);
      return items;
    }
  };
  const shapeItem = (i, rate) => {
    const price = num(i.ct_price) + num(i.io_price);
    const subtotal = price * num(i.ct_qty);
    return {
      it_id: i.it_id, name: i.it_name, option: i.io_id || '', qty: num(i.ct_qty), price, subtotal, status: i.ct_status,
      price_krw: rate ? Math.floor(price * rate) : null, subtotal_krw: rate ? Math.floor(subtotal * rate) : null, // 쇼핑몰 상품 페이지와 같은 내림 표기
      image: imageUrl(i.it_img1), url: `${shopUrl}/shop/item.php?it_id=${encodeURIComponent(i.it_id)}`,
    };
  };
  const shapeOrder = (o, items, rate) => ({
    od_id: String(o.od_id), od_name: o.od_name, od_deposit_name: o.od_deposit_name, od_status: o.od_status,
    od_misu: num(o.od_misu), od_receipt_price: num(o.od_receipt_price), od_total: orderTotal(o),
    od_send_cost: num(o.od_send_cost), od_time: o.od_time,
    od_misu_krw: rate ? krwOf(o.od_misu, rate) : null, od_total_krw: rate ? krwOf(orderTotal(o), rate) : null,
    od_send_cost_krw: rate ? Math.floor(num(o.od_send_cost) * rate) : null,
    items: items.filter((i) => String(i.od_id) === String(o.od_id)).map((i) => shapeItem(i, rate)),
  });

  return {
    close: () => pool.end(),
    currency,
    getRate,
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
      const rate = (await getRate())?.rate || null;
      const key = JSON.stringify([rate, list.map((d) => [norm(d.sender), d.amount])]);
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
        const a = amountSql(amounts, rate);
        const [byAmount] = await pool.query(
          `SELECT ${COLS} FROM ${O} WHERE ${win} AND od_status = '주문' AND (${a.sql}) ORDER BY od_time DESC LIMIT 5000`, a.args);
        const seen = new Set();
        const rows = [...byName, ...byAmount].filter((o) => !seen.has(String(o.od_id)) && seen.add(String(o.od_id)));
        cache = { key, at: Date.now(), rows };
      }
      for (const d of list) {
        const lv = bestLevel(cache.rows.map((o) => classify(o, d, rate)));
        if (lv) out.set(d.id, lv);
      }
      return out;
    },
    // 입금 1건과 관련된 주문(최근 60일)을 관계별로 묶어 상품(이미지·링크 포함)과 함께 돌려준다.
    async relatedFor(dep) {
      const rate = (await getRate())?.rate || null;
      const n = norm(dep.sender);
      const win = `od_time >= NOW() - INTERVAL ${WINDOW_DAYS} DAY`;
      const [byName] = n
        ? await pool.query(
            `SELECT ${COLS} FROM ${O} WHERE ${win} AND (REPLACE(od_deposit_name, ' ', '') = ? OR REPLACE(od_name, ' ', '') = ?)
              ORDER BY od_time DESC LIMIT 60`, [n, n])
        : [[]];
      const a = amountSql([dep.amount], rate);
      const [byAmount] = await pool.query(
        `SELECT ${COLS} FROM ${O} WHERE ${win} AND od_status = '주문' AND (${a.sql}) ORDER BY od_time DESC LIMIT 60`, a.args);
      const seen = new Set();
      const orders = [...byName, ...byAmount].filter((o) => !seen.has(String(o.od_id)) && seen.add(String(o.od_id)));
      const groups = { full: [], other: [], name: [], amount: [] };
      for (const o of orders) {
        const lv = classify(o, dep, rate);
        if (lv && groups[lv].length < 10) groups[lv].push(o);
      }
      const items = await itemsOf(Object.values(groups).flat().map((o) => o.od_id));
      return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((o) => shapeOrder(o, items, rate))]));
    },

    // 그누보드 관리자의 '입금' 처리와 같은 결과로 바꾼다(입금액=주문 미수금 전액, 미수금 0, 입금시간, 상태, 장바구니 상태). 한 트랜잭션.
    // expectKrw 가 있으면 주문 미수금의 원화 환산액이 그 입금액과 맞을 때만 처리한다(자동 일치 처리). null 이면 금액 검사 없이 처리(수동 처리).
    async confirm(odId, { expectKrw = null } = {}) {
      const rate = (await getRate())?.rate || null;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT od_status, od_misu FROM ${O} WHERE od_id = ? FOR UPDATE`, [odId]);
        if (!rows.length) throw httpErr(404, '주문을 찾을 수 없습니다');
        if (rows[0].od_status !== '주문') throw httpErr(409, `이미 처리된 주문입니다 (상태: ${rows[0].od_status})`);
        if (expectKrw !== null && !amountHit(rows[0].od_misu, { amount: expectKrw }, rate)) throw httpErr(409, '주문 금액이 입금액과 다릅니다');
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
