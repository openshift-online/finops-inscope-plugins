import { formatPayerChartTitle, getPayerAccountName } from './payerAccountLabels';

describe('payerAccountLabels', () => {
  it('returns known payer names', () => {
    expect(getPayerAccountName('922711891673')).toBe('rhcontrol');
    expect(getPayerAccountName('811685182089')).toBe('osd-staging-2');
    expect(getPayerAccountName('277304166082')).toBe('osd-staging-1');
  });

  it('resolves rhcontrol with leading-zero account id', () => {
    expect(getPayerAccountName('022711891673')).toBe('rhcontrol');
  });

  it('formats chart titles with name when known', () => {
    expect(formatPayerChartTitle('811685182089')).toBe('osd-staging-2 (811685182089)');
  });

  it('falls back to payer id only when unknown', () => {
    expect(formatPayerChartTitle('123456789012')).toBe('Payer 123456789012');
  });
});
