import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { openDb, isDate } from './db.js';
import { parseNotification } from './parser.js';
import { createShop, orderKeys, relatedDepositIds } from './shop.js';
import { buildChart } from './chart.js';
import { createApns, isDeadToken, pushMessage } from './apns.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const API_TOKEN = process.env.API_TOKEN; // 폰 -> 서버 전송용
const VIEW_TOKEN = process.env.VIEW_TOKEN || API_TOKEN; // 대시보드 열람용
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // 주문 확인/입금 처리 권한(없으면 해당 기능 비활성)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!API_TOKEN) {
  console.error('API_TOKEN 환경변수를 설정하세요. 예: API_TOKEN=$(openssl rand -hex 24) npm start');
  process.exit(1);
}

const db = openDb();
const shop = await createShop();

// 자동 처리: 입금자명·금액이 쇼핑몰의 미입금 주문 '한 건'과 정확히 같으면 사람이 누르지 않아도 입금 처리한다. AUTO_PROCESS=0 으로 끈다.
const AUTO_PROCESS = process.env.AUTO_PROCESS !== '0';
// 이 기능을 켜기 전에 이미 들어와 있던 입금은 자동 처리하지 않는다(AUTO_PROCESS_BACKFILL=1 이면 포함).
if (!db.getMeta('auto_since')) db.setMeta('auto_since', process.env.AUTO_PROCESS_BACKFILL === '1' ? '1970-01-01T00:00:00.000Z' : new Date().toISOString());
shop?.ping().then((n) => console.log(`쇼핑몰 DB 연결 확인: 주문 ${n}건`)).catch((e) => console.error('쇼핑몰 DB 연결 실패:', e.message));
// 주문일자/전체 검색: 쇼핑몰 주문 시각이 기간에 드는 주문과 관계(이름·금액·연결)가 있는 입금을 모은다.
// field='all' 이면 입금 시각이 기간에 드는 입금도 합친다.
async function orderDateRows({ field, from, to, q, done }) {
  const orders = await shop.ordersInRange(from, to);
  const rate = (await shop.getRate())?.rate || null;
  const { names, ranges, odIds } = orderKeys(orders, rate);
  const cand = db.candidates({ q, done, names: [...names], ranges, odIds: [...odIds] });
  const related = relatedDepositIds(orders, cand, rate);
  const rows = cand.filter((d) => related.has(d.id));
  if (field === 'all') {
    const have = new Set(rows.map((r) => r.id));
    for (const d of db.all({ from, to, q, done })) if (!have.has(d.id)) rows.push(d);
  }
  return rows.sort((a, b) => b.received_at.localeCompare(a.received_at) || b.id - a.id);
}
// 반환: 자동 처리한 주문번호, 아니면 null(후보가 없거나 여러 건이거나 금액이 정확히 같지 않으면 사람이 확인)
async function autoProcess(row) {
  if (!AUTO_PROCESS || !shop || !ADMIN_TOKEN) return null;
  if (String(row.sender || '').startsWith('[테스트]')) return null; // 가짜 입금은 절대 자동 처리하지 않는다
  const related = await shop.relatedFor({ sender: row.sender, amount: row.amount });
  if (related.full.length !== 1) return null;
  const o = related.full[0];
  if ((o.od_misu_krw ?? o.od_misu) !== row.amount) return null; // 허용 오차(±100원) 안이어도 자동은 정확히 같을 때만
  if (!db.claim(row.id, o.od_id, 0)) return null;
  const note = `입금 ${row.sender || '(입금자 미확인)'} ${row.amount.toLocaleString('ko-KR')}원 확인 → ${shop.statusPaid} 처리 (자동)`;
  try {
    await shop.confirm(o.od_id, { expectKrw: row.amount, note });
  } catch (e) {
    db.release(row.id);
    console.error(`자동 처리 실패(입금 #${row.id} → 주문 ${o.od_id}):`, e.message);
    return null;
  }
  console.log(`자동 처리: 입금 #${row.id} ${row.sender} ${row.amount}원 → 주문 ${o.od_id}`);
  broadcast('processed', { id: row.id, sender: row.sender, amount: row.amount, od_id: o.od_id, kind: 0, manual: false, linked: false, auto: true, memo: '', at: new Date().toISOString() });
  return o.od_id;
}

// 놓친 입금(주문이 입금보다 늦게 들어온 경우, 쇼핑몰 DB 일시 장애 등)을 주기적으로 다시 확인한다.
let sweeping = false;
async function sweepAuto() {
  if (sweeping || !AUTO_PROCESS || !shop || !ADMIN_TOKEN) return;
  sweeping = true;
  try {
    for (const r of db.unprocessedSince(db.getMeta('auto_since'), 100)) await autoProcess(r);
  } catch (e) { console.error('자동 처리 점검 실패:', e.message); } finally { sweeping = false; }
}
if (AUTO_PROCESS && shop) setInterval(sweepAuto, Number(process.env.AUTO_SWEEP_MS || 60_000)).unref();

const isAdmin = (req, url) => !!ADMIN_TOKEN && safeEq(tokenOf(req, url), ADMIN_TOKEN);
// 관리자 토큰은 열람 권한도 포함한다(앱에 관리자 토큰 하나만 넣어도 되게).
const canView = (req, url) => safeEq(tokenOf(req, url), VIEW_TOKEN) || isAdmin(req, url);
const clients = new Map(); // res -> { app: 앱(PushService)의 연결이면 true, 웹 화면이면 false }
const clientCounts = () => { let app = 0, web = 0; for (const v of clients.values()) v.app ? app++ : web++; return { app, web }; };

const safeEq = (a = '', b = '') => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const tokenOf = (req, url) =>
  (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';

const json = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20_000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

let apns = null;
try {
  apns = createApns({ keyPath: process.env.APNS_KEY_PATH, keyId: process.env.APNS_KEY_ID, teamId: process.env.APNS_TEAM_ID, topic: process.env.APNS_TOPIC });
} catch (e) { console.error('APNs 설정 오류:', e.message); }

// iPhone 으로 푸시. 실패는 서버 동작에 영향 없게 삼키고, 폐기된 토큰은 지운다.
async function sendApns(event, payload) {
  const m = apns && pushMessage(event, payload);
  if (!m) return;
  for (const t of db.apnsTokens()) {
    const r = await apns.send(t.token, !!t.sandbox, m);
    if (!r.ok) {
      console.error('APNs 실패:', r.status, r.reason);
      if (isDeadToken(r)) db.removeApnsToken(t.token);
    }
  }
}

function broadcast(event, payload) {
  sendApns(event, payload).catch((e) => console.error('APNs 오류:', e.message));
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients.keys()) c.write(msg);
  // 보낼 때 폰 앱이 연결돼 있었는지 기록한다(나중에 "푸시가 갔나?"를 확인하기 위해). 연결이 없었다면 앱은 재연결 때 따라잡는다.
  try {
    const { app, web } = clientCounts();
    const who = payload.sender ? `${payload.sender} ${Number(payload.amount || 0).toLocaleString('ko-KR')}원` : '';
    db.logPush({ event: payload.kind && payload.kind !== 'basic' ? `${event}(${payload.kind})` : event, depositId: payload.id ?? null, label: who, apps: app, webs: web });
  } catch (e) { console.error('푸시 기록 실패:', e.message); }
}

// 새 입금이 '처리 필요'인지 알리기 위한 일치 수준(쇼핑몰 미연동이면 null)
async function levelOf(row) {
  if (!shop || !ADMIN_TOKEN) return null;
  try { return (await shop.matchLevels([row])).get(row.id) || null; } catch { return null; }
}

async function notifyTelegram(row) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const text = `💰 입금 ${row.amount.toLocaleString('ko-KR')}원${row.sender ? ` · ${row.sender}` : ''}`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    console.error('telegram 전송 실패:', e.message);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    // 폰이 알림을 보내는 엔드포인트. JSON {title,text} 또는 text/plain 본문 모두 허용(Tasker/MacroDroid 편의).
    if (req.method === 'POST' && url.pathname === '/api/notify') {
      if (!safeEq(tokenOf(req, url), API_TOKEN)) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req);
      let payload;
      try { payload = JSON.parse(body); } catch { payload = { text: body }; }
      const parsed = parseNotification({ title: payload.title, text: payload.text });
      if (!parsed) return json(res, 200, { ok: true, ignored: true });
      const row = db.add(parsed);
      if (!row) return json(res, 200, { ok: true, duplicate: true });
      let autoOd = null;
      try { autoOd = await autoProcess(row); } catch (e) { console.error('자동 처리 오류:', e.message); }
      // 자동 처리됐으면 '처리 필요'가 아니라 '처리 완료'만 알린다(autoProcess 안에서 발송).
      if (!autoOd) broadcast('deposit', { ...row, match_level: await levelOf(row), shop: !!shop && !!ADMIN_TOKEN });
      notifyTelegram(row);
      return json(res, 200, { ok: true, id: row.id, auto_processed: autoOd });
    }

    // 입금 직접 입력(관리자 전용): 알림을 자동으로 받지 못하는 계좌(iPhone)의 입금을 넣는다.
    if (req.method === 'POST' && url.pathname === '/api/deposits/manual') {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'unauthorized' });
      let b; try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
      const sender = String(b.sender || '').trim().slice(0, 30);
      const amount = Number(b.amount);
      if (!sender || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) return json(res, 400, { error: '입금자와 금액을 확인하세요' });
      const row = db.add({ amount, sender, balance: null, raw: `[직접입력] ${sender} ${amount}원 ${Date.now()}` });
      db.setMemo(row.id, '직접 입력');
      // 자동 처리는 하지 않는다(관리자가 목록에서 주문확인으로 처리). 일치 수준만 붙여 '처리 필요'로 알린다.
      const level = await levelOf(row);
      broadcast('deposit', { ...row, memo: '직접 입력', match_level: level, shop: !!shop && !!ADMIN_TOKEN });
      return json(res, 200, { ok: true, id: row.id, match_level: level });
    }

    // 가짜 입금 테스트(관리자 전용): /test-deposit?token=관리자토큰&amount=1000&sender=테스트
    // 실제 주문이 처리되지 않도록 자동 처리·텔레그램은 건너뛰고, 입금자 앞에 [테스트] 를 붙이고 메모에 표시한다. 목록에서 선택삭제로 숨기면 된다.
    if (req.method === 'GET' && url.pathname === '/test-deposit') {
      res.setHeader('cache-control', 'no-store');
      const send = (code, h, p) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>가짜 입금</title><body style="font:17px/1.6 -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:20px;max-width:560px;margin:0 auto"><h2>${h}</h2><p>${p}</p></body>`); };
      if (!isAdmin(req, url)) return send(401, '❌ 관리자 토큰이 필요합니다', '주소 끝의 <code>?token=</code> 뒤에 ADMIN_TOKEN 을 넣어 주세요.');
      const q = url.searchParams;
      const amount = Number(q.get('amount') || 1000);
      if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) return send(400, '❌ 금액이 올바르지 않습니다', '');
      const name = (q.get('sender') || '가짜입금').replace(/[<>&"']/g, '').slice(0, 20);
      const row = db.add({ amount, sender: `[테스트]${name}`, balance: null, raw: `[테스트] 가짜 입금 ${amount}원 ${name} ${Date.now()}` });
      db.setMemo(row.id, '가짜 입금(테스트) · 실제 입금 아님');
      broadcast('deposit', { ...db.get(row.id), match_level: null, shop: false });
      return send(200, '✅ 가짜 입금을 만들었습니다', `[테스트]${name} · ${amount.toLocaleString('ko-KR')}원<br>목록과 폰/iPhone 알림을 확인하세요. 자동 처리는 하지 않습니다. 확인 후 목록에서 <b>선택삭제</b>로 숨기면 됩니다.<br>이 페이지를 새로고침하면 한 건 더 만들어집니다.`);
    }

    // 앱의 '연결 테스트'용. 토큰만 확인하고 아무것도 저장하지 않는다.
    if (req.method === 'GET' && url.pathname === '/api/ping') {
      if (!safeEq(tokenOf(req, url), API_TOKEN)) return json(res, 401, { error: 'unauthorized' });
      return json(res, 200, { ok: true });
    }

    // 그래프: 같은 조회 조건(기간·일자 기준·입금자)의 시간별/일별/월별 입금 금액(미처리/처리완료 구분)
    if (req.method === 'GET' && url.pathname === '/api/deposits/chart') {
      if (!canView(req, url)) return json(res, 401, { error: 'unauthorized' });
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      if ((from && !isDate(from)) || (to && !isDate(to))) return json(res, 400, { error: 'invalid date' });
      const q = (url.searchParams.get('q') || '').trim().slice(0, 50);
      const field = ['all', 'order', 'paid'].includes(url.searchParams.get('datefield')) ? url.searchParams.get('datefield') : 'paid';
      let rows = null;
      if (field !== 'paid' && shop && ADMIN_TOKEN && (from || to)) {
        try { rows = await orderDateRows({ field, from, to, q, done: 'all' }); } catch (e) { console.error('그래프 주문일자 조회 실패:', e.message); }
      }
      if (!rows) rows = db.all({ from, to, q, done: 'all', limit: 50000 });
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      return json(res, 200, buildChart(rows, { from, to, today }));
    }

    // 조회: ?from=YYYY-MM-DD&to=YYYY-MM-DD&q=입금자&limit=10|20|50|100&page=1  (날짜는 한국시간 기준)
    if (req.method === 'GET' && url.pathname === '/api/deposits') {
      if (!canView(req, url)) return json(res, 401, { error: 'unauthorized' });
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      if ((from && !isDate(from)) || (to && !isDate(to))) return json(res, 400, { error: 'invalid date' });
      const limit = [10, 20, 50, 100].includes(Number(url.searchParams.get('limit'))) ? Number(url.searchParams.get('limit')) : 20;
      const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1);
      const q = (url.searchParams.get('q') || '').trim().slice(0, 50);
      // datefield: paid=결제일자(입금 받은 날, 기본), order=주문일자(쇼핑몰 주문 시각), all=전체(둘 중 하나라도)
      const done = url.searchParams.get('done') === 'only' ? 'only' : 'hide'; // 처리 완료된 입금: 기본 숨김, done=only 면 그것만
      const field = ['all', 'order', 'paid'].includes(url.searchParams.get('datefield')) ? url.searchParams.get('datefield') : 'paid';
      let rows, count, total, stats;
      let matchError = null;
      const sum = (list) => ({ count: list.length, total: list.reduce((a, r) => a + r.amount, 0), auto: list.filter((r) => r.order_id && r.order_manual === 0).length, manual: list.filter((r) => r.order_manual === 1).length, linked: list.filter((r) => r.order_manual === 2).length, matched: list.filter((r) => r.order_manual === 3).length });
      if (field !== 'paid' && shop && ADMIN_TOKEN && (from || to)) {
        try {
          // 주문일자/전체 기준: 조건에 맞는 입금을 전부 모아 미처리/처리완료로 나눈다.
          const all = await orderDateRows({ field, from, to, q, done: 'all' });
          const pend = all.filter((r) => !r.order_id);
          const dn = all.filter((r) => r.order_id);
          const view = done === 'only' ? dn : pend;
          count = view.length;
          total = view.reduce((a, r) => a + r.amount, 0);
          rows = view.slice((page - 1) * limit, page * limit);
          stats = { pending: sum(pend), done: sum(dn) };
        } catch (e) { matchError = '주문일자 조회 실패: ' + e.message; console.error(matchError); }
      }
      if (!rows) {
        ({ rows, count, total } = db.search({ from, to, q, done, limit, offset: (page - 1) * limit }));
        // 위쪽 합계 카드용: 표시(처리완료만 보기 여부)와 상관없이 같은 기간/검색 조건의 미처리·처리완료 현황
        const p2 = db.search({ from, to, q, done: 'hide', limit: 0 });
        const d2 = db.search({ from, to, q, done: 'only', limit: 0 });
        stats = { pending: { count: p2.count, total: p2.total, auto: 0, manual: 0, linked: 0, matched: 0 }, done: { count: d2.count, total: d2.total, auto: d2.auto, manual: d2.manual, linked: d2.linked, matched: d2.matched } };
      }
      let levels = new Map();
      if (shop && ADMIN_TOKEN) {
        try { levels = await shop.matchLevels(rows.filter((r) => !r.order_id)); } catch (e) { matchError = '주문 매칭 조회 실패: ' + e.message; console.error(matchError); }
      }
      let orderItems = {};
      let orderUsd = {};
      if (shop && ADMIN_TOKEN) {
        const ids = [...new Set(rows.filter((r) => r.order_id).map((r) => r.order_id))];
        try { orderItems = await shop.itemsByOrder(ids); orderUsd = await shop.ordersUsd(ids); } catch (e) { console.error('주문 상품 조회 실패:', e.message); }
      }
      const deposits = rows.map((r) => ({ ...r, match_level: levels.get(r.id) || null, order_items: r.order_id ? orderItems[r.order_id] || [] : undefined, order_usd: r.order_id ? orderUsd[r.order_id]?.usd ?? null : undefined, order_time: r.order_id ? orderUsd[r.order_id]?.time ?? null : undefined }));
      let rateInfo = null;
      if (shop && ADMIN_TOKEN) { try { rateInfo = await shop.getRate(); } catch { /* 환율 없이 표시 */ } }
      return json(res, 200, { deposits, count, total, stats, page, limit, pages: Math.max(1, Math.ceil(count / limit)), shop: !!shop && !!ADMIN_TOKEN, admin: !!ADMIN_TOKEN, currency: shop?.currency ?? null, rate: rateInfo, match_error: matchError });
    }

    // 쇼핑몰 점검(관리자): 쇼핑몰이 쓰는 주문 상태 값, 관리자가 직접 처리한 주문 vs 이 모니터가 처리한 주문의 DB 값 비교
    if (req.method === 'GET' && url.pathname === '/shop-check') {
      res.setHeader('cache-control', 'no-store');
      if (!isAdmin(req, url)) { res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('unauthorized'); }
      if (!shop) return json(res, 503, { error: '쇼핑몰 DB가 설정되지 않았습니다' });
      const monitorIds = db.processedSince('1970-01-01T00:00:00.000Z', 200).map((r) => r.od_id).slice(-20);
      const data = await shop.check(monitorIds);
      if (url.searchParams.get('format') === 'json') return json(res, 200, data);
      const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const tbl = (rows, cols) => `<table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">없음</td></tr>`}</table>`;
      const oc = ['od_id', 'od_status', 'cart_status', 'od_settle_case', 'od_misu', 'od_receipt_price', 'od_receipt_time', 'od_time', 'has_shop_memo'];
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쇼핑몰 점검</title>
<style>body{font:15px/1.5 -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:16px;max-width:1000px;margin:0 auto}table{border-collapse:collapse;margin:6px 0 18px}th,td{border:1px solid #ddd;padding:5px 9px;text-align:left;font-size:13px}th{background:#f3f4f6}</style>
<h2>쇼핑몰 점검 (읽기 전용)</h2>
<p>자동 처리(이름·금액 정확히 일치 + 주문 1건): <b>${AUTO_PROCESS ? '켜짐' : '꺼짐'}</b>${AUTO_PROCESS ? ` (${esc(db.getMeta('auto_since'))} 이후 입금부터)` : ''}<br>이 모니터가 입금 처리 시 쓰는 상태: <b>${esc(data.status_paid_setting)}</b> · 상점메모(od_shop_memo) 컬럼: <b>${data.has_shop_memo_column ? '있음 (처리 흔적을 남김)' : '없음'}</b></p>
<h3>주문 상태(od_status)별 건수</h3>${tbl(data.order_statuses, ['s', 'n'])}
<h3>장바구니 상태(ct_status)별 건수</h3>${tbl(data.cart_statuses, ['s', 'n'])}
<h3>쇼핑몰 관리자가 직접 처리한 최근 주문</h3>${tbl(data.processed_by_shop_admin, oc)}
<h3>이 모니터가 처리한 최근 주문</h3>${tbl(data.processed_by_monitor, oc)}
<p>두 표의 <b>od_status, cart_status, od_receipt_price, od_receipt_time</b>이 같은 모양이면 관리자 처리와 같은 결과입니다.</p></html>`);
    }

    // 푸시 발송 기록 조회: /push-log?token=접속토큰  (&format=json 도 가능)
    if (req.method === 'GET' && url.pathname === '/push-log') {
      res.setHeader('cache-control', 'no-store');
      if (!canView(req, url)) { res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('unauthorized'); }
      const rows = db.pushLog(200);
      if (url.searchParams.get('format') === 'json') return json(res, 200, { push_log: rows });
      const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const kst = (iso) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const names = { deposit: '💰 새 입금(처리 필요)', processed: '✅ 처리 완료', test: '🔔 테스트' };
      const kindOf = (e) => (names[e.replace(/\(.*\)/, '')] || e) + (e.includes('(') ? ' ' + e.match(/\((.*)\)/)[1] : '');
      const { app, web } = clientCounts();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>푸시 발송 기록</title>
<style>body{font:15px/1.5 -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:16px;max-width:860px;margin:0 auto}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:7px 6px;text-align:left;vertical-align:top}th{font-size:13px;color:#666}.ok{color:#1f9d55;font-weight:700}.bad{color:#c0392b;font-weight:700}small{color:#666}</style>
<h2>푸시 발송 기록</h2>
<p>지금 연결: 폰 앱 <b>${app}개</b> · 웹 화면 <b>${web}개</b><br><small>앱이 연결돼 있을 때 보낸 푸시는 실시간으로 전달됩니다. 앱 연결이 0개였다면 그 푸시는 바로 가지 못하고, 앱이 다시 연결될 때 따라잡아 알려 줍니다(처리 필요 5건 초과 시 요약 1건).</small></p>
<table><tr><th>시각</th><th>종류</th><th>내용</th><th>보낼 때 앱 연결</th><th>웹</th><th>판정</th></tr>
${rows.map((r) => `<tr><td>${esc(kst(r.at))}</td><td>${esc(kindOf(r.event))}</td><td>${esc(r.label)}</td><td>${r.apps}개</td><td>${r.webs}개</td><td class="${r.apps > 0 ? 'ok' : 'bad'}">${r.apps > 0 ? '앱으로 전송됨' : '앱 미연결 → 재연결 시 전달'}</td></tr>`).join('') || '<tr><td colspan="6">아직 기록이 없습니다 (이 기능을 반영한 이후의 푸시부터 기록됩니다)</td></tr>'}
</table></html>`);
    }

    // 푸시 테스트 링크: 브라우저로 열면 테스트 푸시를 보내고 결과 화면을 보여 준다.
    //   /push-test?token=접속토큰                                  → 기본 테스트
    //   /push-test?token=…&kind=needs&sender=홍길동&amount=35900&level=full  → '처리 필요' 예시
    //   /push-test?token=…&kind=done&sender=홍길동&amount=35900&manual=1&memo=사유 → '처리 완료' 예시
    // 입금 기록을 만들지 않고, 앱의 '이미 알린 입금' 기준(id)에도 영향을 주지 않는 'test' 이벤트로만 보낸다.
    if (req.method === 'GET' && url.pathname === '/push-test') {
      res.setHeader('cache-control', 'no-store');
      const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const page = (status, body) => {
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>푸시 테스트</title>
<body style="font:17px/1.6 -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:20px;max-width:560px;margin:0 auto">${body}</body></html>`);
      };
      if (!canView(req, url)) {
        return page(401, '<h2>❌ 토큰이 올바르지 않습니다</h2><p>주소 끝의 <code>?token=</code> 뒤에 접속 토큰을 넣어 주세요.</p>');
      }
      const q = url.searchParams;
      const kind = ['needs', 'done'].includes(q.get('kind')) ? q.get('kind') : 'basic';
      const sender = (q.get('sender') ?? '홍길동').slice(0, 20);
      const amount = Number.isInteger(Number(q.get('amount'))) && Number(q.get('amount')) > 0 ? Number(q.get('amount')) : 35900;
      const level = ['full', 'name', 'amount', 'other', 'none'].includes(q.get('level')) ? q.get('level') : 'full';
      const manual = q.get('manual') === '1';
      const memo = (q.get('memo') ?? '').slice(0, 100);
      const payload = { at: new Date().toISOString(), kind };
      if (kind === 'needs') Object.assign(payload, { sender, amount, shop: true, match_level: level === 'none' ? null : level });
      if (kind === 'done') Object.assign(payload, { sender, amount, od_id: 'A-TEST-0001', manual, memo });
      broadcast('test', payload);
      const { app, web } = clientCounts();
      const iphones = apns ? db.apnsTokens().length : 0;
      const tok = esc(tokenOf(req, url));
      const label = { basic: '기본 테스트', needs: `처리 필요 예시 (${sender} ${amount.toLocaleString('ko-KR')}원)`, done: `처리 완료 예시 (${sender} ${amount.toLocaleString('ko-KR')}원)` }[kind];
      const btn = 'display:inline-block;padding:9px 14px;margin:4px 6px 4px 0;border:1px solid #1f9d55;border-radius:10px;color:#1f9d55;text-decoration:none;font-size:15px';
      return page(200, `
<h2>${app > 0 || iphones > 0 ? '✅ 테스트 푸시를 보냈습니다' : '⚠️ 폰 앱의 푸시 연결이 없습니다'}</h2>
<p>보낸 것: <b>${esc(label)}</b><br>안드로이드 앱 푸시 연결: <b>${app}개</b> · iPhone: <b>${iphones}대</b> · 열려 있는 웹 화면: <b>${web}개</b></p>
<p>${iphones > 0 && app === 0
  ? 'iPhone 에 <b>[테스트]</b> 알림이 와야 합니다. 오지 않으면 iPhone 설정 → 알림 → 입금 모니터에서 알림 허용과 집중 모드를 확인하세요.'
  : app > 0
  ? '폰에 알림이 와야 합니다(제목 앞에 <b>[테스트]</b>가 붙습니다). 오지 않으면 앱 <b>설정 탭의 로그</b>를 보세요: <b>"푸시 수신"</b>이 있는데 알림이 안 떴다면 폰의 알림 차단 문제, 로그에 아무것도 없다면 연결 문제입니다.'
  : '웹 화면은 연결돼 있지만 <b>폰 앱</b>은 서버에 연결돼 있지 않습니다. 앱을 <b>최신 APK</b>로 업데이트하고 설정 탭에서 <b>푸시 연결: 실시간 연결됨</b>인지 확인하세요. (앱이 예전 버전이면 앱 연결도 웹 화면으로 센다)'}</p>
<p><a style="${btn}" href="?token=${tok}">기본</a>
<a style="${btn}" href="?token=${tok}&kind=needs&sender=홍길동&amount=35900&level=full">처리 필요 · 일치</a>
<a style="${btn}" href="?token=${tok}&kind=needs&sender=김철수&amount=825400&level=name">처리 필요 · 이름만</a>
<a style="${btn}" href="?token=${tok}&kind=needs&sender=모르는사람&amount=9999&level=none">처리 필요 · 주문 없음</a>
<a style="${btn}" href="?token=${tok}&kind=done&sender=홍길동&amount=35900">처리 완료</a>
<a style="${btn}" href="?token=${tok}&kind=done&sender=김철수&amount=825400&manual=1&memo=환율%20차이%20확인">처리 완료 · 수동</a></p>
<hr><form method="get"><input type="hidden" name="token" value="${tok}">
<p>직접 보내기<br>
<select name="kind"><option value="needs">처리 필요</option><option value="done">처리 완료</option></select>
<input name="sender" value="${esc(sender)}" size="8" placeholder="입금자"> <input name="amount" value="${amount}" size="8" inputmode="numeric" placeholder="금액">
<select name="level"><option value="full">이름·금액 일치</option><option value="name">이름만</option><option value="amount">금액만</option><option value="other">이미 처리된 주문</option><option value="none">일치 없음</option></select>
<button>보내기</button></p></form>`);
    }

    // 푸시 테스트: 입금 기록을 만들지 않고, 연결된 앱/웹에 테스트 이벤트만 보낸다. listeners = 지금 연결된 수신기 수.
    if (req.method === 'POST' && url.pathname === '/api/push/test') {
      if (!canView(req, url)) return json(res, 401, { error: 'unauthorized' });
      broadcast('test', { at: new Date().toISOString() });
      const cc = clientCounts();
      return json(res, 200, { ok: true, listeners: cc.app + cc.web, apps: cc.app, webs: cc.web });
    }

    // iPhone 앱이 APNs 기기 토큰을 등록한다. sandbox=true 는 Xcode 직접 설치(개발) 빌드, TestFlight/App Store 는 false.
    if (req.method === 'POST' && url.pathname === '/api/apns/register') {
      if (!canView(req, url)) return json(res, 401, { error: 'unauthorized' });
      let b; try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
      if (!/^[0-9a-fA-F]{32,200}$/.test(b.token || '')) return json(res, 400, { error: 'bad token' });
      db.addApnsToken(b.token.toLowerCase(), !!b.sandbox);
      return json(res, 200, { ok: true, enabled: !!apns });
    }

    // 앱 푸시 따라잡기: 연결이 끊긴 사이의 '처리 필요'(새 입금)와 '처리 완료'를 돌려준다.
    // ?deposit=마지막으로 본 입금 id&processed=마지막으로 본 처리 시각(ISO). 둘 다 없으면 기준점(max_id, now)만 돌려준다.
    if (req.method === 'GET' && url.pathname === '/api/push/since') {
      if (!canView(req, url)) return json(res, 401, { error: 'unauthorized' });
      const out = { max_id: db.maxId(), now: new Date().toISOString(), deposits: [], processed: [] };
      const dep = url.searchParams.get('deposit');
      const proc = url.searchParams.get('processed');
      if (dep !== null && /^\d+$/.test(dep)) {
        const rows = db.after(Number(dep), 50).filter((r) => !r.order_id); // 이미 처리된 입금은 아래 processed 로 알린다
        let levels = new Map();
        if (shop && ADMIN_TOKEN) { try { levels = await shop.matchLevels(rows); } catch { /* 일치 수준 없이 알림 */ } }
        out.deposits = rows.map((r) => ({ id: r.id, sender: r.sender, amount: r.amount, received_at: r.received_at, match_level: levels.get(r.id) || null, shop: !!shop && !!ADMIN_TOKEN }));
      }
      if (proc && !Number.isNaN(Date.parse(proc))) out.processed = db.processedSince(proc, 50);
      return json(res, 200, out);
    }

    // 선택 삭제: DB에서 지우지 않고 목록에서만 숨긴다(hidden=1) — 관리자 전용
    if (req.method === 'POST' && url.pathname === '/api/deposits/hide') {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'unauthorized' });
      let ids;
      try { ids = JSON.parse(await readBody(req)).ids; } catch { ids = null; }
      if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every((n) => Number.isInteger(n) && n > 0)) return json(res, 400, { error: 'ids 필요(최대 200개)' });
      return json(res, 200, { ok: true, hidden: db.hide(ids) });
    }

    // 입금 1건에 대한 주문 후보(입금자명+금액 일치)와 장바구니 상품 조회 — 관리자 전용
    let m;
    if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/deposits\/(\d+)\/matches$/))) {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'unauthorized' });
      if (!shop) return json(res, 503, { error: '쇼핑몰 DB가 설정되지 않았습니다' });
      const deposit = db.get(Number(m[1]));
      if (!deposit) return json(res, 404, { error: 'not found' });
      const confirmed = db.matchedOrder(deposit.id);
      const related = confirmed ? { full: [], name: [], amount: [], other: [] } : await shop.relatedFor({ sender: deposit.sender, amount: deposit.amount });
      return json(res, 200, { deposit: { id: deposit.id, sender: deposit.sender, amount: deposit.amount, received_at: deposit.received_at, memo: deposit.memo }, confirmed_order: confirmed, currency: shop.currency, rate: await shop.getRate(), candidates: related.full, related: { name: related.name, amount: related.amount, other: related.other } });
    }

    // 메모(처리 사유 등) 저장 — 관리자 전용
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/deposits\/(\d+)\/memo$/))) {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'unauthorized' });
      let memo;
      try { memo = JSON.parse(await readBody(req)).memo; } catch { memo = null; }
      if (typeof memo !== 'string' || memo.length > 500) return json(res, 400, { error: '메모는 500자 이내 문자열' });
      if (!db.setMemo(Number(m[1]), memo.trim())) return json(res, 404, { error: 'not found' });
      return json(res, 200, { ok: true, memo: memo.trim() });
    }

    // 관리자 '주문완료'. 이름·금액이 모두 일치하면 바로, 일치하지 않는 주문(이름만/금액만)은 메모(사유)를 적어야 수동 처리된다.
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/deposits\/(\d+)\/confirm$/))) {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'unauthorized' });
      if (!shop) return json(res, 503, { error: '쇼핑몰 DB가 설정되지 않았습니다' });
      const deposit = db.get(Number(m[1]));
      if (!deposit) return json(res, 404, { error: 'not found' });
      let body;
      try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
      const odId = String(body.od_id || '');
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(odId)) return json(res, 400, { error: 'od_id 필요' });
      const related = await shop.relatedFor({ sender: deposit.sender, amount: deposit.amount });
      const exact = related.full.some((o) => o.od_id === odId);
      const manual = !exact && [...related.name, ...related.amount].some((o) => o.od_id === odId);
      const linked = !exact && !manual && related.other.some((o) => o.od_id === odId); // 쇼핑몰에서 이미 처리된 주문(상태 변경 없이 연결만)
      if (!exact && !manual && !linked) return json(res, 409, { error: '이 입금과 관련된 주문이 아닙니다' });
      if (manual || linked) {
        const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
        if (!memo) return json(res, 400, { error: linked ? '이미 처리된 주문과 연결하려면 처리 사유(메모)를 입력해야 합니다' : '이름·금액이 일치하지 않는 주문은 처리 사유(메모)를 입력해야 합니다' });
        if (memo.length > 500) return json(res, 400, { error: '메모는 500자 이내' });
        db.setMemo(deposit.id, memo);
      } else if (typeof body.memo === 'string' && body.memo.trim()) {
        db.setMemo(deposit.id, body.memo.trim().slice(0, 500));
      }
      const kind = linked ? 2 : manual ? 1 : 3; // 3 = 일치처리(관리자가 일치 건을 확인하고 처리)
      if (!db.claim(deposit.id, odId, kind)) return json(res, 409, { error: '이미 처리된 입금이거나 이미 연결된 주문입니다' });
      const memoNow = db.get(deposit.id).memo;
      try {
        if (linked) {
          // 주문 상태는 그대로 두고 상점메모에만 흔적을 남긴다(관리자 화면에서 확인용). 실패해도 연결 자체는 유지.
          const st = related.other.find((o) => o.od_id === odId).od_status;
          const note = `입금 ${deposit.sender || '(입금자 미확인)'} ${deposit.amount.toLocaleString('ko-KR')}원 확인 → 이미 '${st}' 상태인 주문과 연결(상태 변경 없음)${memoNow ? ': ' + memoNow : ''}`;
          try { await shop.appendNote(odId, note); } catch (e) { console.error('상점메모 기록 실패:', e.message); }
        } else {
          const note = `입금 ${deposit.sender || '(입금자 미확인)'} ${deposit.amount.toLocaleString('ko-KR')}원 확인 → ${shop.statusPaid} 처리${manual ? ' (수동)' : ''}${memoNow ? ': ' + memoNow : ''}`;
          await shop.confirm(odId, { expectKrw: manual ? null : deposit.amount, note });
        }
      } catch (e) {
        db.release(deposit.id);
        return json(res, e.status || 500, { error: e.status ? e.message : '주문 처리 중 오류' });
      }
      broadcast('processed', { id: deposit.id, sender: deposit.sender, amount: deposit.amount, od_id: odId, kind, manual: kind === 1, linked: kind === 2, memo: memoNow, at: new Date().toISOString() });
      return json(res, 200, { ok: true, od_id: odId, manual, linked });
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      if (!canView(req, url)) return json(res, 401, { error: 'unauthorized' });
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      req.socket.setKeepAlive(true, 15_000); // 중간에서 죽은 연결을 빨리 알아채도록
      req.socket.setNoDelay(true);
      clients.set(res, { app: url.searchParams.get('client') === 'app' });
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = await readFile(new URL('./public/index.html', import.meta.url));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, HOST, () => console.log(`입금 모니터 실행 중: http://${HOST}:${PORT}`));
