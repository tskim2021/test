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
  const patterns = [
    /([가-힣A-Za-z0-9()㈜.]{1,20})\s*님이\s*[\d,]+\s*원/,
    /입금\s*[\d,]+\s*원\s*([가-힣A-Za-z0-9()㈜.]{1,20})/,
    /([가-힣A-Za-z0-9()㈜.]{1,20})\s*(?:→|->)\s*[^\s]*\s*입금/,
    /입금\s*([가-힣A-Za-z0-9()㈜.]{1,20})\s*[\d,]+\s*원/,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) { sender = m[1].trim(); break; }
  }

  const balanceMatch = body.match(/잔액\s*([\d,]+)\s*원/);
  const balance = balanceMatch ? toInt(balanceMatch[1]) : null;

  return { amount, sender, balance, raw: body };
}
