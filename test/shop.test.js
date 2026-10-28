import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createShop, shopFromPool, classify, bestLevel, orderKeys, relatedDepositIds, krwOf } from '../shop.js';

// 실제 MySQL/MariaDB(그누보드 스키마)가 있을 때만 실행: SHOP_DB_NAME 등 환경변수를 설정하세요.
const skip = !process.env.SHOP_DB_NAME && '쇼핑몰 테스트 DB 미설정';

test('입금자명+금액 일치 후보와 장바구니 상품 조회', { skip }, async () => {
  const shop = await createShop({ ...process.env, SHOP_CURRENCY: 'KRW' });
  after(() => shop.close());
  const c = (await shop.relatedFor({ sender: '강애진', amount: 86400 })).full;
  assert.equal(c.length, 1);
  assert.equal(c[0].items.length, 2);
  assert.equal(c[0].items[0].subtotal, 80000);
  assert.equal((await shop.relatedFor({ sender: '강애진', amount: 1 })).full.length, 0);
  assert.equal((await shop.relatedFor({ sender: null, amount: 86400 })).full.length, 0);
});

test('입금과 주문의 관계 판정(DB 불필요)', () => {
  const o = { od_name: '이상덕', od_deposit_name: '', od_status: '주문', od_misu: 35900, od_receipt_price: 0, od_cart_price: 32900, od_send_cost: 3000, od_send_cost2: 0 };
  assert.equal(classify(o, { sender: '이상덕', amount: 35900 }), 'full');
  assert.equal(classify(o, { sender: '이 상 덕', amount: 35900 }), 'full'); // 공백 무시
  assert.equal(classify(o, { sender: '이상덕', amount: 30000 }), 'name'); // 이름만
  assert.equal(classify(o, { sender: '홍길동', amount: 35900 }), 'amount'); // 금액만
  assert.equal(classify(o, { sender: '홍길동', amount: 1 }), null);
  assert.equal(classify({ ...o, od_deposit_name: '다른이름' }, { sender: '이상덕', amount: 35900 }), 'name'); // 입금자명이 다르면 완전일치 아님
  assert.equal(classify({ ...o, od_status: '입금', od_misu: 0, od_receipt_price: 35900 }, { sender: '이상덕', amount: 35900 }), 'other');
  assert.equal(classify({ ...o, od_status: '입금' }, { sender: '이상덕', amount: 1 }), null);
  assert.equal(bestLevel(['amount', 'name', null]), 'name');
  assert.equal(bestLevel(['name', 'full', 'other']), 'full');
  assert.equal(bestLevel([null]), null);
});

test('DB: 입금별 일치 수준과 관련 주문', { skip }, async () => {
  const shop = await createShop({ ...process.env, SHOP_CURRENCY: 'KRW' });
  after(() => shop.close());
  const lv = await shop.matchLevels([
    { id: 1, sender: '강애진', amount: 86400 }, // 이름+금액
    { id: 2, sender: '강애진', amount: 5000 },  // 이름만
    { id: 3, sender: '아무개', amount: 86400 }, // 금액만
    { id: 4, sender: '박서준', amount: 30000 }, // 이미 입금된 주문
    { id: 5, sender: '모르는사람', amount: 7 }, // 없음
  ]);
  assert.deepEqual([...lv], [[1, 'full'], [2, 'name'], [3, 'amount'], [4, 'other']]);
  const rel = await shop.relatedFor({ sender: '강애진', amount: 5000 });
  assert.equal(rel.name.length, 1);
  assert.equal(rel.name[0].items.length, 2);
  assert.equal(rel.full.length, 0);
});

test('처리된 주문 번호별 상품·옵션 조회', { skip }, async () => {
  const shop = await createShop({ ...process.env, SHOP_CURRENCY: 'KRW' });
  after(() => shop.close());
  const m = await shop.itemsByOrder(['A2026102801']);
  assert.deepEqual(m['A2026102801'].map((i) => [i.name, i.option, i.qty]), [['선물세트 A', '', 2], ['쿠키 박스', '색상 빨강', 2]]);
  assert.deepEqual(await shop.itemsByOrder([]), {});
});

test('DB: 문자 포함 주문번호, DECIMAL 금액은 숫자로, 시각은 DB 값 그대로', { skip }, async () => {
  const shop = await createShop({ ...process.env, SHOP_CURRENCY: 'KRW' });
  after(() => shop.close());
  const rel = await shop.relatedFor({ sender: '강애진', amount: 5000 });
  const o = rel.name[0];
  assert.match(o.od_id, /^A\d+$/);
  assert.equal(typeof o.od_misu, 'number');
  assert.match(o.od_time, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); // 시간대 변환 없이 문자열 그대로
  for (const i of o.items) {
    assert.equal(typeof i.price, 'number');
    assert.equal(i.subtotal, i.price * i.qty);
  }
  assert.equal(o.items[0].subtotal, 80000);
});

test('주문일자 검색: 주문 목록과 관계있는 입금만 고른다(DB 불필요)', () => {
  const orders = [
    { od_id: 'A1', od_name: '이상덕', od_deposit_name: '', od_status: '주문', od_misu: 35900, od_receipt_price: 0, od_cart_price: 32900, od_send_cost: 3000, od_send_cost2: 0 },
    { od_id: 'A2', od_name: '박서준', od_deposit_name: '박서준', od_status: '입금', od_misu: 0, od_receipt_price: 30000, od_cart_price: 30000, od_send_cost: 0, od_send_cost2: 0 },
  ];
  const k = orderKeys(orders);
  assert.deepEqual([...k.names].sort(), ['박서준', '이상덕']);
  assert.deepEqual(k.ranges, [[35900, 35900]]); // 미입금('주문') 주문의 금액만, 같은 값은 하나로
  assert.deepEqual([...k.odIds].sort(), ['A1', 'A2']);
  const deps = [
    { id: 1, sender: '이상덕', amount: 35900, order_id: null },   // 이름+금액
    { id: 2, sender: '이상덕', amount: 1, order_id: null },       // 이름만
    { id: 3, sender: '홍길동', amount: 35900, order_id: null },   // 금액만(미입금 주문)
    { id: 4, sender: '홍길동', amount: 7, order_id: null },       // 무관
    { id: 5, sender: '박서준', amount: 30000, order_id: null },   // 이미 입금된 주문과 이름+금액
    { id: 6, sender: '아무개', amount: 7, order_id: 'A1' },       // 연결된 주문이 목록에 있음
    { id: 7, sender: '이상덕', amount: 35900, order_id: 'A9' },   // 다른 주문과 연결됨 -> 제외
  ];
  assert.deepEqual([...relatedDepositIds(orders, deps)].sort(), [1, 2, 3, 5, 6]);
});

// ---- 달러 쇼핑몰: 원화 = ceil(USD × 환율 / 100) × 100 ----
test('환율 환산: 100원 단위 올림 (실제 주문 사례)', () => {
  assert.equal(krwOf(19.8, 1329), 26400);   // 곽도빈: 26,314.2 -> 26,400
  assert.equal(krwOf(621, 1329), 825400);   // 이전희: 825,309 -> 825,400
  assert.equal(krwOf(27, 1329), 35900);     // 35,883 -> 35,900
  assert.equal(krwOf(50, 1329), 66500);     // 66,450 -> 66,500
  assert.equal(krwOf(100, 1300), 130000);   // 딱 떨어지면 그대로(부동소수점 잡음에 올리지 않음)
});

test('달러 주문 판정: 환산 금액이 입금액과 맞으면 full', () => {
  const o = { od_name: '곽도빈', od_deposit_name: '곽도빈', od_status: '주문', od_misu: 19.8, od_receipt_price: 0, od_cart_price: 22, od_send_cost: 0, od_send_cost2: 0 };
  assert.equal(classify(o, { sender: '곽도빈', amount: 26400 }, 1329), 'full');
  assert.equal(classify(o, { sender: '곽도빈', amount: 26400 }, null), 'name'); // 환율 없이 비교하면 금액이 다르다
  assert.equal(classify(o, { sender: '곽도빈', amount: 29300 }, 1329), 'name'); // 상품+배송(22)은 29,238 -> 미수금과는 다름
  assert.equal(classify(o, { sender: '다른사람', amount: 26400 }, 1329), 'amount');
  assert.equal(classify(o, { sender: '곽도빈', amount: 26500 }, 1329), 'full'); // 올림 방식 차이(±100원) 허용
  assert.equal(classify(o, { sender: '곽도빈', amount: 26600 }, 1329), 'name');
  assert.equal(classify({ ...o, od_misu: 0, od_receipt_price: 0, od_cart_price: 0 }, { sender: '곽도빈', amount: 50 }, 1329), 'name'); // 0원 주문은 금액 일치로 보지 않음
  const k = orderKeys([o], 1329);
  assert.deepEqual(k.ranges.sort((a, b) => a[0] - b[0]), [[26300, 26500], [29200, 29400]]); // 미수금(19.8) / 상품+배송(22) 환산 ±100
  const ids = relatedDepositIds([{ ...o, od_id: 'A1' }], [
    { id: 1, sender: '곽도빈', amount: 26400, order_id: null },
    { id: 2, sender: '모름', amount: 26450, order_id: null },
    { id: 3, sender: '모름', amount: 5000, order_id: null },
  ], 1329);
  assert.deepEqual([...ids].sort(), [1, 2]);
});

test('환율 찾기: 설정 > 쇼핑몰 사이트 > 쇼핑몰 DB(로그/이전값 제외), 원화 쇼핑몰은 환산 안 함', async () => {
  const mk = (rows) => ({
    query: async (sql, args) => {
      if (sql.includes('information_schema')) { // 로그/이전값 제외 조건이 SQL 에 들어 있어야 한다
        assert.match(sql, /NOT REGEXP 'log\|hist/);
        assert.match(sql, /column_name NOT REGEXP 'old\|prev/);
        return [rows.cols || []];
      }
      if (sql.includes('FROM `g5_shop_default`')) return [[{ v: rows.v }]];
      if (sql.includes('g5_shop_item')) return [[{ it_id: 'X1' }]];
      throw new Error('unexpected ' + sql);
    },
  });
  const origFetch = globalThis.fetch;
  const site = (v) => { globalThis.fetch = async () => ({ text: async () => `<input type="hidden" id="exchange_rate" value="${v}">` }); };
  const down = () => { globalThis.fetch = async () => { throw new Error('offline'); }; };
  try {
    // 사이트(고객이 보는 환율)가 DB 보다 우선
    site('1329.0000');
    const both = await shopFromPool(mk({ cols: [{ t: 'g5_shop_default', c: 'de_exchange_rate' }], v: '1343' }), 'g5_', { currency: 'USD' }).getRate();
    assert.deepEqual([both.rate, both.source], [1329, '쇼핑몰 사이트 환율']);
    // 사이트가 안 되면 DB
    down();
    const dbRate = await shopFromPool(mk({ cols: [{ t: 'g5_shop_default', c: 'de_exchange_rate' }], v: '1329.0000' }), 'g5_', { currency: 'USD' }).getRate();
    assert.deepEqual([dbRate.rate, dbRate.source.includes('g5_shop_default.de_exchange_rate')], [1329, true]);
    // 범위(500~3000) 밖 값은 환율이 아님
    assert.equal(await shopFromPool(mk({ cols: [{ t: 'g5_shop_default', c: 'de_tax_rate' }], v: '10' }), 'g5_', { currency: 'USD' }).getRate(), null);
    // 사이트가 이상한 값을 주면 무시
    site('12');
    assert.equal(await shopFromPool(mk({ cols: [] }), 'g5_', { currency: 'USD' }).getRate(), null);
  } finally { globalThis.fetch = origFetch; }
  assert.equal((await shopFromPool(mk({}), 'g5_', { currency: 'USD', usdKrw: '1400' }).getRate()).rate, 1400); // 설정이 최우선
  assert.equal(await shopFromPool(mk({}), 'g5_', { currency: 'KRW' }).getRate(), null);
});

test('DB(USD): 환산 일치, 이미지·상품 링크·원화 표기', { skip }, async () => {
  const shop = await createShop({ ...process.env, SHOP_CURRENCY: 'USD', SHOP_USD_KRW: '1329', SHOP_URL: 'https://shop.test/' });
  after(() => shop.close());
  const lv = await shop.matchLevels([{ id: 1, sender: '곽도빈', amount: 26400 }, { id: 2, sender: '테스터', amount: 825400 }, { id: 3, sender: '곽도빈', amount: 5 }]);
  assert.deepEqual([...lv], [[1, 'full'], [2, 'full'], [3, 'name']]);
  const full = (await shop.relatedFor({ sender: '곽도빈', amount: 26400 })).full;
  assert.equal(full.length, 1);
  const o = full[0];
  assert.deepEqual([o.od_misu, o.od_misu_krw, o.od_total, o.od_total_krw], [19.8, 26400, 22, 29300]);
  const it = o.items[0];
  assert.equal(it.image, 'https://shop.test/data/item/IT10/a.jpg');
  assert.equal(it.url, 'https://shop.test/shop/item.php?it_id=IT10');
  assert.deepEqual([it.price, it.price_krw, it.subtotal_krw], [22, 29238, 29238]); // 쇼핑몰 상품 페이지처럼 내림
  // 문태원: $39.5 × 1329 = 52,495.5 -> 52,500 (실제 사례)
  assert.equal(krwOf(39.5, 1329), 52500);
  assert.equal(krwOf(39.5, 1343), 53100); // 잘못된(이전) 환율이면 600원 차이
  const noImg = (await shop.relatedFor({ sender: '곽도빈', amount: 26400 })).full[0].items;
  assert.ok(noImg.every((x) => typeof x.image === 'string'));
});

test('DB: 입금 처리 — 상태/처리 시각/장바구니/상점메모(관리자 화면 표시용)', { skip }, async (t) => {
  const shop = await createShop({ ...process.env, SHOP_CURRENCY: 'KRW' });
  after(() => shop.close());
  const before = await shop.check(['A2026102807']);
  if (!before.has_shop_memo_column) return t.skip('테스트 DB에 od_shop_memo 컬럼 없음');
  if ((await shop.relatedFor({ sender: '정수빈', amount: 50000 })).full.length === 0) return t.skip('이미 처리된 테스트 데이터(시드를 다시 넣으세요)');
  await shop.confirm('A2026102807', { expectKrw: 50000, note: '입금 정수빈 50,000원 확인 → 입금 처리: 사유 테스트' });
  const c = await shop.check(['A2026102807']);
  const o = c.processed_by_monitor[0];
  assert.equal(o.od_status, '입금');
  assert.equal(o.cart_status, '입금');
  assert.equal(o.od_misu, 0);
  assert.equal(o.od_receipt_price, 50000);
  assert.match(String(o.od_receipt_time), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(Number(o.has_shop_memo), 1);
  await assert.rejects(() => shop.confirm('A2026102807', { note: 'x' }), /이미 처리된 주문/); // 두 번 처리 불가
});
