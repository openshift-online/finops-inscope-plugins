import { validateDateRange } from './dateRangeUtils';

describe('validateDateRange', () => {
  it('accepts a valid inclusive range', () => {
    expect(validateDateRange('2026-01-01', '2026-01-31')).toEqual({
      valid: true,
      range: { fromDate: '2026-01-01', toDate: '2026-01-31' },
    });
  });

  it('rejects incomplete dates', () => {
    expect(validateDateRange('', '2026-01-31')).toMatchObject({
      valid: false,
    });
    expect(validateDateRange('2026-01-01', '')).toMatchObject({
      valid: false,
    });
  });

  it('rejects from after to', () => {
    expect(validateDateRange('2026-02-01', '2026-01-01')).toMatchObject({
      valid: false,
      message: expect.stringContaining('on or before'),
    });
  });
});
