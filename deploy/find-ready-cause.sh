#!/usr/bin/env bash
# Mac 에서 실행:  bash ~/deposit-monitor/deploy/find-ready-cause.sh
# 입금 없이 '준비'가 된 무통장 주문의 원인을 한 번에 찾는다(조회만, 아무것도 바꾸지 않음).
#  1) 최근 7일 '주문 즉시 준비'(입금시각=주문시각, 미수 남음) 무통장 주문 목록
#  2) 그 주문이 생긴 순간(앞뒤 1분) 서버에 들어온 웹 요청(정적 파일 제외)
#  3) 주문 상태·입금시각을 바꾸는 코드 줄(예약 작업·관리자 API·주문 저장)
#  4) 예약 작업 로그
H="${H:-ameyoko}"
ssh "$H" 'bash -s' <<'EOS'
R=/var/www/website_b031edd5
cd ~/deposit || exit 1
echo "##### 1) 주문 즉시 '준비'가 된 무통장 주문(최근 7일)"
sudo bash -c "set -a; . /etc/deposit.env; set +a; node --disable-warning=ExperimentalWarning --input-type=module -" > /tmp/ready_orders.txt <<'JS'
import mysql from 'mysql2/promise';
const P = process.env.SHOP_TABLE_PREFIX || 'g5_';
const c = await mysql.createConnection({ host: process.env.SHOP_DB_HOST, port: Number(process.env.SHOP_DB_PORT || 3306), user: process.env.SHOP_DB_USER, password: process.env.SHOP_DB_PASSWORD, database: process.env.SHOP_DB_NAME, dateStrings: true });
const [r] = await c.query(`SELECT od_id, od_name, od_status, od_misu, od_time, IFNULL(mb_id,'') mb_id FROM ${P}shop_order WHERE od_settle_case LIKE '%무통장%' AND od_time >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND od_status <> '주문' AND od_receipt_time = od_time AND od_misu > 0 ORDER BY od_time DESC`);
for (const o of r) console.log([o.od_time, o.od_id, o.od_name, o.od_status, o.od_misu, o.mb_id || '(비회원)'].join('\t'));
await c.end();
JS
cat /tmp/ready_orders.txt
echo
echo "##### 2) 그 주문이 생긴 순간의 웹 요청 (최근 4건, 정적 파일 제외)"
LOGS=$(ls /var/log/nginx/*access*.log* 2>/dev/null)
head -4 /tmp/ready_orders.txt | while IFS=$'\t' read -r T ID NAME REST; do
  echo "--- $T $ID $NAME"
  for d in -1 0 1; do
    M=$(date -d "TZ=\"Asia/Seoul\" $T $d min" +"%d/%b/%Y:%H:%M")
    sudo zgrep -h "$M" $LOGS 2>/dev/null
  done | grep -v -E "\.(css|js|png|jpe?g|gif|webp|svg|woff2?|ico|map)(\?| )" | grep -E "POST|\.php|/api|admin-api" | cut -c1-230 | head -30
done
echo
echo "##### 3) 주문 상태·입금시각을 바꾸는 코드"
for f in adm/shop_admin/stripe_pending_cleanup_cron.php adm/shop_admin/auto_cancel_cron.php adm/shop_admin/bank_reminder_cron.php adm/shop_admin/order_quick_ipgum_ajax.php adm/shop_admin/orderformreceiptupdate.php admin-api/api.php api/update_invoice.php shop/orderformupdate.php shop/usdt-order.inc.php; do
  [ -f "$R/$f" ] || continue
  echo "--- $f (수정: $(sudo stat -c %y "$R/$f" | cut -c1-16))"
  sudo grep -n -E "od_status\s*=|od_receipt_time\s*=|'준비'|\"준비\"" "$R/$f" | cut -c1-200 | head -12
done
echo "--- 사이트 전체: 입금시각에 주문시각을 넣는 코드"
sudo grep -rn -E "od_receipt_time\s*=\s*(od_time|'?\\\$od\[.od_time)" "$R" --include=*.php 2>/dev/null | cut -c1-200 | head
echo
echo "##### 4) 예약 작업 로그(최근)"
for l in stripe_pending_cleanup auto_cancel_cron bank_reminder_cron; do echo "--- /var/log/$l.log"; sudo tail -8 /var/log/$l.log 2>/dev/null | cut -c1-200; done
rm -f /tmp/ready_orders.txt
EOS
