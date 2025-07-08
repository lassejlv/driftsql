import postgres from 'postgres'

import type { UnifiedQueryResult } from '../index'

export interface PostgresConfig {
  connectionString: string
}

export class PostgresDriver {
  private client: postgres.Sql

  constructor(private options: PostgresConfig) {
    this.client = postgres(this.options.connectionString)
  }

  async query<T extends Record<string, any>>(query: string, params?: (string | number | boolean | null)[]): Promise<UnifiedQueryResult<T>> {
    try {
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
      await this.client.end()
    } catch (error) {
      console.error('Error closing Postgres client:', error)
      throw error
    }
  }
}
