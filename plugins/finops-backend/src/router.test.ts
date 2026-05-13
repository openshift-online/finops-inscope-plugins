import { mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import type { FinopsRepository } from './repository';
import { createFinopsRouter } from './router';

describe('createFinopsRouter', () => {
  let app: express.Express;

  beforeEach(() => {
    const repository: Pick<
      FinopsRepository,
      'listTeams' | 'listScopes' | 'listTeamsForScopes' | 'getTrends' | 'getSummary'
    > = {
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
});
