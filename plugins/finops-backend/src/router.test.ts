import { mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import type { FinopsRepository } from './repository';
import { createFinopsRouter } from './router';

describe('createFinopsRouter', () => {
  let app: express.Express;
  let repository: Pick<
    FinopsRepository,
    | 'listTeams'
    | 'listScopes'
    | 'listTeamsForScopes'
    | 'getTrends'
    | 'getSummary'
    | 'getAwsAccountsHistorical'
    | 'getAwsAccountsLatestPeriod'
  >;

  beforeEach(() => {
    repository = {
      listTeams: jest.fn().mockResolvedValue([]),
      listScopes: jest.fn().mockResolvedValue([]),
      listTeamsForScopes: jest.fn().mockResolvedValue([]),
      getTrends: jest.fn().mockResolvedValue([]),
      getSummary: jest.fn().mockResolvedValue({
        metric: 'unblended_amount',
        scope: null,
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        total: 0,
        previous_total: 0,
        delta: 0,
        delta_percent: null,
      }),
      getAwsAccountsHistorical: jest.fn().mockResolvedValue([
        {
          period: '2026-01-15',
          payer_account_id: '022711891673',
          active_count: 100,
          closed_count: 1,
          deleted_count: 0,
        },
      ]),
      getAwsAccountsLatestPeriod: jest.fn().mockResolvedValue({ period: '2026-01-19' }),
    };

    const router = createFinopsRouter({
      repository: repository as FinopsRepository,
      logger: mockServices.logger.mock(),
    });
    app = express();
    app.use(router);
  });

  it('returns health ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('lists teams', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns AWS accounts historical data', async () => {
    const res = await request(app).get(
      '/api/aws-accounts/historical?from=2026-01-01&to=2026-01-31',
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(repository.getAwsAccountsHistorical).toHaveBeenCalledWith({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });
  });

  it('returns 400 for invalid AWS accounts historical date range', async () => {
    const res = await request(app).get(
      '/api/aws-accounts/historical?from=not-a-date&to=2026-01-31',
    );
    expect(res.status).toBe(400);
  });

  it('returns AWS accounts latest period', async () => {
    const res = await request(app).get('/api/aws-accounts/latest-period');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ period: '2026-01-19' });
  });
});
