import type { DatabaseDriver, QueryResult } from '../types'
import Surreal from 'surrealdb'
import { QueryError } from '../types'
import consola from 'consola'

interface SurrealConfig {
  url: string
  namespace: string
  database: string
  auth: {
    username: string
    password: string
  }
}

export class SurrealDriver implements DatabaseDriver {
  private client: Surreal

  constructor(config: SurrealConfig) {
    consola.warn('SurrealDriver is very experimental and not all functions from the sdk are supported. It is only used for testing purposes.')
    this.client = new Surreal()

    this.client.connect(config.url, {
      namespace: config.namespace,
      database: config.database,
      auth: config.auth,
    })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      if (params) throw new QueryError('surreal', sql, new Error('SurrealDB does need params'))

      const dbResult = await this.client.query(sql)

      return {
        rows: dbResult as unknown as T[],
        rowCount: (dbResult as unknown as any[]).length,
      }
    } catch (error) {
      throw new QueryError('surreal', sql, error as Error)
    }
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
