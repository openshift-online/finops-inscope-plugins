import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';
import { readFinopsSnowflakeConfig } from './config';
import { FinopsRepository } from './repository';
import { createFinopsRouter } from './router';
import { SnowflakeConnectionPool } from './snowflakeClient';

export default createBackendPlugin({
  pluginId: 'finops',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        rootConfig: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, rootConfig }) {
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
        const router = createFinopsRouter({ repository, logger });

        httpRouter.addAuthPolicy({ path: '/api/:rest*', allow: 'unauthenticated' });
        httpRouter.use(router);
        logger.info('FinOps Snowflake backend API initialized');
      },
    });
  },
});
