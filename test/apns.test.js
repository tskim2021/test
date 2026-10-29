import { test } from 'node:test';
import assert from 'node:assert/strict';
import http2 from 'node:http2';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApns, isDeadToken, pushMessage } from '../apns.js';

test('pushMessage: 안드로이드와 같은 문구', () => {
  assert.equal(pushMessage('deposit', { amount: 50000, sender: '홍길동', shop: true, match_level: 'full' }).title, '💰 입금 50,000원 · 처리 필요');
  assert.match(pushMessage('deposit', { amount: 1, sender: 'a', shop: true, match_level: 'name' }).body, /이름만 일치/);
  assert.match(pushMessage('processed', { amount: 1, sender: 'a', od_id: 'A1', kind: 0 }).body, /A1 \(자동 처리\)/);
  assert.match(pushMessage('processed', { amount: 1, sender: 'a', od_id: 'A1', linked: true }).body, /기처리/);
  assert.equal(pushMessage('nothing', {}), null);
});

test('createApns: 설정이 없으면 null', () => assert.equal(createApns({}), null));

test('send: JWT(ES256)·헤더·본문 확인, 410 은 폐기 토큰', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const dir = mkdtempSync(join(tmpdir(), 'apns-'));
  const keyPath = join(dir, 'k.p8');
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const seen = [];
  const srv = http2.createServer();
  srv.on('stream', (st, h) => {
    let b = ''; st.on('data', (c) => { b += c; });
    st.on('end', () => {
      seen.push({ h, b });
      const dead = h[':path'].endsWith('dead');
      st.respond({ ':status': dead ? 410 : 200 });
      st.end(dead ? '{"reason":"Unregistered"}' : '');
    });
  });
  await new Promise((r) => srv.listen(0, r));
  const apns = createApns({ keyPath, keyId: 'KEY123', teamId: 'TEAM123', topic: 'com.x.app', connect: () => http2.connect(`http://localhost:${srv.address().port}`) });
  const ok = await apns.send('abcd', true, { title: 'T', body: 'B' });
  const dead = await apns.send('dead', false, { title: 'T', body: 'B' });
  apns.close(); srv.close();
  assert.equal(ok.ok, true);
  assert.equal(isDeadToken(dead), true);
  const { h, b } = seen[0];
  assert.equal(h['apns-topic'], 'com.x.app');
  assert.equal(h[':path'], '/3/device/abcd');
  assert.equal(JSON.parse(b).aps.alert.title, 'T');
  const [hd, pl, sig] = h.authorization.replace('bearer ', '').split('.');
  assert.equal(JSON.parse(Buffer.from(hd, 'base64url')).kid, 'KEY123');
  assert.equal(JSON.parse(Buffer.from(pl, 'base64url')).iss, 'TEAM123');
  assert.ok(createVerify('SHA256').update(`${hd}.${pl}`).verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
});
