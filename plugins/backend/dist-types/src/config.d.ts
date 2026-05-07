import { Config } from '@backstage/config';
type FinopsSnowflakeAuth = {
    method: 'password';
    password: string;
} | {
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
export declare function readFinopsSnowflakeConfig(rootConfig: Config): FinopsSnowflakeConfig;
export {};
