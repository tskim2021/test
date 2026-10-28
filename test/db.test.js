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

test('푸시 따라잡기: 마지막 id 이후 입금, 처리 시각 이후 처리 내역', () => {
  const db = mk();
  const all = db.search({}).rows;
  const maxId = Math.max(...all.map((r) => r.id));
  assert.equal(db.maxId(), maxId);
  assert.equal(db.after(0).length, 3);
  assert.deepEqual(db.after(0).map((r) => r.id), all.map((r) => r.id).sort((a, b) => a - b)); // id 오름차순
  assert.equal(db.after(maxId).length, 0);
  assert.equal(db.after(maxId - 1).length, 1);
  const k = all.find((r) => r.sender === '김미희');
  db.claim(k.id, 'A77', true);
  db.setMemo(k.id, '사유');
  const procs = db.processedSince('1970-01-01T00:00:00.000Z');
  assert.equal(procs.length, 1);
  assert.deepEqual([procs[0].sender, procs[0].od_id, procs[0].manual, procs[0].memo], ['김미희', 'A77', 1, '사유']);
  assert.equal(db.processedSince(procs[0].at).length, 0); // 같은 시각 이후만
  assert.ok(db.after(0).find((r) => r.id === k.id).order_id === 'A77'); // 처리된 입금은 order_id 가 있어 서버가 알림에서 제외
});

test('푸시 발송 기록', () => {
  const db = mk();
  db.logPush({ event: 'deposit', depositId: 5, label: '박지은 35,900원', apps: 0, webs: 2 }, new Date('2026-10-28T09:31:00Z'));
  db.logPush({ event: 'processed', depositId: 5, label: '박지은 35,900원', apps: 1, webs: 2 }, new Date('2026-10-28T09:40:00Z'));
  const log = db.pushLog();
  assert.deepEqual(log.map((r) => [r.event, r.apps, r.webs]), [['processed', 1, 2], ['deposit', 0, 2]]); // 최신순
  assert.equal(log[1].label, '박지은 35,900원');
  assert.equal(db.pushLog(1).length, 1);
});

test('처리 완료 필터: 기본(hide)은 처리된 입금 제외, only 는 처리된 것만', () => {
  const db = mk();
  const all = db.search({}).rows;
  const k = all.find((r) => r.sender === '김미희');
  db.claim(k.id, 'A9');
  const hide = db.search({ done: 'hide' });
  assert.equal(hide.count, 2);
  assert.ok(!hide.rows.some((r) => r.id === k.id));
  assert.equal(hide.total, all.reduce((s, r) => s + r.amount, 0) - k.amount);
  const only = db.search({ done: 'only' });
  assert.deepEqual([only.count, only.total, only.rows[0].order_id], [1, k.amount, 'A9']);
  assert.equal(db.search({ done: 'all' }).count, 3);
  assert.equal(db.all({ done: 'only' }).length, 1);
  assert.equal(db.all({ done: 'hide' }).length, 2);
  assert.equal(db.candidates({ names: ['김미희'], ranges: [], odIds: [], done: 'hide' }).length, 0);
  assert.equal(db.candidates({ names: ['김미희'], ranges: [], odIds: [], done: 'only' }).length, 1);
});

test('search limit 0: 행 없이 건수/합계만(합계 카드용)', () => {
  const db = mk();
  const k = db.search({}).rows.find((r) => r.sender === '김미희');
  db.claim(k.id, 'A1');
  const p = db.search({ done: 'hide', limit: 0 });
  const d = db.search({ done: 'only', limit: 0 });
  assert.deepEqual([p.rows.length, p.count, p.total], [0, 2, 5000]);
  assert.deepEqual([d.rows.length, d.count, d.total, d.manual], [0, 1, 1000, 0]); // 자동(일치) 처리 1건
  const k2 = db.search({}).rows.find((r) => r.sender === '강애진');
  db.claim(k2.id, 'A2', true); // 수동 처리
  assert.deepEqual([db.search({ done: 'only', limit: 0 }).count, db.search({ done: 'only', limit: 0 }).manual], [2, 1]);
  const k3 = db.search({}).rows.find((r) => r.sender === '100%_할인');
  db.claim(k3.id, 'A3', 2); // 기처리 연결
  const st = db.search({ done: 'only', limit: 0 });
  assert.deepEqual([st.count, st.manual, st.linked], [3, 1, 1]);
  assert.equal(db.search({ done: 'only' }).rows.find((r) => r.id === k3.id).order_manual, 2);
});
