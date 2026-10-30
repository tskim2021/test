# 쇼핑몰 관리자 메뉴 + HTTPS 경로로 붙이기

쇼핑몰(그누보드)과 같은 서버에 입금 모니터를 설치하고, 쇼핑몰 도메인의 `/deposit/` 경로로 연다.
쇼핑몰이 이미 HTTPS 라서 새 도메인·인증서가 필요 없고, iPhone 앱 주소로도 그대로 쓴다.

1. 설치(포트 3100, 외부에 직접 열지 않음): `bash ~/deposit/deploy/install.sh` → `bash ~/deposit/deploy/connect-shop.sh`
2. nginx: 쇼핑몰 도메인의 `listen 443` server 블록 안에 `deploy/nginx-deposit-location.conf` 내용을 넣고 `sudo nginx -t && sudo systemctl reload nginx`
3. 확인: `curl -s https://도메인/deposit/api/ping` → `{"error":"unauthorized"}` 이면 정상
4. 관리자 메뉴: `deploy/gnuboard/admin.menu950.php`, `deploy/gnuboard/deposit_monitor.php` 를 그누보드 `adm/` 폴더에 복사(소유자·권한은 옆 파일과 같게). 관리자 왼쪽 메뉴에 "입금 모니터"가 생긴다.
   - `menu950` 이 이미 쓰이고 있으면 다른 번호(예: 960)로 두 파일의 숫자를 함께 바꾼다.
5. 처음 열면 접속 토큰을 묻는다: `/etc/deposit.env` 의 `ADMIN_TOKEN` (관리자 토큰은 조회+처리 모두 가능)
6. iPhone 앱: 서버 주소 `https://도메인/deposit`, 토큰 `ADMIN_TOKEN`
7. 안드로이드(카카오뱅크 알림 받는 폰) 앱: 서버 주소 `https://도메인/deposit`, 토큰 `API_TOKEN`
