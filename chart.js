// 기간별 입금 금액 그래프용 집계. 시각은 모두 한국시간 기준.
//  - 하루 이하: 시간별(24칸) / 2~92일: 일별 / 그 이상: 월별
//  - 조회 기간이 없으면 최근 30일(일별)
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString(); // 'YYYY-MM-DDTHH:mm:ss.sssZ' 를 한국시간 값으로
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function buildChart(rows, { from, to, today }) {
  let f = from, t = to;
  if (!f && !t) { t = today; f = addDays(today, -29); }
  else if (!f) f = addDays(t, -29);
  else if (!t) t = f > today ? f : today;
  if (f > t) [f, t] = [t, f];
  if (Date.parse(t) - Date.parse(f) > 3650 * DAY) f = addDays(t, -3650); // 최대 10년
  const days = Math.round((Date.parse(t) - Date.parse(f)) / DAY) + 1;
  const unit = days <= 1 ? 'hour' : days <= 92 ? 'day' : 'month';

  const buckets = new Map();
  const make = (key, label, extra = {}) => buckets.set(key, { key, label, pending: 0, done: 0, count: 0, ...extra });
  if (unit === 'hour') {
    for (let h = 0; h < 24; h++) make(`${f} ${pad(h)}`, pad(h));
  } else if (unit === 'day') {
    for (let d = f; d <= t; d = addDays(d, 1)) {
      const [, m, dd] = d.split('-');
      make(d, d === f || dd === '01' ? `${+m}/${+dd}` : `${+dd}`, { date: d });
    }
  } else {
    let [y, m] = f.split('-').map(Number);
    const [ty, tm] = t.split('-').map(Number);
    while (y < ty || (y === ty && m <= tm)) {
      make(`${y}-${pad(m)}`, m === 1 || buckets.size === 0 ? `${String(y).slice(2)}.${m}` : `${m}월`);
      if (++m > 12) { m = 1; y++; }
    }
  }

  let pending = 0, done = 0, count = 0;
  for (const r of rows) {
    const k = kst(r.received_at);
    const key = unit === 'hour' ? `${k.slice(0, 10)} ${k.slice(11, 13)}` : unit === 'day' ? k.slice(0, 10) : k.slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    const side = r.order_id ? 'done' : 'pending';
    b[side] += r.amount;
    b.count++;
    if (side === 'done') done += r.amount; else pending += r.amount;
    count++;
  }
  return { unit, from: f, to: t, buckets: [...buckets.values()], totals: { pending, done, count } };
}
