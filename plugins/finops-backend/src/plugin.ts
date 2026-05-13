import { Router } from 'express';
import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { readFinopsSnowflakeConfig } from './config';
import { FinopsRepository } from './repository';
import { createFinopsRouter } from './router';
import { SnowflakeConnectionPool } from './snowflakeClient';

/**
 * FinOps backend plugin: CRA scope-cost API backed by Snowflake when configured.
 *
 * @public
 */
export const finopsPlugin = createBackendPlugin({
  pluginId: 'finops',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        rootConfig: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, rootConfig }) {
        let router: Router;

        try {
          const snowflakeConfig = readFinopsSnowflakeConfig(rootConfig);

          const pool = new SnowflakeConnectionPool({
            maxSize: snowflakeConfig.poolMaxSize,
            config: snowflakeConfig,
            logger,
          });
          const repository = new FinopsRepository({
            pool,
            tableFqn: pool.tableFqn(snowflakeConfig.table),
            dimTeamFqn: pool.tableFqn(snowflakeConfig.dimTeamTable),
            bridgeTeamScopeFqn: pool.tableFqn(snowflakeConfig.bridgeTeamScopeTable),
          });
          router = createFinopsRouter({ repository, logger });
          logger.info('FinOps Snowflake backend API initialized');
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.warn(
            `FinOps backend starting without Snowflake: ${msg}. ` +
              'Set finops.snowflake config to enable.',
          );
          router = Router();
          router.use('/api', (_req, res) => {
            res.status(503).json({
              detail: `Snowflake not configured: ${msg}`,
            });
          });
          router.get('/health', (_req, res) => {
            res.json({ status: 'degraded', reason: msg });
          });
        }

        httpRouter.addAuthPolicy({ path: '/api', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/health', allow: 'unauthenticated' });
        httpRouter.use(router);
      },
    });
  },
});
