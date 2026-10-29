# iPhone 앱 (TestFlight)

iOS는 다른 앱(카카오뱅크)의 알림을 읽을 수 없습니다. 그래서 **입금 수집은 지금처럼 안드로이드 폰**이 하고, iPhone 앱은 **대시보드 보기·처리 + 푸시 수신** 용입니다.

## 준비물
1. Apple Developer Program 유료 계정 (연 $99)
2. MacBook + Xcode 15 이상, `brew install xcodegen`
3. **HTTPS 서버 주소** — iOS 는 `http://` 접속을 막습니다 (아래 "HTTPS" 참고)
4. APNs 인증 키: developer.apple.com → Certificates, Identifiers & Profiles → Keys → `+` → *Apple Push Notifications service (APNs)* 체크 → 다운로드한 `AuthKey_XXXXXXXXXX.p8` 파일 (한 번만 받을 수 있음), Key ID(10자리), Team ID(Membership 화면)

## 1. 앱 ID 만들기
developer.apple.com → Identifiers → `+` → App IDs → App → Bundle ID 를 정하고(예: `com.ameyokovip.depositmonitor`) **Push Notifications** 를 체크해 등록.

## 2. Xcode 프로젝트 만들고 빌드
```
cd ios
```
`project.yml` 의 `DEVELOPMENT_TEAM`(Team ID, 이미 입력됨)과 `PRODUCT_BUNDLE_IDENTIFIER`(위 Bundle ID)를 확인한 뒤:
```
xcodegen generate
open DepositMonitor.xcodeproj
```
Xcode 에서 Signing & Capabilities → *Automatically manage signing* 이 켜져 있고 **Push Notifications** capability 가 보이는지 확인 (없으면 `+ Capability`로 추가).

## 3. TestFlight 업로드
1. App Store Connect → My Apps → `+` New App → 같은 Bundle ID 선택
2. Xcode 상단 기기를 **Any iOS Device (arm64)** 로 → Product → Archive
3. Organizer → Distribute App → App Store Connect → Upload
4. App Store Connect → TestFlight 에서 빌드 처리 완료(몇 분~) 후 내부 테스터에 본인 Apple ID 추가 → iPhone 의 TestFlight 앱에서 설치

## 4. 서버에 APNs 설정
`.p8` 파일을 서버에 올리고(저장소 밖, 권한 600) 서버 환경변수에 추가한 뒤 재시작:
```
APNS_KEY_PATH=/home/skiops/keys/AuthKey_XXXXXXXXXX.p8
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=YYYYYYYYYY
APNS_TOPIC=com.ameyokovip.depositmonitor     # 앱의 Bundle ID
```
(설정이 없으면 iPhone 푸시만 꺼지고 나머지는 그대로 동작합니다.)

## 5. 앱 설정
앱을 열면 설정 창이 뜹니다. **서버 주소(https://…)** 와 **접속 토큰(VIEW_TOKEN 또는 ADMIN_TOKEN — 처리 기능까지 쓰려면 ADMIN_TOKEN)** 을 넣고 완료 → 알림 허용.
설정 창에 `푸시: 서버에 등록됨 ✅` 이 나오면 **푸시 테스트 보내기** 로 확인하세요.

## HTTPS (도메인이 있을 때)
`deposit.ameyokovip.com` 같은 서브도메인의 A 레코드를 서버 IP 로 연결한 뒤, 서버에서:
```
sudo apt install -y nginx certbot python3-certbot-nginx
```
`/etc/nginx/sites-available/deposit`:
```
server {
  server_name deposit.ameyokovip.com;
  location / {
    proxy_pass http://127.0.0.1:3100;   # 서버 PORT(기본 3100)
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;                 # SSE(실시간)에 필요
    proxy_read_timeout 1h;
  }
}
```
```
sudo ln -s /etc/nginx/sites-available/deposit /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d deposit.ameyokovip.com
```

## 알아둘 점
- 개발 빌드(Xcode 로 직접 설치)는 APNs sandbox, TestFlight 빌드는 production 으로 자동 구분해 등록합니다.
- 이 코드는 리눅스 환경에서 작성되어 **Swift 컴파일 검증을 하지 못했습니다.** 빌드 오류가 나면 오류 메시지를 알려 주세요.
