import { createBackend } from '@backstage/backend-defaults';
import { mockServices } from '@backstage/backend-test-utils';

// Local dev backend for the FinOps plugin. From repo root: yarn workspace @internal/backstage-plugin-finops-backend start
//
// With `finops.snowflake` in app-config.yaml:
//   curl http://localhost:7007/api/finops/health
//   curl "http://localhost:7007/api/finops/api/scopes"
//   curl "http://localhost:7007/api/finops/api/teams"
//
// Without Snowflake config, /health is degraded and /api/* returns 503.

const backend = createBackend();

backend.add(mockServices.auth.factory());
backend.add(mockServices.httpAuth.factory());

backend.add(import('../src'));

backend.start();
