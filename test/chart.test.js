import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChart } from '../chart.js';

const row = (iso, amount, order_id = null) => ({ received_at: iso, amount, order_id });

test('하루 조회: 시간별 24칸(한국시간), 처리/미처리 분리', () => {
  const c = buildChart([
    row('2026-10-28T01:10:00Z', 1000),           // KST 10:10
    row('2026-10-28T01:50:00Z', 2000, 'A1'),     // KST 10:50 (처리)
    row('2026-10-27T15:30:00Z', 500),            // KST 10-28 00:30
    row('2026-10-28T15:30:00Z', 999),            // KST 10-29 00:30 → 범위 밖
  ], { from: '2026-10-28', to: '2026-10-28', today: '2026-10-28' });
  assert.equal(c.unit, 'hour');
  assert.equal(c.buckets.length, 24);
  const b10 = c.buckets.find((b) => b.label === '10');
  assert.deepEqual([b10.pending, b10.done, b10.count], [1000, 2000, 2]);
  assert.equal(c.buckets[0].pending, 500);
  assert.deepEqual(c.totals, { pending: 1500, done: 2000, count: 3 });
});

test('여러 날 조회: 일별, 빈 날도 0으로 채움, 월 첫날/첫 칸은 월/일 표기', () => {
  const c = buildChart([row('2026-10-30T03:00:00Z', 100), row('2026-11-01T03:00:00Z', 300, 'A2')],
    { from: '2026-10-29', to: '2026-11-02', today: '2026-11-02' });
  assert.equal(c.unit, 'day');
  assert.deepEqual(c.buckets.map((b) => b.label), ['10/29', '30', '31', '11/1', '2']);
  assert.deepEqual(c.buckets.map((b) => b.pending + b.done), [0, 100, 0, 300, 0]);
});

test('기간 없음: 최근 30일, 한쪽만 있으면 30일/오늘까지', () => {
  assert.equal(buildChart([], { today: '2026-10-28' }).buckets.length, 30);
  assert.deepEqual([buildChart([], { today: '2026-10-28' }).from, buildChart([], { today: '2026-10-28' }).to], ['2026-09-29', '2026-10-28']);
  assert.equal(buildChart([], { from: '2026-10-20', today: '2026-10-28' }).buckets.length, 9);
  assert.equal(buildChart([], { to: '2026-10-28', today: '2026-10-28' }).buckets.length, 30);
});

test('긴 기간은 월별', () => {
  const c = buildChart([row('2026-02-10T03:00:00Z', 700)], { from: '2025-11-15', to: '2026-04-02', today: '2026-04-02' });
  assert.equal(c.unit, 'month');
  assert.deepEqual(c.buckets.map((b) => b.label), ['25.11', '12월', '26.1', '2월', '3월', '4월']);
  assert.equal(c.buckets.find((b) => b.key === '2026-02').pending, 700);
});

test('from > to 이면 뒤집어서 처리', () => {
  const c = buildChart([], { from: '2026-10-28', to: '2026-10-26', today: '2026-10-28' });
  assert.deepEqual([c.from, c.to, c.buckets.length], ['2026-10-26', '2026-10-28', 3]);
});
