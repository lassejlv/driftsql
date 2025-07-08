import consola from 'consola'
import * as mysql from 'mysql2/promise'
import type { UnifiedQueryResult } from '..'

export interface MySQLConfig {
  connectionString: string
}

export class MySQLDriver {
  private client: ReturnType<typeof mysql.createConnection>

  constructor(private options: MySQLConfig) {
    consola.warn('MySQL client is experimental and may not be compatible with the helper functions, since they originally designed for PostgreSQL and libsql. But .query() method should work.')

    this.client = mysql.createConnection(this.options.connectionString)
  }

  public async query<T extends Record<string, any>>(query: string, params?: (string | number | boolean | null)[]): Promise<UnifiedQueryResult<T>> {
    try {
      const [rows, fields] = await (await this.client).execute(query, params || [])
      const rowCount = Array.isArray(rows) ? rows.length : 0

      return {
        rows: rows as T[],
        rowCount,
        command: undefined,
        fields: fields.map((field: any) => ({ name: field.name, dataTypeID: field.columnType })),
      }
    } catch (error) {
      consola.error('MySQL query error:', error)
      throw error
    }
  }

  public async close(): Promise<void> {
    try {
      await (await this.client).end()
    } catch (error) {
      consola.error('Error closing MySQL client:', error)
    }
  }
}
