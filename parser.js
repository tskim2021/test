// 카카오뱅크 알림 문구에서 입금 정보를 추출한다.
// 알림 문구가 바뀌면 이 파일만 고치면 된다. 실제 알림 샘플로 test/parser.test.js 를 갱신할 것.

const toInt = (s) => Number(String(s).replace(/[^\d]/g, ''));

export function parseNotification({ title = '', text = '' }) {
  const body = `${title}\n${text}`.replace(/\s+/g, ' ').trim();

  // 출금/이체 알림은 제외
  if (/출금|결제|자동이체|송금 완료/.test(body) && !/입금/.test(body)) return null;
  if (!/입금/.test(body)) return null;

  const amountMatch = body.match(/([\d,]+)\s*원/);
  if (!amountMatch) return null;
  const amount = toInt(amountMatch[1]);
  if (!amount) return null;

  // 예) "입금 50,000원 홍길동" / "홍길동님이 50,000원을 입금했어요" / "홍길동 → 내계좌 입금 50,000원"
  let sender = null;
  // 농협 문자: "농협 입금165,500원 11/03 21:15 352-****-6720-13 정상목 잔액1,824,970원" (입금자는 계좌번호 다음)
  const nh = body.match(/농협\s*입금\s*[\d,]+\s*원\s+\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s+[\d*-]+\s+(.+?)(?:\s+잔액\s*[\d,]+\s*원.*)?$/);
  if (nh) sender = nh[1].trim().slice(0, 30);
  const patterns = [
    /([가-힣A-Za-z0-9()㈜.]{1,20})\s*님이\s*[\d,]+\s*원/,
    /입금\s*[\d,]+\s*원\s*([가-힣A-Za-z0-9()㈜.]{1,20})/,
    /([가-힣A-Za-z0-9()㈜.]{1,20})\s*(?:→|->)\s*[^\s]*\s*입금/,
    /입금\s*([가-힣A-Za-z0-9()㈜.]{1,20})\s*[\d,]+\s*원/,
  ];
  for (const p of nh ? [] : patterns) {
    const m = body.match(p);
    if (m) { sender = m[1].trim(); break; }
  }

  const balanceMatch = body.match(/잔액\s*([\d,]+)\s*원/);
  const balance = balanceMatch ? toInt(balanceMatch[1]) : null;

  return { amount, sender, balance, raw: body };
}

// 카카오뱅크가 직접 보낸 형식인지(문자: "[카카오뱅크] … 입금", 앱 알림: "입금 N원 이름 → 통장(1234)").
// 고객 이메일·메신저 알림처럼 '입금'이라는 말만 들어간 글은 자동 처리 대상이 아니다.
export function isBankFormat(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  return /^(\[Web발신\] )?\[카카오뱅크\] /.test(t) || /^입금 [\d,]+원 .+ → .+\(\d{4}\)/.test(t)
    || /^(NH농협 |농협 )?(\[Web발신\] )?(알림 )?농협 ?입금 ?[\d,]+원 \d{1,2}\/\d{1,2} \d{1,2}:\d{2} \d+-\*+-[\d-]+ /.test(t);
}

// 입금된 계좌 끝 4자리(문자: "노*유(4063)", 앱 알림: "입출금통장(4063)"). 없으면 null.
export function accountOf(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ');
  const m = t.match(/\[카카오뱅크\] \S*\((\d{4})\)/) || t.match(/→ [^()]*\((\d{4})\)/);
  if (m) return m[1];
  const nh = t.match(/농협 ?(?:입금|출금) ?[\d,]+원 \d{1,2}\/\d{1,2} \d{1,2}:\d{2} \d+-\*+-([\d-]+)/); // 352-****-6720-13 → 6720-13
  return nh ? nh[1] : null;
}

// BANK_ACCOUNTS 의 항목(예: 4063, 6720-13)과 문자에서 읽은 계좌가 같은지(숫자만 비교, 끝부분 일치)
export const accountMatches = (acc, list) => list.some((x) => { const a = String(acc).replace(/\D/g, ''), b = String(x).replace(/\D/g, ''); return !!b && a.endsWith(b); });
