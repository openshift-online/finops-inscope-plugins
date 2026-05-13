import { Config } from '@backstage/config';

type FinopsSnowflakeAuth =
  | {
      method: 'password';
      password: string;
    }
  | {
      method: 'keypair';
      privateKeyPath: string;
      privateKeyPassphrase?: string;
    };

export type FinopsSnowflakeConfig = {
  account: string;
  user: string;
  warehouse: string;
  database: string;
  schema: string;
  role?: string;
  queryTag: string;
  poolMaxSize: number;
  table: string;
  dimTeamTable: string;
  bridgeTeamScopeTable: string;
  auth: FinopsSnowflakeAuth;
};

function required(config: Config, path: string): string {
  const value = config.getOptionalString(path)?.trim();
  if (!value) {
    throw new Error(`Missing required config: ${path}`);
  }
  return value;
}

export function readFinopsSnowflakeConfig(rootConfig: Config): FinopsSnowflakeConfig {
  const cfg = rootConfig.getOptionalConfig('finops.snowflake');
  if (!cfg) {
    throw new Error('Missing config section: finops.snowflake');
  }

  const password = cfg.getOptionalString('password')?.trim();
  const privateKeyPath = cfg.getOptionalString('privateKeyPath')?.trim();

  let auth: FinopsSnowflakeAuth;
  if (password) {
    auth = { method: 'password', password };
  } else if (privateKeyPath) {
    auth = {
      method: 'keypair',
      privateKeyPath,
      privateKeyPassphrase: cfg.getOptionalString('privateKeyPassphrase')?.trim() || undefined,
    };
  } else {
    throw new Error(
      'Missing Snowflake auth: set finops.snowflake.password or finops.snowflake.privateKeyPath',
    );
  }

  return {
    account: required(cfg, 'account'),
    user: required(cfg, 'user'),
    warehouse: required(cfg, 'warehouse'),
    database: required(cfg, 'database'),
    schema: required(cfg, 'schema'),
    role: cfg.getOptionalString('role')?.trim() || undefined,
    queryTag: cfg.getOptionalString('queryTag')?.trim() || 'finops-backend',
    poolMaxSize: cfg.getOptionalNumber('poolMaxSize') ?? 8,
    table: cfg.getOptionalString('table')?.trim() || 'cra_scope_costs',
    dimTeamTable: cfg.getOptionalString('dimTeamTable')?.trim() || 'cra_team_directory',
    bridgeTeamScopeTable:
      cfg.getOptionalString('bridgeTeamScopeTable')?.trim() || 'cra_team_attributed_scopes',
    auth,
  };
}
