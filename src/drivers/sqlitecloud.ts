import { Database } from '@sqlitecloud/drivers'
import { QueryError, type DatabaseDriver, type QueryResult } from '../types'

export interface SqliteCloudDriverOptions {
  connectionString: string
}

export class SqliteCloudDriver implements DatabaseDriver {
  private client: Database

  constructor(private readonly options: SqliteCloudDriverOptions) {
    this.client = new Database(this.options.connectionString)
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const result = await this.client.sql(sql, params)

      // SQLiteCloud returns an array of SQLiteCloudRow objects
      // Each row has the data as properties and helper methods like getData()
      const rows = Array.isArray(result)
        ? result.map((row: any) => {
            const data: any = {}
            for (const key in row) {
              if (typeof row[key] !== 'function') {
                data[key] = row[key]
              }
            }
            return data
          })
        : []

      return {
        rows: rows as T[],
        rowCount: rows.length,
        command: undefined,
      }
    } catch (error) {
      throw new QueryError('sqlitecloud', sql, error as Error)
    }
  }

  async prepare(sql: string) {
    return this.client.prepare(sql)
  }

  async close() {
    this.client.close()
  }
}
