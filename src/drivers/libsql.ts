import { createClient, type ResultSet } from '@libsql/client'
import { createClient as tursoServerLessClient, type ResultSet as tursoServerLessResultSet } from '@tursodatabase/serverless/compat'
import type { DatabaseDriver, QueryResult, TransactionCapable } from '../types'
import { QueryError, ConnectionError } from '../types'

export interface LibSQLConfig {
  url: string
  authToken?: string
  useTursoServerlessDriver?: boolean
}

export class LibSQLDriver implements DatabaseDriver, TransactionCapable {
  private client: ReturnType<typeof createClient> | ReturnType<typeof tursoServerLessClient>

  constructor(config: LibSQLConfig) {
    try {
      this.client = config.useTursoServerlessDriver
        ? tursoServerLessClient({
            url: config.url,
            ...(config.authToken ? { authToken: config.authToken } : {}),
          })
        : createClient({
            url: config.url,
            ...(config.authToken ? { authToken: config.authToken } : {}),
          })
    } catch (error) {
      throw new ConnectionError('libsql', error as Error)
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const result = await this.client.execute(sql, params)
      return this.convertLibsqlResult<T>(result)
    } catch (error) {
      throw new QueryError('libsql', sql, error as Error)
    }
  }

  async transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    const transactionDriver = new LibSQLDriver({ url: '', authToken: '' })
    ;(transactionDriver as any).client = this.client
    return await callback(transactionDriver)
  }

  async close(): Promise<void> {
    try {
      this.client.close()
    } catch (error) {
      console.error('Error closing LibSQL client:', error)
    }
  }

  private convertLibsqlResult<T = any>(result: ResultSet | tursoServerLessResultSet): QueryResult<T> {
    const rows = result.rows.map((row) => {
      const obj: Record<string, any> = {}
      result.columns.forEach((col, index) => {
        obj[col] = row[index]
      })
      return obj as T
    })

    return {
      rows,
      rowCount: result.rowsAffected || rows.length,
      command: undefined,
      fields: result.columns.map((col) => ({ name: col, dataTypeID: 0 })),
    }
  }
}
