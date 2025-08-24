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

  async findFirst<T = any>(table: string, where?: Record<string, any>): Promise<QueryResult<T> | null> {
    const whereEntries = Object.entries(where || {})
    let sql = `SELECT * FROM ${table}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map(([key]) => `${key} = ?`).join(' AND ')
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
      const whereClause = whereEntries.map(([key]) => `${key} = ?`).join(' AND ')
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
      const connection = await this.client
      const [result] = await connection.execute(sql, values)

      // For MySQL, try to fetch the inserted row using LAST_INSERT_ID()
      const insertResult = result as any
      if (insertResult.insertId) {
        try {
          const selectSql = `SELECT * FROM ${tableName} WHERE id = ?`
          const insertedRow = await this.query<T>(selectSql, [insertResult.insertId])
          return {
            rows: insertedRow.rows,
            rowCount: insertResult.affectedRows || 0,
            command: undefined,
            fields: insertedRow.fields,
          }
        } catch {
          // If we can't fetch the inserted row, return empty result with affected rows count
          return {
            rows: [] as T[],
            rowCount: insertResult.affectedRows || 0,
            command: undefined,
            fields: [],
          }
        }
      }

      return {
        rows: [] as T[],
        rowCount: insertResult.affectedRows || 0,
        command: undefined,
        fields: [],
      }
    } catch (error) {
      throw new QueryError('mysql', sql, error as Error)
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
      const connection = await this.client
      const [result] = await connection.execute(sql, params)

      // Fetch updated rows
      const selectSql = `SELECT * FROM ${tableName} WHERE ${whereClause}`
      const selectParams = whereEntries.map(([, value]) => value)
      const updatedRows = await this.query<T>(selectSql, selectParams)

      const updateResult = result as any
      return {
        rows: updatedRows.rows,
        rowCount: updateResult.affectedRows || 0,
        command: undefined,
        fields: updatedRows.fields,
      }
    } catch (error) {
      throw new QueryError('mysql', sql, error as Error)
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
      const connection = await this.client
      const [result] = await connection.execute(sql, params)
      const deleteResult = result as any
      return deleteResult.affectedRows || 0
    } catch (error) {
      throw new QueryError('mysql', sql, error as Error)
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
