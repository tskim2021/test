import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createShop } from '../shop.js';

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

test('입금 목록에서 일치하는 주문이 있는 입금만 골라낸다', { skip }, async () => {
  const shop = await createShop();
  after(() => shop.close());
  const ids = await shop.matchedIds([
    { id: 1, sender: '강애진', amount: 86400 }, { id: 2, sender: '모르는사람', amount: 86400 },
    { id: 3, sender: '강애진', amount: 1 }, { id: 4, sender: null, amount: 86400 },
  ]);
  assert.deepEqual([...ids], [1]);
});

test('처리된 주문 번호별 상품·옵션 조회', { skip }, async () => {
  const shop = await createShop();
  after(() => shop.close());
  const m = await shop.itemsByOrder(['2026102801']);
  assert.deepEqual(m['2026102801'].map((i) => [i.name, i.option, i.qty]), [['선물세트 A', '', 2], ['쿠키 박스', '색상 빨강', 2]]);
  assert.deepEqual(await shop.itemsByOrder([]), {});
});
