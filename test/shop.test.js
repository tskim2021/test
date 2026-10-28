import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createShop, classify, bestLevel, orderKeys, relatedDepositIds } from '../shop.js';

// 실제 MySQL/MariaDB(그누보드 스키마)가 있을 때만 실행: SHOP_DB_NAME 등 환경변수를 설정하세요.
const skip = !process.env.SHOP_DB_NAME && '쇼핑몰 테스트 DB 미설정';

test('입금자명+금액 일치 후보와 장바구니 상품 조회', { skip }, async () => {
  const shop = await createShop();
  after(() => shop.close());
  const c = await shop.candidatesFor({ sender: '강애진', amount: 86400 });
  assert.equal(c.length, 1);
  assert.equal(c[0].items.length, 2);
  assert.equal(c[0].items[0].subtotal, 80000);
  assert.deepEqual(await shop.candidatesFor({ sender: '강애진', amount: 1 }), []);
  assert.deepEqual(await shop.candidatesFor({ sender: null, amount: 86400 }), []);
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
  const shop = await createShop();
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
  const shop = await createShop();
  after(() => shop.close());
  const m = await shop.itemsByOrder(['A2026102801']);
  assert.deepEqual(m['A2026102801'].map((i) => [i.name, i.option, i.qty]), [['선물세트 A', '', 2], ['쿠키 박스', '색상 빨강', 2]]);
  assert.deepEqual(await shop.itemsByOrder([]), {});
});

test('DB: 문자 포함 주문번호, DECIMAL 금액은 숫자로, 시각은 DB 값 그대로', { skip }, async () => {
  const shop = await createShop();
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
  assert.deepEqual([...k.amounts].sort((a, b) => a - b), [0, 0, 0, 32900 + 3000, 35900].sort((a, b) => a - b).filter((v, i, arr) => arr.indexOf(v) === i));
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
