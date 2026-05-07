import * as snowflake from 'snowflake-sdk';
import { LoggerService } from '@backstage/backend-plugin-api';
import { FinopsSnowflakeConfig } from './config';
export declare class SnowflakeConnectionPool {
    private readonly maxSize;
    private readonly config;
    private readonly logger;
    private readonly idle;
    private readonly pending;
    private openConnections;
    constructor(options: {
        maxSize: number;
        config: FinopsSnowflakeConfig;
        logger: LoggerService;
    });
    tableFqn(tableName: string): string;
    execute<T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds): Promise<T[]>;
    private checkout;
    private checkin;
    private discard;
    private createConnection;
    private executeOnConnection;
}
