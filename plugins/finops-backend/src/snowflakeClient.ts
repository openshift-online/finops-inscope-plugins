import * as snowflake from 'snowflake-sdk';
import { LoggerService } from '@backstage/backend-plugin-api';
import { FinopsSnowflakeConfig } from './config';

type Connection = snowflake.Connection;

type PendingCheckout = {
  resolve: (connection: Connection) => void;
  reject: (error: unknown) => void;
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function fqn(database: string, schema: string, table: string): string {
  return `${quoteIdentifier(database)}.${quoteIdentifier(schema)}.${quoteIdentifier(
    table.toUpperCase(),
  )}`;
}

export class SnowflakeConnectionPool {
  private readonly maxSize: number;
  private readonly config: FinopsSnowflakeConfig;
  private readonly logger: LoggerService;
  private readonly idle: Connection[] = [];
  private readonly pending: PendingCheckout[] = [];
  private openConnections = 0;

  constructor(options: {
    maxSize: number;
    config: FinopsSnowflakeConfig;
    logger: LoggerService;
  }) {
    this.maxSize = Math.max(1, options.maxSize);
    this.config = options.config;
    this.logger = options.logger;
  }

  tableFqn(tableName: string): string {
    return fqn(this.config.database, this.config.schema, tableName);
  }

  async execute<T = Record<string, unknown>>(
    sqlText: string,
    binds: snowflake.Binds = [],
  ): Promise<T[]> {
    const connection = await this.checkout();
    try {
      const rows = await this.executeOnConnection<T>(connection, sqlText, binds);
      this.checkin(connection);
      return rows;
    } catch (error) {
      this.discard(connection);
      throw error;
    }
  }

  private async checkout(): Promise<Connection> {
    const idle = this.idle.pop();
    if (idle) {
      return idle;
    }

    if (this.openConnections < this.maxSize) {
      this.openConnections += 1;
      try {
        return await this.createConnection();
      } catch (error) {
        this.openConnections -= 1;
        throw error;
      }
    }

    return await new Promise<Connection>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  private checkin(connection: Connection): void {
    const waiter = this.pending.shift();
    if (waiter) {
      waiter.resolve(connection);
      return;
    }
    this.idle.push(connection);
  }

  private discard(connection: Connection): void {
    try {
      connection.destroy(err => {
        if (err) {
          this.logger.warn(`finops snowflake destroy failed: ${String(err)}`);
        }
      });
    } catch {
      // ignore close errors
    } finally {
      this.openConnections = Math.max(0, this.openConnections - 1);
      const waiter = this.pending.shift();
      if (waiter) {
        this.createConnection()
          .then(conn => {
            this.openConnections += 1;
            waiter.resolve(conn);
          })
          .catch(waiter.reject);
      }
    }
  }

  private async createConnection(): Promise<Connection> {
    const baseOptions: snowflake.ConnectionOptions = {
      account: this.config.account,
      username: this.config.user,
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema,
      role: this.config.role,
      application: 'backstage-finops',
    };

    const connectionOptions: snowflake.ConnectionOptions =
      this.config.auth.method === 'password'
        ? {
            ...baseOptions,
            password: this.config.auth.password,
          }
        : {
            ...baseOptions,
            authenticator: 'SNOWFLAKE_JWT',
            privateKeyPath: this.config.auth.privateKeyPath,
            privateKeyPass: this.config.auth.privateKeyPassphrase,
          };

    const connection = snowflake.createConnection(connectionOptions);
    await new Promise<void>((resolve, reject) => {
      connection.connect(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await this.executeOnConnection(connection, `use warehouse ${quoteIdentifier(this.config.warehouse)}`);
    await this.executeOnConnection(connection, `use database ${quoteIdentifier(this.config.database)}`);
    await this.executeOnConnection(connection, `use schema ${quoteIdentifier(this.config.schema)}`);
    if (this.config.queryTag) {
      await this.executeOnConnection(
        connection,
        `alter session set query_tag = ${quoteLiteral(this.config.queryTag)}`,
      );
    }

    return connection;
  }

  private async executeOnConnection<T>(
    connection: Connection,
    sqlText: string,
    binds: snowflake.Binds = [],
  ): Promise<T[]> {
    return await new Promise<T[]>((resolve, reject) => {
      connection.execute({
        sqlText,
        binds,
        complete: (error, _statement, rows) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(((rows as T[] | undefined) ?? []) as T[]);
        },
      });
    });
  }
}
