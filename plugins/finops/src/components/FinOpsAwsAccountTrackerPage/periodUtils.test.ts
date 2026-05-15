import { normalizePeriod, periodToUtcMs } from './periodUtils';

describe('periodUtils', () => {
  it('sorts chronologically by numeric time not lexicographic string', () => {
    const periods = ['2026-10-01', '2026-02-01', '2026-12-01'];
    const sorted = [...periods].sort((a, b) => periodToUtcMs(a) - periodToUtcMs(b));
    expect(sorted).toEqual(['2026-02-01', '2026-10-01', '2026-12-01']);
  });

  it('normalizes ISO date strings', () => {
    expect(normalizePeriod('2026-01-05T12:00:00.000Z')).toBe('2026-01-05');
  });
});
