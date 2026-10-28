# 입금 모니터

카카오뱅크 입금 알림(안드로이드)을 서버로 보내 웹 대시보드에 실시간으로 표시합니다.
은행 계정에 로그인하지 않고, 폰에 뜬 알림 문구만 사용합니다.

```
카카오뱅크 → 폰 알림 → Tasker/MacroDroid → POST /api/notify → DB → 대시보드(SSE 실시간)
```

## 서버 실행 (Node.js 22.13+, 의존성 없음)

```bash
API_TOKEN=$(openssl rand -hex 24) npm start     # 토큰은 따로 적어 둘 것
```

| 환경변수 | 설명 |
|---|---|
| `API_TOKEN` | (필수) 폰이 알림을 보낼 때 쓰는 토큰 |
| `VIEW_TOKEN` | 대시보드 접속 토큰. 없으면 `API_TOKEN`과 동일 |
| `PORT` | 기본 3000 |
| `DB_PATH` | 기본 `./deposits.db` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | 설정하면 입금 시 텔레그램 알림 |

브라우저에서 `http://서버주소:3000` 접속 후 토큰을 입력합니다.
**외부 공개 시 반드시 HTTPS(예: Caddy, Cloudflare Tunnel) 뒤에 두세요.**

## 폰 설정 (MacroDroid 기준, Tasker도 동일 개념)

1. MacroDroid 설치 후 "알림 접근 허용" 켜기, 배터리 최적화에서 MacroDroid 제외
2. 매크로 만들기
   - 트리거: **알림 수신** → 앱: 카카오뱅크 선택
   - 동작: **HTTP 요청**
     - 방식 POST, URL `https://서버주소/api/notify`
     - 헤더 `Authorization: Bearer <API_TOKEN>`
     - 본문(JSON): `{"title":"{not_title}","text":"{not_text}"}`
3. 카카오뱅크 앱의 입금 알림이 켜져 있어야 합니다.

## 테스트

```bash
curl -XPOST localhost:3000/api/notify -H "Authorization: Bearer $API_TOKEN" \
  -d '{"title":"카카오뱅크","text":"입금 50,000원 홍길동 잔액 1,234,000원"}'
npm test
```

## 알림 문구가 다를 때

실제 알림 문구가 `parser.js` 예상 형식과 다르면 금액·입금자가 인식되지 않습니다.
실제 알림 문구(계좌번호와 이름은 가리고)를 `test/parser.test.js`에 추가하고 `parser.js`를 맞추세요.
같은 알림이 같은 분에 여러 번 와도 한 번만 저장됩니다.
