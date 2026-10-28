#!/usr/bin/env bash
# 서버에서 실행: bash ~/deposit/deploy/install.sh
# 환경변수: PORT(기본 3100), PUBLIC=1 이면 외부에서 직접 접속 허용(기본은 127.0.0.1만, nginx 뒤에서 사용)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3100}"
HOST="127.0.0.1"; [ "${PUBLIC:-0}" = "1" ] && HOST="0.0.0.0"
ENV_FILE=/etc/deposit.env

echo "==> 설치 위치: $APP_DIR  (포트 $PORT, 바인드 $HOST)"

# 1) Node 22.13+ 확인/설치
need_node=1
if command -v node >/dev/null; then
  ver="$(node -p 'process.versions.node')"
  if [ "$(printf '22.13.0\n%s\n' "$ver" | sort -V | head -1)" = "22.13.0" ]; then need_node=0; fi
fi
if [ "$need_node" = 1 ]; then
  echo "==> Node 22 설치"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "==> node $(node -v)"

echo "==> 의존성 설치 (mysql2)"
(cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund)

# 2) 포트 충돌 확인(이미 이 서비스가 쓰는 경우는 통과)
if ss -ltn "( sport = :$PORT )" | grep -q LISTEN && ! systemctl is-active --quiet deposit; then
  echo "!! 포트 $PORT 가 이미 사용 중입니다. PORT=다른번호 로 다시 실행하세요." >&2
  exit 1
fi

# 3) 토큰/환경 파일(이미 있으면 토큰 유지)
if [ ! -f "$ENV_FILE" ]; then
  echo "API_TOKEN=$(openssl rand -hex 24)" | sudo tee "$ENV_FILE" >/dev/null
  sudo chmod 600 "$ENV_FILE"
fi
# 관리자 토큰(주문 확인/입금 처리 권한). 이미 있으면 유지
if ! sudo grep -q '^ADMIN_TOKEN=' "$ENV_FILE"; then
  echo "ADMIN_TOKEN=$(openssl rand -hex 24)" | sudo tee -a "$ENV_FILE" >/dev/null
fi
# 쇼핑몰(그누보드) DB 연동 설정 안내: 처음 한 번만 주석으로 추가
if ! sudo grep -q 'SHOP_DB_NAME' "$ENV_FILE"; then
  sudo tee -a "$ENV_FILE" >/dev/null <<'ENVHINT'
# --- 쇼핑몰 DB 연동 (그누보드 data/dbconfig.php 의 값과 동일). 채운 뒤: sudo systemctl restart deposit
#SHOP_DB_HOST=127.0.0.1
#SHOP_DB_PORT=3306
#SHOP_DB_USER=
#SHOP_DB_PASSWORD=
#SHOP_DB_NAME=
#SHOP_TABLE_PREFIX=g5_
ENVHINT
fi
sudo sed -i '/^PORT=/d;/^HOST=/d' "$ENV_FILE"
printf 'PORT=%s\nHOST=%s\n' "$PORT" "$HOST" | sudo tee -a "$ENV_FILE" >/dev/null
sudo chown root:root "$ENV_FILE"

# 4) systemd 서비스
sudo tee /etc/systemd/system/deposit.service >/dev/null <<UNIT
[Unit]
Description=Deposit Monitor
After=network.target

[Service]
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=DB_PATH=$APP_DIR/deposits.db
ExecStart=$(command -v node) --disable-warning=ExperimentalWarning server.js
Restart=always
RestartSec=3
User=$USER

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable deposit >/dev/null 2>&1
sudo systemctl restart deposit
sleep 1

# 5) 동작 확인
TOKEN="$(sudo grep '^API_TOKEN=' "$ENV_FILE" | cut -d= -f2)"
ADMIN="$(sudo grep '^ADMIN_TOKEN=' "$ENV_FILE" | cut -d= -f2)"
if curl -fsS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/api/ping" >/dev/null; then
  echo "==> 서버 정상 동작 확인 ✅"
else
  echo "!! 서버 응답 없음. 로그: sudo journalctl -u deposit -n 50 --no-pager" >&2
  exit 1
fi

IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo 서버IP)"
cat <<MSG

================ 설치 완료 ================
API 토큰 : $TOKEN      (앱과 대시보드 로그인에 사용, 안전한 곳에 보관)
관리자 토큰: $ADMIN      (대시보드에서 '주문 확인/주문완료' 할 때 입력)
쇼핑몰 연동: sudo nano $ENV_FILE 에서 SHOP_DB_* 를 채우고 sudo systemctl restart deposit
로컬 주소: http://127.0.0.1:$PORT

[외부 접속 설정]
- 도메인이 있으면(권장): nginx 에 아래를 추가하고 https 를 붙이세요.
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;          # 실시간(SSE) 필수
        proxy_read_timeout 1h;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
    }
- 도메인 없이 IP 로 바로 쓰려면: PUBLIC=1 PORT=$PORT bash $APP_DIR/deploy/install.sh
  후 방화벽에서 $PORT 열기 → 앱 주소 http://$IP:$PORT  (토큰이 암호화되지 않으니 임시용)

관리: sudo systemctl status|restart|stop deposit   로그: sudo journalctl -u deposit -f
MSG
