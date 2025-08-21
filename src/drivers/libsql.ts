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
      const result = await this.client.execute(sql, values)

      // For LibSQL, try to fetch the inserted row using last_insert_rowid()
      if (result.lastInsertRowid) {
        try {
          const selectSql = `SELECT * FROM ${tableName} WHERE rowid = ?`
          const insertedRow = await this.query<T>(selectSql, [result.lastInsertRowid])
          return {
            rows: insertedRow.rows,
            rowCount: result.rowsAffected || 0,
            command: undefined,
            fields: insertedRow.fields,
          }
        } catch {
          // If we can't fetch the inserted row, return empty result with affected rows count
          return {
            rows: [] as T[],
            rowCount: result.rowsAffected || 0,
            command: undefined,
            fields: [],
          }
        }
      }

      return {
        rows: [] as T[],
        rowCount: result.rowsAffected || 0,
        command: undefined,
        fields: [],
      }
    } catch (error) {
      throw new QueryError('libsql', sql, error as Error)
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
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`
    const params = [...setEntries.map(([, value]) => value), ...whereEntries.map(([, value]) => value)]

    try {
      const result = await this.client.execute(sql, params)

      // Fetch updated rows
      const selectSql = `SELECT * FROM ${tableName} WHERE ${whereClause}`
      const selectParams = whereEntries.map(([, value]) => value)
      const updatedRows = await this.query<T>(selectSql, selectParams)

      return {
        rows: updatedRows.rows,
        rowCount: result.rowsAffected || 0,
        command: undefined,
        fields: updatedRows.fields,
      }
    } catch (error) {
      throw new QueryError('libsql', sql, error as Error)
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
      const result = await this.client.execute(sql, params)
      return result.rowsAffected || 0
    } catch (error) {
      throw new QueryError('libsql', sql, error as Error)
    }
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
