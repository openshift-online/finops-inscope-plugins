import { startTestBackend } from '@backstage/backend-test-utils';
import request from 'supertest';

import { finopsPlugin } from './plugin';

describe('finops backend plugin', () => {
  it('exposes health when Snowflake is not configured', async () => {
    const { server } = await startTestBackend({
      features: [finopsPlugin],
    });

    const res = await request(server).get('/api/finops/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'degraded',
    });
    expect(typeof res.body.reason).toBe('string');
  });

  it('returns 503 for API routes when Snowflake is not configured', async () => {
    const { server } = await startTestBackend({
      features: [finopsPlugin],
    });

    const res = await request(server).get('/api/finops/api/teams');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      detail: expect.stringMatching(/Snowflake not configured/),
    });
  });
});
