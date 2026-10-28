#!/usr/bin/env bash
# 서버에서 실행: bash ~/deposit/deploy/connect-shop.sh [그누보드 data/dbconfig.php 경로]
# 그누보드 설정 파일을 찾아 DB 접속 정보를 /etc/deposit.env 에 반영하고 서비스를 재시작한다.
# 설정 파일이 여러 개면 nginx 가 DOMAIN(기본 ameyokovip.com)을 실제로 서비스하는 경로로 판별하고,
# 판별이 안 되면 근거(nginx 경로, DB, 주문 건수, 최근 주문 시각)를 보여 준 뒤 멈춘다. 비밀번호는 출력하지 않는다.
# DRY_RUN=1: 수정/재시작 없이 확인만.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/etc/deposit.env}"
DOMAIN="${DOMAIN:-ameyokovip.com}"
SUDO="sudo"; [ "$(id -u)" = 0 ] && SUDO=""
CFG="${1:-}"

getdef() { $SUDO sed -nE "s/^[[:space:]]*define\([[:space:]]*['\"]$2['\"][[:space:]]*,[[:space:]]*['\"]([^'\"]*)['\"].*/\1/p" "$1" | head -1; }

# nginx 에서 DOMAIN 을 서비스하는 server 블록의 root 경로들
nginx_roots() {
  local dump
  if [ -n "${NGINX_DUMP:-}" ]; then dump="$(cat "$NGINX_DUMP")"; else dump="$($SUDO nginx -T 2>/dev/null || true)"; fi
  printf '%s\n' "$dump" | awk -v dom="$DOMAIN" '
    { line=$0; sub(/#.*/, "", line) }
    line ~ /(^|[ \t;{}])server[ \t]*\{/ && depth==0 { inserver=1; names=""; roots="" }
    inserver && match(line, /server_name[ \t]+[^;]*/) { names=names " " substr(line, RSTART+11, RLENGTH-11) }
    inserver && match(line, /(^|[ \t;{])root[ \t]+[^ \t;]+/) { r=substr(line, RSTART, RLENGTH); sub(/^[ \t;{]*root[ \t]+/, "", r); roots=roots " " r }
    { n=gsub(/\{/, "{", line); m=gsub(/\}/, "}", line); depth+=n-m }
    inserver && depth==0 {
      k=split(names, t, /[ \t]+/); hit=0
      for (i=1; i<=k; i++) if (t[i]==dom || t[i]=="www." dom) hit=1
      if (hit) print roots
      inserver=0
    }
  ' | tr ' ' '\n' | sed '/^$/d' | sort -u
}

if [ -z "$CFG" ]; then
  echo "==> 쇼핑몰 설정 파일(data/dbconfig.php) 검색 중…"
  mapfile -t FOUND < <($SUDO find /var /srv /home /opt /www /usr/share/nginx -type f -path '*/data/dbconfig.php' 2>/dev/null | head -30)
  CANDS=()
  for f in "${FOUND[@]:-}"; do [ -n "$f" ] && $SUDO grep -q 'G5_MYSQL_HOST' "$f" 2>/dev/null && CANDS+=("$f"); done
  [ "${#CANDS[@]}" -eq 0 ] && { echo "!! dbconfig.php 를 찾지 못했습니다. 경로를 직접 지정하세요: bash $0 /경로/data/dbconfig.php" >&2; exit 1; }

  if [ "${#CANDS[@]}" -eq 1 ]; then
    CFG="${CANDS[0]}"
  else
    echo "==> 후보 ${#CANDS[@]}개 발견. 실제 운영 중인 곳을 확인합니다."
    mapfile -t ROOTS < <(nginx_roots)
    echo "==> nginx 가 $DOMAIN 을 서비스하는 root: ${ROOTS[*]:-(확인 불가: nginx 설정에서 못 찾음)}"
    SERVED=()
    for f in "${CANDS[@]}"; do
      site="${f%/data/dbconfig.php}"; hit="아니오"
      for r in "${ROOTS[@]:-}"; do
        r="${r%/}"; [ -n "$r" ] || continue
        if [ "$r" = "$site" ] || [[ "$r" == "$site"/* ]]; then hit="예"; fi
      done
      [ "$hit" = "예" ] && SERVED+=("$f")
      info="$(SHOP_DB_HOST="$(getdef "$f" G5_MYSQL_HOST | sed 's/^localhost$/127.0.0.1/')" SHOP_DB_PORT="${SHOP_DB_PORT:-3306}" \
        SHOP_DB_USER="$(getdef "$f" G5_MYSQL_USER)" SHOP_DB_PASSWORD="$(getdef "$f" G5_MYSQL_PASSWORD)" \
        SHOP_DB_NAME="$(getdef "$f" G5_MYSQL_DB)" SHOP_TABLE_PREFIX="$(getdef "$f" G5_TABLE_PREFIX)" \
        node "$APP_DIR/deploy/shop-info.mjs" 2>/dev/null || echo '{"error":"node 실행 실패"}')"
      echo "   - $f"
      echo "       nginx 서비스 중: $hit | DB: $(getdef "$f" G5_MYSQL_DB) | 조회: $info"
    done
    if [ "${#SERVED[@]}" -eq 1 ]; then
      CFG="${SERVED[0]}"; echo "==> nginx 가 서비스하는 단 하나의 경로로 확정: $CFG"
    else
      echo "!! 한 곳으로 확정하지 못했습니다(nginx 서비스 중인 후보 ${#SERVED[@]}개). 위 근거를 보고 경로를 인자로 지정해 다시 실행하세요." >&2
      exit 1
    fi
  fi
fi
echo "==> 사용: $CFG"

HOST="$(getdef "$CFG" G5_MYSQL_HOST)"; USER_="$(getdef "$CFG" G5_MYSQL_USER)"; PASS="$(getdef "$CFG" G5_MYSQL_PASSWORD)"
DBN="$(getdef "$CFG" G5_MYSQL_DB)"; PREFIX="$(getdef "$CFG" G5_TABLE_PREFIX)"; PREFIX="${PREFIX:-g5_}"
[ -z "$HOST" ] || [ -z "$USER_" ] || [ -z "$DBN" ] && { echo "!! 설정 파일에서 DB 정보를 읽지 못했습니다: $CFG" >&2; exit 1; }
[ "$HOST" = "localhost" ] && HOST="127.0.0.1"
echo "==> DB: host=$HOST user=$USER_ db=$DBN prefix=$PREFIX (비밀번호는 표시하지 않음)"

SOCKET=""
if [ "$HOST" = "127.0.0.1" ] && [ -z "${SHOP_DB_PORT:-}" ] && ! (ss -ltn 2>/dev/null | grep -q ':3306 '); then
  for sk in /var/run/mysqld/mysqld.sock /run/mysqld/mysqld.sock /var/lib/mysql/mysql.sock /tmp/mysql.sock; do
    [ -S "$sk" ] && SOCKET="$sk" && break
  done
fi
[ "${DRY_RUN:-0}" = "1" ] && { echo "==> DRY_RUN: 확인만 했습니다 (socket=${SOCKET:-없음})"; exit 0; }

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

[ "${SKIP_RESTART:-0}" = "1" ] && exit 0
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
