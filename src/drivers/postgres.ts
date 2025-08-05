import postgres from 'postgres'

import type { UnifiedQueryResult } from '../index'
import type { DriverOptions } from '../types'

import ky from 'ky'

export interface PostgresConfig {
  connectionString?: string
  options?: DriverOptions<{
    experimental?: {
      /**
       * Enable experimental postgres http support. Using github.com/lassejlv/postgres_http
       */
      http?: {
        url: string
        apiKey?: string
      }
    }
  }>
}

export class PostgresDriver {
  private client: postgres.Sql | PostgresHTTPDriver

  constructor(private options: PostgresConfig) {
    if (this.options.options?.experimental?.http) {
      this.client = new PostgresHTTPDriver(this.options.options.experimental)
    } else {
      this.client = postgres(this.options.connectionString || '')
    }
  }

  async query<T extends Record<string, any>>(query: string, params?: (string | number | boolean | null)[]): Promise<UnifiedQueryResult<T>> {
    try {
      if (this.client instanceof PostgresHTTPDriver) {
        return await this.client.query<T>(query, params)
      }

      // This is a postgres.Sql client
      const result = await this.client.unsafe(query, params)

      return {
        rows: result as unknown as T[],
        rowCount: result.length,
        command: undefined,
      }
    } catch (error) {
      console.error('Postgres query error:', error)
      throw error
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client instanceof PostgresHTTPDriver) {
        return await this.client.close()
      }

      // This is a postgres.Sql client
      await this.client.end()
    } catch (error) {
      console.error('Error closing Postgres client:', error)
      throw error
    }
  }
}

export class PostgresHTTPDriver {
  private httpClient: typeof ky

  constructor(options: NonNullable<PostgresConfig['options']>['experimental']) {
    if (!options || !options.http || !options.http.url) {
      throw new Error('Postgres HTTP driver requires a valid URL in options.http')
    }

    this.httpClient = ky.create({
      prefixUrl: options.http.url,
      headers: {
        Authorization: `Bearer ${options.http.apiKey || ''}`,
      },
    })
  }

  async query<T extends Record<string, any>>(query: string, params?: (string | number | boolean | null)[]): Promise<UnifiedQueryResult<T>> {
    try {
      const response = await this.httpClient
        .post('query', {
          json: {
            query,
            params,
          },
        })
        .json<{ rows: T[]; rowCount: number }>()

      return {
        rows: response.rows,
        rowCount: response.rowCount,
        command: undefined,
      }
    } catch (error) {
      console.error('Postgres HTTP query error:', error)
      throw error
    }
  }

  async close(): Promise<void> {
    // HTTP connections don't need explicit closing
    return Promise.resolve()
  }
}
