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

## 폰 설정 A: 전용 앱 (권장)

`apk/deposit-monitor.apk` 를 폰에 설치합니다(출처를 알 수 없는 앱 설치 허용 필요, 디버그 서명 APK).
소스는 `android/` 에 있고 `cd android && gradle assembleDebug` 로 직접 빌드할 수 있습니다(JDK 17+, Android SDK 34).

1. 앱 실행 → 서버 주소와 `API_TOKEN` 입력 → **저장 후 연결 테스트** ("연결 성공 ✅" 확인)
2. **1) 알림 접근 허용 설정 열기** → "입금 모니터" 켜기
3. **2) 배터리 최적화 설정 열기** → 입금 모니터를 "제한 없음/최적화 안 함"으로
4. 카카오뱅크 앱의 입금 알림이 켜져 있어야 합니다.

앱은 카카오뱅크(`com.kakaobank.channel`) 알림만 읽어 서버로 보냅니다. 서버에 연결이 안 되면 대기열에 쌓아 두었다가
30초마다 재전송합니다. 화면 하단 로그에 수신한 알림 원문이 남으므로, 서버가 인식하지 못하면 그 문구로 `parser.js` 를 맞추세요.

## 폰 설정 B: MacroDroid (앱 없이)

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

## 쇼핑몰(그누보드5) 주문 연동

입금 내역 옆의 **주문 확인** 버튼으로, 입금자명과 금액이 모두 일치하는 미입금 주문(`g5_shop_order`)과
그 장바구니 상품(`g5_shop_cart`)을 보여 주고, 관리자가 **주문완료(입금 처리)** 를 누르면 DB에 반영합니다.

설정(서버의 `/etc/deposit.env`, 비밀번호는 저장소/채팅에 올리지 마세요):

```
ADMIN_TOKEN=...            # install.sh 가 자동 생성. 주문 조회/처리 권한
SHOP_DB_HOST=127.0.0.1     # 그누보드 data/dbconfig.php 의 G5_MYSQL_* 값
SHOP_DB_PORT=3306
SHOP_DB_USER=...
SHOP_DB_PASSWORD=...
SHOP_DB_NAME=...
SHOP_TABLE_PREFIX=g5_
```
설정 후 `sudo systemctl restart deposit`. `SHOP_DB_NAME` 또는 `ADMIN_TOKEN` 이 없으면 이 기능은 꺼져 있습니다.

- **매칭 기준**: `od_status='주문'` 이고 `od_misu`(미수금) = 입금액, 입금자명(`od_deposit_name`, 비어 있으면 `od_name`) = 입금자(공백 무시)
- **처리 내용**(그누보드 관리자의 입금 처리와 같은 결과): `od_status='입금'`, `od_receipt_price += 입금액`, `od_misu -= 입금액`,
  `od_receipt_time=NOW()`, 해당 주문의 장바구니 `ct_status='입금'` (한 트랜잭션)
- 후보에 없는 주문은 처리할 수 없고, 한 입금은 한 주문에만, 한 주문은 한 입금에만 연결됩니다.
- **주의**: SQL로 직접 바꾸므로 그누보드 관리자 화면의 부가 동작(재고·포인트·SMS·메일 등)은 실행되지 않습니다.
  운영 DB에 적용하기 전에 백업하고, 소액 주문으로 먼저 확인하세요.
- 쇼핑몰 DB 계정은 `g5_shop_order`, `g5_shop_cart` 에 SELECT/UPDATE 권한만 주는 것을 권장합니다.
