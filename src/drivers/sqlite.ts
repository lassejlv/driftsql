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
