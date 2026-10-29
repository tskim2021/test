import http2 from 'node:http2';
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64url');

// APNs 토큰 인증(.p8) 발송기. 외부 패키지 없이 node:http2 + ES256 JWT 만 쓴다.
// 환경변수가 하나라도 없으면 null(기능 꺼짐).
export function createApns({ keyPath, keyId, teamId, topic, connect = http2.connect } = {}) {
  if (!keyPath || !keyId || !teamId || !topic) return null;
  const key = readFileSync(keyPath, 'utf8');
  let jwt = null, jwtAt = 0;
  const sessions = new Map(); // host -> ClientHttp2Session

  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    if (jwt && now - jwtAt < 40 * 60) return jwt; // APNs 는 20분~1시간 사이로 갱신하길 요구한다
    const head = b64u(JSON.stringify({ alg: 'ES256', kid: keyId }));
    const body = b64u(JSON.stringify({ iss: teamId, iat: now }));
    const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key, dsaEncoding: 'ieee-p1363' });
    jwt = `${head}.${body}.${b64u(sig)}`;
    jwtAt = now;
    return jwt;
  };

  const session = (host) => {
    let s = sessions.get(host);
    if (s && !s.closed && !s.destroyed) return s;
    s = connect(`https://${host}`);
    s.on('error', () => sessions.delete(host));
    s.on('close', () => sessions.delete(host));
    s.unref?.();
    sessions.set(host, s);
    return s;
  };

  // 기기 1대에 보낸다. 반환: { ok, status, reason }
  const send = (deviceToken, sandbox, { title, body, data = {} }) =>
    new Promise((resolve) => {
      const host = sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
      let req;
      try {
        req = session(host).request({
          ':method': 'POST',
          ':path': `/3/device/${deviceToken}`,
          authorization: `bearer ${token()}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        });
      } catch (e) { return resolve({ ok: false, status: 0, reason: e.message }); }
      let status = 0, buf = '';
      req.setEncoding('utf8');
      req.on('response', (h) => { status = h[':status']; });
      req.on('data', (c) => { buf += c; });
      req.on('end', () => {
        let reason = '';
        try { reason = JSON.parse(buf || '{}').reason || ''; } catch { /* 본문 없음 */ }
        resolve({ ok: status === 200, status, reason });
      });
      req.on('error', (e) => resolve({ ok: false, status: 0, reason: e.message }));
      req.setTimeout(10_000, () => { req.close(); resolve({ ok: false, status: 0, reason: 'timeout' }); });
      req.end(JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, ...data }));
    });

  return { send, close: () => { for (const s of sessions.values()) s.close(); sessions.clear(); } };
}

// 영구 실패(토큰 폐기)인지: 이 경우 저장된 토큰을 지운다.
export const isDeadToken = (r) => r.status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(r.reason);

const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;

// 안드로이드 PushText 와 같은 문구. 보낼 게 없는 이벤트는 null.
export function pushMessage(event, p) {
  const sender = p.sender || '(입금자 미확인)';
  if (event === 'test') return { title: '🔔 푸시 테스트', body: '이 알림이 보이면 iPhone 푸시가 정상입니다' };
  if (event === 'deposit') {
    const hints = { full: '일치하는 주문이 있어 바로 처리할 수 있어요', name: '이름만 일치해요 · 금액 확인 필요', amount: '금액만 일치해요 · 입금자 확인 필요', other: '이미 처리된 주문과 일치해요' };
    const hint = !p.shop ? '처리가 필요합니다' : hints[p.match_level] || '일치하는 주문이 없어요 · 확인 필요';
    return { title: `💰 입금 ${won(p.amount)} · 처리 필요`, body: `${sender} · ${hint}`, data: { id: p.id } };
  }
  if (event === 'processed') {
    let body = `${sender} → 주문 ${p.od_id}`;
    const kind = p.linked ? 2 : Number(p.kind ?? 0);
    if (kind === 0) body += ' (자동 처리)'; else if (kind === 1) body += ' (수동 처리)'; else if (kind === 2) body += ' (기처리 주문 연결)';
    if (p.memo) body += ` · ${p.memo}`;
    return { title: `✅ 처리 완료 · ${won(p.amount)}`, body, data: { id: p.id } };
  }
  return null;
}
