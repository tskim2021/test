import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { openDb, isDate } from './db.js';
import { parseNotification } from './parser.js';
import { createShop } from './shop.js';

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
shop?.ping().then((n) => console.log(`쇼핑몰 DB 연결 확인: 주문 ${n}건`)).catch((e) => console.error('쇼핑몰 DB 연결 실패:', e.message));
const isAdmin = (req, url) => !!ADMIN_TOKEN && safeEq(tokenOf(req, url), ADMIN_TOKEN);
const clients = new Set();

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

function broadcast(row) {
  const msg = `event: deposit\ndata: ${JSON.stringify(row)}\n\n`;
  for (const c of clients) c.write(msg);
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
      broadcast(row);
      notifyTelegram(row);
      return json(res, 200, { ok: true, id: row.id });
    }

    // 앱의 '연결 테스트'용. 토큰만 확인하고 아무것도 저장하지 않는다.
    if (req.method === 'GET' && url.pathname === '/api/ping') {
      if (!safeEq(tokenOf(req, url), API_TOKEN)) return json(res, 401, { error: 'unauthorized' });
      return json(res, 200, { ok: true });
    }

    // 조회: ?from=YYYY-MM-DD&to=YYYY-MM-DD&q=입금자&limit=10|20|50|100&page=1  (날짜는 한국시간 기준)
    if (req.method === 'GET' && url.pathname === '/api/deposits') {
      if (!safeEq(tokenOf(req, url), VIEW_TOKEN)) return json(res, 401, { error: 'unauthorized' });
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      if ((from && !isDate(from)) || (to && !isDate(to))) return json(res, 400, { error: 'invalid date' });
      const limit = [10, 20, 50, 100].includes(Number(url.searchParams.get('limit'))) ? Number(url.searchParams.get('limit')) : 20;
      const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1);
      const q = (url.searchParams.get('q') || '').trim().slice(0, 50);
      const { rows, count, total } = db.search({ from, to, q, limit, offset: (page - 1) * limit });
      let levels = new Map();
      let matchError = null;
      if (shop && ADMIN_TOKEN) {
        try { levels = await shop.matchLevels(rows.filter((r) => !r.order_id)); } catch (e) { matchError = e.message; console.error('주문 매칭 조회 실패:', e.message); }
      }
      let orderItems = {};
      if (shop && ADMIN_TOKEN) {
        try { orderItems = await shop.itemsByOrder([...new Set(rows.filter((r) => r.order_id).map((r) => r.order_id))]); } catch (e) { console.error('주문 상품 조회 실패:', e.message); }
      }
      const deposits = rows.map((r) => ({ ...r, match_level: levels.get(r.id) || null, order_items: r.order_id ? orderItems[r.order_id] || [] : undefined }));
      return json(res, 200, { deposits, count, total, page, limit, pages: Math.max(1, Math.ceil(count / limit)), shop: !!shop && !!ADMIN_TOKEN, admin: !!ADMIN_TOKEN, match_error: matchError });
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
      return json(res, 200, { deposit: { id: deposit.id, sender: deposit.sender, amount: deposit.amount, received_at: deposit.received_at, memo: deposit.memo }, confirmed_order: confirmed, candidates: related.full, related: { name: related.name, amount: related.amount, other: related.other } });
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
      if (!exact && !manual) return json(res, 409, { error: '이 입금과 관련된 미입금 주문이 아닙니다' });
      if (manual) {
        const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
        if (!memo) return json(res, 400, { error: '이름·금액이 일치하지 않는 주문은 처리 사유(메모)를 입력해야 합니다' });
        if (memo.length > 500) return json(res, 400, { error: '메모는 500자 이내' });
        db.setMemo(deposit.id, memo);
      } else if (typeof body.memo === 'string' && body.memo.trim()) {
        db.setMemo(deposit.id, body.memo.trim().slice(0, 500));
      }
      if (!db.claim(deposit.id, odId, manual)) return json(res, 409, { error: '이미 처리된 입금이거나 이미 연결된 주문입니다' });
      try {
        await shop.confirm(odId, { expectMisu: manual ? null : deposit.amount });
      } catch (e) {
        db.release(deposit.id);
        return json(res, e.status || 500, { error: e.status ? e.message : '주문 처리 중 오류' });
      }
      return json(res, 200, { ok: true, od_id: odId, manual });
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      if (!safeEq(tokenOf(req, url), VIEW_TOKEN)) return json(res, 401, { error: 'unauthorized' });
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
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
