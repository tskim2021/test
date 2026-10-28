import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { openDb, isDate } from './db.js';
import { parseNotification } from './parser.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const API_TOKEN = process.env.API_TOKEN; // 폰 -> 서버 전송용
const VIEW_TOKEN = process.env.VIEW_TOKEN || API_TOKEN; // 대시보드 열람용
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!API_TOKEN) {
  console.error('API_TOKEN 환경변수를 설정하세요. 예: API_TOKEN=$(openssl rand -hex 24) npm start');
  process.exit(1);
}

const db = openDb();
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
      return json(res, 200, { deposits: rows, count, total, page, limit, pages: Math.max(1, Math.ceil(count / limit)) });
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
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, HOST, () => console.log(`입금 모니터 실행 중: http://${HOST}:${PORT}`));
