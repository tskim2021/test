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
