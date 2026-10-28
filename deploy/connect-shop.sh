#!/usr/bin/env bash
# 서버에서 실행: bash ~/deposit/deploy/connect-shop.sh [그누보드 data/dbconfig.php 경로]
# 그누보드 설정 파일(dbconfig.php)을 찾아 DB 접속 정보를 읽고 /etc/deposit.env 에 반영한 뒤 서비스를 재시작한다.
# 비밀번호는 화면에 출력하지 않는다. DRY_RUN=1 이면 파일 수정/재시작 없이 읽은 값(비밀번호 제외)만 보여 준다.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/deposit.env}"
SUDO="sudo"; [ "$(id -u)" = 0 ] && SUDO=""
CFG="${1:-}"

if [ -z "$CFG" ]; then
  echo "==> 쇼핑몰 설정 파일(data/dbconfig.php) 검색 중…"
  mapfile -t FOUND < <($SUDO find / -xdev -type f -path '*/data/dbconfig.php' 2>/dev/null | head -20)
  CANDS=()
  for f in "${FOUND[@]:-}"; do
    [ -n "$f" ] && $SUDO grep -q 'G5_MYSQL_HOST' "$f" 2>/dev/null && CANDS+=("$f")
  done
  if [ "${#CANDS[@]}" -eq 0 ]; then
    echo "!! 그누보드 dbconfig.php 를 찾지 못했습니다. 경로를 직접 지정하세요: bash $0 /경로/data/dbconfig.php" >&2; exit 1
  fi
  if [ "${#CANDS[@]}" -gt 1 ]; then
    echo "!! 여러 개 발견됨. 사용할 파일을 인자로 지정해 다시 실행하세요:" >&2
    printf '   %s\n' "${CANDS[@]}" >&2; exit 1
  fi
  CFG="${CANDS[0]}"
fi
echo "==> 사용: $CFG"

getdef() {
  $SUDO sed -nE "s/^[[:space:]]*define\([[:space:]]*['\"]$1['\"][[:space:]]*,[[:space:]]*['\"]([^'\"]*)['\"].*/\1/p" "$CFG" | head -1
}
HOST="$(getdef G5_MYSQL_HOST)"; USER_="$(getdef G5_MYSQL_USER)"; PASS="$(getdef G5_MYSQL_PASSWORD)"
DBN="$(getdef G5_MYSQL_DB)"; PREFIX="$(getdef G5_TABLE_PREFIX)"; PREFIX="${PREFIX:-g5_}"
if [ -z "$HOST" ] || [ -z "$USER_" ] || [ -z "$DBN" ]; then
  echo "!! 설정 파일에서 DB 정보를 읽지 못했습니다: $CFG" >&2; exit 1
fi
[ "$HOST" = "localhost" ] && HOST="127.0.0.1"
echo "==> DB: host=$HOST user=$USER_ db=$DBN prefix=$PREFIX (비밀번호는 표시하지 않음)"

# 3306 TCP 로 안 열려 있고 소켓만 있는 서버 대응
SOCKET=""
if [ "$HOST" = "127.0.0.1" ] && [ -z "${SHOP_DB_PORT:-}" ] && ! (ss -ltn 2>/dev/null | grep -q ':3306 '); then
  for sk in /var/run/mysqld/mysqld.sock /run/mysqld/mysqld.sock /var/lib/mysql/mysql.sock /tmp/mysql.sock; do
    [ -S "$sk" ] && SOCKET="$sk" && break
  done
fi

[ "${DRY_RUN:-0}" = "1" ] && { echo "==> DRY_RUN: 여기까지만 확인했습니다 (socket=${SOCKET:-없음})"; exit 0; }

esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
$SUDO touch "$ENV_FILE"; $SUDO chmod 600 "$ENV_FILE"
$SUDO sed -i -E '/^SHOP_DB_(HOST|PORT|USER|PASSWORD|NAME|SOCKET)=/d;/^SHOP_TABLE_PREFIX=/d' "$ENV_FILE"
{
  echo "SHOP_DB_HOST=\"$(esc "$HOST")\""
  [ -n "${SHOP_DB_PORT:-}" ] && echo "SHOP_DB_PORT=\"$SHOP_DB_PORT\""
  [ -n "$SOCKET" ] && echo "SHOP_DB_SOCKET=\"$SOCKET\""
  echo "SHOP_DB_USER=\"$(esc "$USER_")\""
  echo "SHOP_DB_PASSWORD=\"$(esc "$PASS")\""
  echo "SHOP_DB_NAME=\"$(esc "$DBN")\""
  echo "SHOP_TABLE_PREFIX=\"$(esc "$PREFIX")\""
} | $SUDO tee -a "$ENV_FILE" >/dev/null
echo "==> $ENV_FILE 에 반영 완료"

if [ "${SKIP_RESTART:-0}" = "1" ]; then exit 0; fi
$SUDO systemctl restart deposit
sleep 2
if $SUDO journalctl -u deposit -n 20 --no-pager 2>/dev/null | grep -q "쇼핑몰 DB 연결 확인"; then
  $SUDO journalctl -u deposit -n 20 --no-pager | grep "쇼핑몰 DB 연결 확인" | tail -1
  echo "==> 쇼핑몰 연동 완료 ✅  (대시보드에서 '주문 확인' 버튼 사용 가능)"
else
  echo "!! 쇼핑몰 DB 연결을 확인하지 못했습니다. 로그: sudo journalctl -u deposit -n 30 --no-pager" >&2
  $SUDO journalctl -u deposit -n 10 --no-pager | grep "연결 실패" >&2 || true
  exit 1
fi
