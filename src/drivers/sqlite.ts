import Database from 'better-sqlite3'
import type { DatabaseDriver, QueryResult, TransactionCapable, PreparedStatementCapable, PreparedStatement } from '../types'
import { QueryError, ConnectionError } from '../types'

export interface SqliteConfig {
  filename: string
  readonly?: boolean
}

export class SqliteDriver implements DatabaseDriver, TransactionCapable, PreparedStatementCapable {
  private client: Database.Database

  constructor(config: SqliteConfig) {
    try {
      this.client = new Database(config.filename, {
        readonly: config.readonly || false,
        fileMustExist: config.readonly || false,
      })
    } catch (error) {
      throw new ConnectionError('sqlite', error as Error)
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const stmt = this.client.prepare(sql)
      const rows = stmt.all(params || []) as T[]

      // Get column names from the first row if available
      const fields = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null ? Object.keys(rows[0] as object).map((name) => ({ name, dataTypeID: 0 })) : []

      return {
        rows,
        rowCount: rows.length,
        command: undefined,
        fields,
      }
    } catch (error) {
      throw new QueryError('sqlite', sql, error as Error)
    }
  }

  async transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    const transaction = this.client.transaction(() => {
      const transactionDriver = new SqliteDriver({ filename: '' })
      ;(transactionDriver as any).client = this.client
      return callback(transactionDriver)
    })

    return await transaction()
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    return new SqlitePreparedStatement(this.client.prepare(sql))
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
      const stmt = this.client.prepare(sql)
      const result = stmt.run(values)

      // For SQLite, we need to fetch the inserted row separately
      if (result.lastInsertRowid) {
        const selectSql = `SELECT * FROM ${tableName} WHERE rowid = ?`
        const insertedRow = await this.query<T>(selectSql, [result.lastInsertRowid])
        return {
          rows: insertedRow.rows,
          rowCount: result.changes,
          command: undefined,
          fields: insertedRow.fields,
        }
      }

      return {
        rows: [] as T[],
        rowCount: result.changes,
        command: undefined,
        fields: [],
      }
    } catch (error) {
      throw new QueryError('sqlite', sql, error as Error)
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
      const stmt = this.client.prepare(sql)
      const result = stmt.run(params)

      // Fetch updated rows
      const selectSql = `SELECT * FROM ${tableName} WHERE ${whereClause}`
      const selectParams = whereEntries.map(([, value]) => value)
      const updatedRows = await this.query<T>(selectSql, selectParams)

      return {
        rows: updatedRows.rows,
        rowCount: result.changes,
        command: undefined,
        fields: updatedRows.fields,
      }
    } catch (error) {
      throw new QueryError('sqlite', sql, error as Error)
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
      const stmt = this.client.prepare(sql)
      const result = stmt.run(params)
      return result.changes
    } catch (error) {
      throw new QueryError('sqlite', sql, error as Error)
    }
  }

  async close(): Promise<void> {
    try {
      this.client.close()
    } catch (error) {
      console.error('Error closing SQLite client:', error)
    }
  }

  // SQLite-specific methods
  exec(sql: string): void {
    this.client.exec(sql)
  }

  backup(filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client.backup(filename)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  pragma(pragma: string): any {
    return this.client.pragma(pragma)
  }
}

class SqlitePreparedStatement implements PreparedStatement {
  constructor(private stmt: Database.Statement) {}

  async execute<T = any>(params?: any[]): Promise<QueryResult<T>> {
    try {
      const rows = this.stmt.all(params || []) as T[]
      const fields = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null ? Object.keys(rows[0] as object).map((name) => ({ name, dataTypeID: 0 })) : []

      return {
        rows,
        rowCount: rows.length,
        command: undefined,
        fields,
      }
    } catch (error) {
      throw new QueryError('sqlite', 'prepared statement', error as Error)
    }
  }

  async finalize(): Promise<void> {
    // better-sqlite3 doesn't have finalize method, we can just ignore this
    return Promise.resolve()
  }

  // SQLite-specific methods for prepared statements
  run(params?: any[]): Database.RunResult {
    return this.stmt.run(params || [])
  }

  get(params?: any[]): any {
    return this.stmt.get(params || [])
  }

  all(params?: any[]): any[] {
    return this.stmt.all(params || [])
  }
}
