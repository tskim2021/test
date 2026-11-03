#!/usr/bin/env bash
# Mac 에서 실행:  bash ~/deposit-monitor/deploy/test-ameyoko.sh
# ameyoko 입금 모니터 점검: ① 서버 상태 ② 폰 연결 ③ 농협 문자 해석(가짜 1건, 바로 숨김) ④ 실제 1원 입금 대기
# 토큰은 서버의 /etc/deposit.env 에서 읽어 서버 안에서만 쓰고 화면에 출력하지 않는다.
set -uo pipefail
H="${H:-ameyoko}"          # ssh 접속 이름
WAIT="${WAIT:-180}"        # ④ 에서 기다릴 초

echo "===== ① 서버 상태"
ssh "$H" 'systemctl is-active deposit; sudo grep -E "^(BANK_ACCOUNTS|AUTO_PROCESS)=" /etc/deposit.env || true'

echo
echo "===== ② 폰 연결 (서버 3100 포트에 붙어 있는 IP, 폰 앱이 있어야 정상)"
ssh "$H" "sudo ss -tn state established '( sport = :3100 )' | tail -n +2 | awk '{print \$4}' | cut -d: -f1 | sort | uniq -c"

echo
echo "===== ③ 서버가 농협 문자를 읽는지 (가짜 문자 1건 → 확인 후 목록에서 숨김, 자동 처리 안 됨)"
ssh "$H" 'bash -s' <<'EOS'
eval "$(sudo grep -E '^(API_TOKEN|ADMIN_TOKEN|BANK_ACCOUNTS|PORT)=' /etc/deposit.env | sed 's/^/export /')"
PORT="${PORT:-3100}"
ACC=$(echo "${BANK_ACCOUNTS:-6720-13}" | tr ',' '\n' | grep -- '-' | head -1); ACC="${ACC:-6720-13}"
T=$(TZ=Asia/Seoul date '+%m/%d %H:%M')
BODY=$(printf '{"title":"","text":"[Web발신]\\n농협 입금1원\\n%s\\n352-****-%s\\n[테스트]점검\\n잔액1원"}' "$T" "$ACC")
R=$(curl -s -m 10 -X POST -H 'content-type: application/json' -H "authorization: Bearer $API_TOKEN" --data-binary "$BODY" "http://127.0.0.1:$PORT/api/notify")
echo "서버 응답: $R"
ID=$(echo "$R" | grep -o '"id":[0-9]*' | cut -d: -f2)
if [ -n "$ID" ]; then
  echo "✅ 농협 문자 형식을 정상으로 읽었습니다 (입금 #$ID, 입금자 [테스트]점검 1원)"
  H2=$(curl -s -m 10 -X POST -H 'content-type: application/json' -H "authorization: Bearer $ADMIN_TOKEN" --data-binary "{\"ids\":[$ID]}" "http://127.0.0.1:$PORT/api/deposits/hide")
  echo "   점검용 입금은 목록에서 숨겼습니다: $H2"
elif echo "$R" | grep -q duplicate; then
  echo "ℹ️  같은 분에 이미 점검했습니다. 1분 뒤 다시 실행하세요."
else
  echo "❌ 서버가 농협 문자를 읽지 못했습니다. 이 출력 전체를 보내 주세요."
fi
EOS

echo
echo "===== ④ 실제 입금 대기 ${WAIT}초: 지금 농협 계좌로 1원을 입금하세요 (Ctrl+C 로 중단)"
ssh "$H" "cd ~/deposit && WAIT=$WAIT node --disable-warning=ExperimentalWarning" <<'EOS'
const { DatabaseSync } = require('node:sqlite');
const { execSync } = require('node:child_process');
const db = new DatabaseSync('deposits.db');
let last = db.prepare('select coalesce(max(id),0) n from deposits').get().n;
const since = new Date().toISOString();
const end = Date.now() + Number(process.env.WAIT) * 1000;
const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(11, 19);
let got = 0;
const tick = () => {
  for (const r of db.prepare('select d.id, d.sender, d.amount, d.received_at, d.raw, m.od_id from deposits d left join matches m on m.deposit_id=d.id where d.id > ? order by d.id').all(last)) {
    last = r.id; got++;
    console.log(`✅ ${kst(r.received_at)} 입금 도착 #${r.id} ${r.sender} ${r.amount.toLocaleString('ko-KR')}원 ${r.od_id ? '→ 처리됨 ' + r.od_id : '(처리 필요)'}`);
    console.log('   문자: ' + String(r.raw).slice(0, 90));
  }
  if (Date.now() < end) return setTimeout(tick, 3000);
  if (!got) {
    console.log('❌ 기다리는 동안 서버에 들어온 입금이 없습니다.');
    try {
      const log = execSync(`sudo journalctl -u deposit --since "${since}" --no-pager | grep -E "무시|보류|아님|오류" | tail -5`).toString().trim();
      console.log(log ? '서버 로그:\n' + log : '서버 로그에도 기록 없음 → 폰이 서버로 보내지 않았습니다. 폰 앱 설정 탭의 로그를 캡처해 주세요.');
    } catch { console.log('서버 로그에도 기록 없음 → 폰이 서버로 보내지 않았습니다. 폰 앱 설정 탭의 로그를 캡처해 주세요.'); }
  }
};
tick();
EOS
