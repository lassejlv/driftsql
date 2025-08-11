import consola from 'consola'
import type { DatabaseDriver, QueryResult } from './types'
import { hasTransactionSupport, hasPreparedStatementSupport, DatabaseError } from './types'

// Re-export types and drivers for convenience
export type { DatabaseDriver, QueryResult } from './types'
export { PostgresDriver } from './drivers/postgres'
export { LibSQLDriver } from './drivers/libsql'
export { MySQLDriver } from './drivers/mysql'
export { SqliteDriver } from './drivers/sqlite'

export interface ClientOptions<T extends DatabaseDriver = DatabaseDriver> {
  driver: T
  fallbackDrivers?: DatabaseDriver[]
}

export class SQLClient<DT = any> {
  private primaryDriver: DatabaseDriver
  private fallbackDrivers: DatabaseDriver[]

  constructor(options: ClientOptions) {
    this.primaryDriver = options.driver
    this.fallbackDrivers = options.fallbackDrivers || []
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const drivers = [this.primaryDriver, ...this.fallbackDrivers]
    let lastError: Error | undefined

    for (const driver of drivers) {
      try {
        return await driver.query<T>(sql, params)
      } catch (error) {
        lastError = error as Error
        consola.warn(`Query failed with ${driver.constructor.name}:`, error)
        continue
      }
    }

    throw lastError || new DatabaseError('All drivers failed to execute query', 'unknown')
  }

  async transaction<T>(callback: (client: SQLClient<DT>) => Promise<T>): Promise<T> {
    if (!hasTransactionSupport(this.primaryDriver)) {
      throw new DatabaseError('Primary driver does not support transactions', this.primaryDriver.constructor.name)
    }

    return await this.primaryDriver.transaction(async (transactionDriver) => {
      const transactionClient = new SQLClient<DT>({
        driver: transactionDriver,
        fallbackDrivers: [],
      })
      return await callback(transactionClient)
    })
  }

  async prepare(sql: string) {
    if (!hasPreparedStatementSupport(this.primaryDriver)) {
      throw new DatabaseError('Primary driver does not support prepared statements', this.primaryDriver.constructor.name)
    }

    return await this.primaryDriver.prepare(sql)
  }

  // Helper methods for common database operations
  async findFirst<K extends keyof DT>(table: K, where?: Partial<DT[K]>): Promise<DT[K] | null> {
    const tableName = String(table)
    const whereEntries = Object.entries(where || {})

    let sql = `SELECT * FROM ${tableName}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
      sql += ` WHERE ${whereClause}`
      params = whereEntries.map(([, value]) => value)
    }

    sql += ' LIMIT 1'

    const result = await this.query<DT[K]>(sql, params)
    return result.rows[0] || null
  }

  async findMany<K extends keyof DT>(
    table: K,
    options?: {
      where?: Partial<DT[K]>
      limit?: number
      offset?: number
    },
  ): Promise<DT[K][]> {
    const tableName = String(table)
    const { where, limit, offset } = options || {}
    const whereEntries = Object.entries(where || {})

    let sql = `SELECT * FROM ${tableName}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
      sql += ` WHERE ${whereClause}`
      params = whereEntries.map(([, value]) => value)
    }

    if (typeof limit === 'number' && limit > 0) {
      sql += ` LIMIT $${params.length + 1}`
      params.push(limit)
    }

    if (typeof offset === 'number' && offset > 0) {
      sql += ` OFFSET $${params.length + 1}`
      params.push(offset)
    }

    const result = await this.query<DT[K]>(sql, params)
    return result.rows
  }

  async insert<K extends keyof DT>(table: K, data: Partial<DT[K]>): Promise<DT[K]> {
    const tableName = String(table)
    const keys = Object.keys(data)
    const values = Object.values(data)

    if (keys.length === 0) {
      throw new Error('No data provided for insert')
    }

    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`

    const result = await this.query<DT[K]>(sql, values)

    if (!result.rows[0]) {
      throw new Error('Insert failed: No data returned')
    }

    return result.rows[0]
  }

  async update<K extends keyof DT>(table: K, data: Partial<DT[K]>, where: Partial<DT[K]>): Promise<DT[K] | null> {
    const tableName = String(table)
    const setEntries = Object.entries(data)
    const whereEntries = Object.entries(where)

    if (setEntries.length === 0) {
      throw new Error('No data provided for update')
    }

    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for update')
    }

    const setClause = setEntries.map((_, index) => `${setEntries[index]?.[0]} = $${index + 1}`).join(', ')
    const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${setEntries.length + index + 1}`).join(' AND ')

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const params = [...setEntries.map(([, value]) => value), ...whereEntries.map(([, value]) => value)]

    const result = await this.query<DT[K]>(sql, params)
    return result.rows[0] || null
  }

  async delete<K extends keyof DT>(table: K, where: Partial<DT[K]>): Promise<number> {
    const tableName = String(table)
    const whereEntries = Object.entries(where)

    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for delete')
    }

    const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`
    const params = whereEntries.map(([, value]) => value)

    const result = await this.query<DT[K]>(sql, params)
    return result.rowCount || 0
  }

  // Get the primary driver (useful for driver-specific operations)
  getDriver(): DatabaseDriver {
    return this.primaryDriver
  }

  // Check driver capabilities
  supportsTransactions(): boolean {
    return hasTransactionSupport(this.primaryDriver)
  }

  supportsPreparedStatements(): boolean {
    return hasPreparedStatementSupport(this.primaryDriver)
  }

  async close(): Promise<void> {
    const drivers = [this.primaryDriver, ...this.fallbackDrivers]
    await Promise.all(drivers.map((driver) => driver.close().catch((err) => consola.warn(`Error closing ${driver.constructor.name}:`, err))))
  }
}

// Factory functions for common use cases
export function createPostgresClient<DT = any>(config: { connectionString?: string; experimental?: { http?: { url: string; apiKey?: string } } }) {
  const { PostgresDriver } = require('./drivers/postgres')
  return new SQLClient<DT>({ driver: new PostgresDriver(config) })
}

export function createLibSQLClient<DT = any>(config: { url: string; authToken?: string; useTursoServerlessDriver?: boolean }) {
  const { LibSQLDriver } = require('./drivers/libsql')
  return new SQLClient<DT>({ driver: new LibSQLDriver(config) })
}

export function createMySQLClient<DT = any>(config: { connectionString: string }) {
  const { MySQLDriver } = require('./drivers/mysql')
  return new SQLClient<DT>({ driver: new MySQLDriver(config) })
}

export function createSqliteClient<DT = any>(config: { filename: string; readonly?: boolean }) {
  const { SqliteDriver } = require('./drivers/sqlite')
  return new SQLClient<DT>({ driver: new SqliteDriver(config) })
}

// Legacy export for backward compatibility
export const DriftSQLClient = SQLClient
