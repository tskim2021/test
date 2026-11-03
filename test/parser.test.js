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

test('카카오뱅크 SMS(iPhone 단축어로 전달)', () => {
  const sms = (body) => parseNotification({ title: '', text: `[Web발신]\n[카카오뱅크]\n김*희(1526)\n${body}` });
  let r = sms('10/30 15:57\n입금 89,800원\n박사라\n잔액 4,369,586원');
  assert.equal(r.amount, 89800); assert.equal(r.sender, '박사라'); assert.equal(r.balance, 4369586);
  r = sms('10/30 16:23\n입금 89,640원\n천봉상');
  assert.equal(r.amount, 89640); assert.equal(r.sender, '천봉상'); assert.equal(r.balance, null);
  r = sms('10/30 15:56\n입금 1,000원\n김미희\n잔액 4,279,786원');
  assert.equal(r.amount, 1000); assert.equal(r.sender, '김미희');
  assert.equal(sms('10/30 17:00\n출금 5,000원\n스타벅스\n잔액 1,000원'), null);
});

test('카카오뱅크 형식 판별과 계좌 끝자리', async () => {
  const { isBankFormat, accountOf } = await import('../parser.js');
  const sms = '[Web발신] [카카오뱅크] 노*유(4063) 11/03 10:39 입금 32,300원 김영동';
  const app = '입금 40,300원 박상중 → 입출금통장(4063)';
  const mail = 'Re: AMEYOKO 아메요꼬 1:1문의 답변 알림 메일 입금자 농협(정수범) 3022014208751 87100원 입금 완료했습니다. 카카오뱅크';
  assert.equal(isBankFormat(sms), true);
  assert.equal(isBankFormat(app), true);
  assert.equal(isBankFormat(mail), false);
  assert.equal(isBankFormat('[카카오뱅크]\n노*유(3916)\n11/03 10:28\n입금 99,000원\n윤형철'), true);
  assert.equal(accountOf(sms), '4063');
  assert.equal(accountOf(app), '4063');
  assert.equal(accountOf('[Web발신]\n[카카오뱅크]\n노*유(3916)\n11/03 10:28\n입금 99,000원\n윤형철'), '3916');
  assert.equal(accountOf(mail), null);
});
