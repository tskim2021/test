import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, isDate, kstStart, kstEnd } from '../db.js';

const mk = () => {
  const db = openDb(':memory:');
  // 한국시간 기준: 10/27 23:30, 10/28 00:10, 10/28 15:00 (UTC로는 10/27 14:30, 10/27 15:10, 10/28 06:00)
  db.add({ amount: 1000, sender: '김미희', balance: null, raw: 'a' }, new Date('2026-10-27T14:30:00Z'));
  db.add({ amount: 2000, sender: '강애진', balance: null, raw: 'b' }, new Date('2026-10-27T15:10:00Z'));
  db.add({ amount: 3000, sender: '100%_할인', balance: null, raw: 'c' }, new Date('2026-10-28T06:00:00Z'));
  return db;
};

test('한국시간 날짜 경계로 조회', () => {
  const db = mk();
  const d27 = db.search({ from: '2026-10-27', to: '2026-10-27' });
  assert.deepEqual(d27.rows.map((r) => r.amount), [1000]);
  const d28 = db.search({ from: '2026-10-28', to: '2026-10-28' });
  assert.equal(d28.count, 2);
  assert.equal(d28.total, 5000);
});

test('입금자 부분 검색, LIKE 특수문자는 문자 그대로', () => {
  const db = mk();
  assert.equal(db.search({ q: '애진' }).count, 1);
  assert.equal(db.search({ q: '%' }).count, 1);
  assert.equal(db.search({ q: '_' }).count, 1);
  assert.equal(db.search({ q: '없는사람' }).count, 0);
});

test('페이지네이션과 전체 건수/합계', () => {
  const db = mk();
  const p1 = db.search({ limit: 2, offset: 0 });
  const p2 = db.search({ limit: 2, offset: 2 });
  assert.equal(p1.rows.length, 2);
  assert.equal(p2.rows.length, 1);
  assert.equal(p1.count, 3);
  assert.equal(p1.total, 6000);
});

test('날짜 형식 검증', () => {
  assert.ok(isDate('2026-10-28'));
  assert.ok(!isDate('2026-13-40'));
  assert.ok(!isDate('abc'));
  assert.equal(kstStart('2026-10-28'), '2026-10-27T15:00:00.000Z');
  assert.equal(kstEnd('2026-10-28'), '2026-10-28T14:59:59.999Z');
});

test('소프트 삭제: 목록/합계에서 빠지지만 DB에는 남고 중복 저장도 막는다', () => {
  const db = mk();
  const before = db.search({});
  assert.equal(db.hide([before.rows[0].id, before.rows[1].id]), 2);
  assert.equal(db.hide([before.rows[0].id]), 0); // 이미 숨김
  const after = db.search({});
  assert.equal(after.count, 1);
  assert.equal(after.total, before.total - before.rows[0].amount - before.rows[1].amount);
  assert.ok(db.get(before.rows[0].id)); // 행은 남아 있음
  assert.equal(db.add({ amount: 3000, sender: '100%_할인', balance: null, raw: 'c' }, new Date('2026-10-28T06:00:00Z')), null); // 같은 알림 재전송은 무시
});

test('메모 저장과 수동 처리 표시', () => {
  const db = mk();
  const r = db.search({}).rows[0];
  assert.equal(r.memo, '');
  assert.ok(db.setMemo(r.id, '이름 오기, 전화 확인 후 처리'));
  assert.ok(!db.setMemo(9999, 'x'));
  assert.equal(db.get(r.id).memo, '이름 오기, 전화 확인 후 처리');
  assert.ok(db.claim(r.id, 'A123', true));
  assert.ok(!db.claim(r.id, 'A124', false)); // 한 입금은 한 주문에만
  const again = db.search({}).rows.find((x) => x.id === r.id);
  assert.equal(again.order_id, 'A123');
  assert.equal(again.order_manual, 1);
  assert.equal(again.memo, '이름 오기, 전화 확인 후 처리');
});

test('candidates/all: 주문일자 검색용 조회', () => {
  const db = mk();
  const ids = (rows) => rows.map((r) => r.sender).sort();
  assert.deepEqual(ids(db.candidates({ names: ['강애진'], ranges: [], odIds: [] })), ['강애진']);
  assert.deepEqual(ids(db.candidates({ names: [], ranges: [[1000, 1000], [3000, 3000]], odIds: [] })), ['100%_할인', '김미희']);
  const k = db.search({}).rows.find((r) => r.sender === '김미희');
  db.claim(k.id, 'A55');
  assert.deepEqual(ids(db.candidates({ names: [], ranges: [], odIds: ['A55'] })), ['김미희']);
  assert.deepEqual(ids(db.candidates({ names: ['강애진'], ranges: [], odIds: [], q: '미' })), []); // q 와 함께 걸러짐
  assert.deepEqual(ids(db.candidates({ names: [], ranges: [[900, 1100], [2000, 2000]], odIds: [], q: '미' })), ['김미희']); // q 가 맞으면 남음
  assert.deepEqual(ids(db.candidates({ names: [], ranges: [[900, 1100], [2000, 2000]], odIds: [], q: '%' })), []); // LIKE 특수문자는 문자 그대로
  assert.deepEqual(ids(db.candidates({ names: [], ranges: [[950, 1050]], odIds: [] })), ['김미희']); // 금액 범위(환율 올림 오차 허용)
  assert.equal(db.all({ from: '2026-10-28', to: '2026-10-28' }).length, 2);
  assert.equal(db.all({}).length, 3);
  db.hide([k.id]);
  assert.equal(db.all({}).length, 2); // 숨김 제외
});
