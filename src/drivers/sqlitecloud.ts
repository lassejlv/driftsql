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

  async findFirst<T = any>(table: string, where?: Record<string, any>): Promise<QueryResult<T> | null> {
    const whereEntries = Object.entries(where || {})
    let sql = `SELECT * FROM ${table}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = ?`).join(' AND ')
      sql += ` WHERE ${whereClause}`
      params = whereEntries.map(([, value]) => value)
    }

    sql += ' LIMIT 1'

    const result = await this.query<T>(sql, params)
    return result.rows.length > 0 ? result : null
  }

  async findMany<T = any>(table: string, options?: { where?: Record<string, any>; limit?: number; offset?: number }): Promise<QueryResult<T>> {
    const { where, limit, offset } = options || {}
    const whereEntries = Object.entries(where || {})

    let sql = `SELECT * FROM ${table}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = ?`).join(' AND ')
      sql += ` WHERE ${whereClause}`
      params = whereEntries.map(([, value]) => value)
    }

    if (typeof limit === 'number' && limit > 0) {
      sql += ` LIMIT ?`
      params.push(limit)
    }

    if (typeof offset === 'number' && offset > 0) {
      sql += ` OFFSET ?`
      params.push(offset)
    }

    return this.query<T>(sql, params)
  }

  async insert<T = any>(table: string, data: Record<string, any>): Promise<QueryResult<T>> {
    const tableName = String(table)
    const keys = Object.keys(data)
    const values = Object.values(data)

    if (keys.length === 0) {
      throw new Error('No data provided for insert')
    }

    const placeholders = keys.map(() => '?').join(', ')
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`

    try {
      const result = await this.query<T>(sql, values)

      // For SQLiteCloud, we get the inserted data directly from the result
      // If no rows returned, try to fetch using RETURNING clause
      if (result.rows.length === 0) {
        const returningSql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`
        return await this.query<T>(returningSql, values)
      }

      return result
    } catch (error) {
      throw new QueryError('sqlitecloud', sql, error as Error)
    }
  }

  async update<T = any>(table: string, data: Record<string, any>, where: Record<string, any>): Promise<QueryResult<T>> {
    const tableName = String(table)
    const setEntries = Object.entries(data)
    const whereEntries = Object.entries(where)

    if (setEntries.length === 0) {
      throw new Error('No data provided for update')
    }

    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for update')
    }

    const setClause = setEntries.map(([key]) => `${key} = ?`).join(', ')
    const whereClause = whereEntries.map(([key]) => `${key} = ?`).join(' AND ')
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const params = [...setEntries.map(([, value]) => value), ...whereEntries.map(([, value]) => value)]

    try {
      const result = await this.query<T>(sql, params)
      return result
    } catch (error) {
      throw new QueryError('sqlitecloud', sql, error as Error)
    }
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    const tableName = String(table)
    const whereEntries = Object.entries(where)

    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for delete')
    }

    const whereClause = whereEntries.map(([key]) => `${key} = ?`).join(' AND ')
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`
    const params = whereEntries.map(([, value]) => value)

    try {
      const result = await this.query(sql, params)
      return result.rowCount
    } catch (error) {
      throw new QueryError('sqlitecloud', sql, error as Error)
    }
  }

  async close() {
    this.client.close()
  }
}
