import { buildAwsAccountsChartModels } from './buildAwsAccountsChartModels';

describe('buildAwsAccountsChartModels', () => {
  it('returns empty array when no points', () => {
    expect(buildAwsAccountsChartModels([])).toEqual([]);
  });

  it('builds all payers aggregate and per-payer charts', () => {
    const models = buildAwsAccountsChartModels([
      {
        period: '2026-01-15',
        payer_account_id: '111',
        active_count: 10,
        closed_count: 1,
        deleted_count: 0,
      },
      {
        period: '2026-01-15',
        payer_account_id: '222',
        active_count: 20,
        closed_count: 2,
        deleted_count: 1,
      },
    ]);

    expect(models).toHaveLength(3);
    expect(models[0]).toMatchObject({
      id: 'all',
      title: 'All payers',
      chartData: [
        expect.objectContaining({
          period: '2026-01-15',
          periodTime: Date.UTC(2026, 0, 15),
          active_count: 30,
          closed_count: 3,
          deleted_count: 1,
        }),
      ],
    });
    expect(models[1]).toMatchObject({ id: '111', title: 'Payer 111' });
    expect(models[2]).toMatchObject({ id: '222', title: 'Payer 222' });
  });
});
