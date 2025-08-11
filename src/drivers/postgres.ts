import postgres from 'postgres'
import ky from 'ky'
import type { DatabaseDriver, QueryResult, TransactionCapable } from '../types'
import { QueryError, ConnectionError } from '../types'

export interface PostgresConfig {
  connectionString?: string
  experimental?: {
    http?: {
      url: string
      apiKey?: string
    }
  }
}

export class PostgresDriver implements DatabaseDriver, TransactionCapable {
  private client: postgres.Sql | PostgresHTTPDriver

  constructor(config: PostgresConfig) {
    try {
      if (config.experimental?.http) {
        this.client = new PostgresHTTPDriver(config.experimental.http)
      } else {
        this.client = postgres(config.connectionString || '')
      }
    } catch (error) {
      throw new ConnectionError('postgres', error as Error)
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      if (this.client instanceof PostgresHTTPDriver) {
        return await this.client.query<T>(sql, params)
      }

      const result = await this.client.unsafe(sql, params || [])
      return {
        rows: result as unknown as T[],
        rowCount: Array.isArray(result) ? result.length : 0,
        command: undefined,
      }
    } catch (error) {
      throw new QueryError('postgres', sql, error as Error)
    }
  }

  async transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    if (this.client instanceof PostgresHTTPDriver) {
      throw new Error('Transactions not supported with HTTP driver')
    }

    const result = await this.client.begin(async (sql) => {
      const transactionDriver = new PostgresDriver({ connectionString: '' })
      transactionDriver.client = sql
      return await callback(transactionDriver)
    })
    return result as T
  }

  async close(): Promise<void> {
    try {
      if (this.client instanceof PostgresHTTPDriver) {
        return await this.client.close()
      }
      await this.client.end()
    } catch (error) {
      console.error('Error closing Postgres client:', error)
    }
  }
}

class PostgresHTTPDriver {
  private httpClient: typeof ky

  constructor(config: { url: string; apiKey?: string }) {
    this.httpClient = ky.create({
      prefixUrl: config.url,
      headers: {
        Authorization: `Bearer ${config.apiKey || ''}`,
      },
    })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const response = await this.httpClient
        .post('query', {
          json: { query: sql, params },
        })
        .json<{ rows: T[]; rowCount: number }>()

      return {
        rows: response.rows,
        rowCount: response.rowCount,
        command: undefined,
      }
    } catch (error) {
      throw new QueryError('postgres-http', sql, error as Error)
    }
  }

  async close(): Promise<void> {
    // HTTP connections don't need explicit closing
    return Promise.resolve()
  }
}
