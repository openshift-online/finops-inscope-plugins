/** Known payer account IDs → display names (12-digit AWS account numbers). */
const PAYER_ACCOUNT_NAMES: Record<string, string> = {
  '922711891673': 'rhcontrol',
  '811685182089': 'osd-staging-2',
  '277304166082': 'osd-staging-1',
};

function normalizePayerAccountId(payerAccountId: string): string {
  return payerAccountId.replace(/\D/g, '');
}

export function getPayerAccountName(payerAccountId: string): string | null {
  const digits = normalizePayerAccountId(payerAccountId);
  if (!digits) {
    return null;
  }
  return PAYER_ACCOUNT_NAMES[digits] ?? PAYER_ACCOUNT_NAMES[digits.padStart(12, '0')] ?? null;
}

export function formatPayerChartTitle(payerAccountId: string): string {
  const name = getPayerAccountName(payerAccountId);
  if (name) {
    return `${name} (${payerAccountId})`;
  }
  return `Payer ${payerAccountId}`;
}
