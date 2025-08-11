import consola from 'consola'
import * as mysql from 'mysql2/promise'
import type { DatabaseDriver, QueryResult, TransactionCapable } from '../types'
import { QueryError, ConnectionError } from '../types'

export interface MySQLConfig {
  connectionString: string
}

export class MySQLDriver implements DatabaseDriver, TransactionCapable {
  private client: ReturnType<typeof mysql.createConnection>

  constructor(config: MySQLConfig) {
    consola.warn('MySQL client is experimental and may not be compatible with the helper functions, since they originally designed for PostgreSQL and libsql. But .query() method should work.')

    try {
      this.client = mysql.createConnection(config.connectionString)
    } catch (error) {
      throw new ConnectionError('mysql', error as Error)
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const [rows, fields] = await (await this.client).execute(sql, params || [])
      const rowCount = Array.isArray(rows) ? rows.length : 0

      const normalizedFields = fields.map((field: any) => ({
        name: field.name,
        dataTypeID: field.columnType,
      }))

      return {
        rows: rows as T[],
        rowCount,
        command: undefined,
        fields: normalizedFields,
      }
    } catch (error) {
      throw new QueryError('mysql', sql, error as Error)
    }
  }

  async transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    const connection = await this.client

    try {
      await connection.beginTransaction()

      const transactionDriver = new MySQLDriver({ connectionString: '' })
      transactionDriver.client = Promise.resolve(connection)

      const result = await callback(transactionDriver)

      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    }
  }

  async close(): Promise<void> {
    try {
      await (await this.client).end()
    } catch (error) {
      consola.error('Error closing MySQL client:', error)
    }
  }
}
