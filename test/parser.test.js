import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotification } from '../parser.js';

// 주의: 아래 문구는 예상 형식이다. 실제 카카오뱅크 알림 샘플로 교체/추가할 것.
test('입금 알림: 금액·입금자·잔액 추출', () => {
  const r = parseNotification({ title: '카카오뱅크', text: '입금 50,000원 홍길동 잔액 1,234,000원' });
  assert.equal(r.amount, 50000);
  assert.equal(r.sender, '홍길동');
  assert.equal(r.balance, 1234000);
});

test('"~님이 ~원" 형식', () => {
  const r = parseNotification({ title: '입금', text: '김철수님이 12,000원을 입금했어요' });
  assert.equal(r.amount, 12000);
  assert.equal(r.sender, '김철수');
});

test('출금 알림은 무시', () => {
  assert.equal(parseNotification({ title: '카카오뱅크', text: '출금 30,000원 스타벅스' }), null);
});

test('금액 없는 알림은 무시', () => {
  assert.equal(parseNotification({ title: '카카오뱅크', text: '입금 내역을 확인해 보세요' }), null);
});
