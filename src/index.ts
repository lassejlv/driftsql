import consola from 'consola'
import type { DatabaseDriver, QueryResult } from './types'
import { hasTransactionSupport, hasPreparedStatementSupport, DatabaseError } from './types'
import { QueryError } from './types'

export type { DatabaseDriver, QueryResult, QueryError, QueryField, ConnectionError } from './types'
export { PostgresDriver } from './drivers/postgres'
export { LibSQLDriver } from './drivers/libsql'
export { MySQLDriver } from './drivers/mysql'
export { NeonDriver } from './drivers/neon'
export { inspectDB } from './pull'

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

  async findFirst<K extends keyof DT>(table: K, where?: Partial<DT[K]>): Promise<DT[K] | null> {
    if (!this.primaryDriver.findFirst) throw new DatabaseError('Primary driver does not support findFirst', this.primaryDriver.constructor.name)

    try {
      const response = await this.primaryDriver.findFirst(table as string, where)
      return response!.rows[0] || null
    } catch (error) {
      throw new QueryError('findFirst', `Error finding first in ${String(table)}`, error as Error)
    }
  }

  async findMany<K extends keyof DT>(
    table: K,
    options?: {
      where?: Partial<DT[K]>
      limit?: number
      offset?: number
    },
  ): Promise<DT[K][]> {
    if (!this.primaryDriver.findMany) throw new DatabaseError('Primary driver does not support findMany', this.primaryDriver.constructor.name)

    try {
      const response = await this.primaryDriver.findMany(table as string, options)
      return response.rows as DT[K][]
    } catch (error) {
      throw new QueryError('findMany', `Error finding many in ${String(table)}`, error as Error)
    }
  }

  async insert<K extends keyof DT>(table: K, data: Partial<DT[K]>): Promise<DT[K]> {
    if (!this.primaryDriver.insert) throw new DatabaseError('Primary driver does not support insert', this.primaryDriver.constructor.name)

    try {
      const response = await this.primaryDriver.insert(table as string, data)
      return response.rows[0] as DT[K]
    } catch (error) {
      throw new QueryError('insert', `Error inserting into ${String(table)}`, error as Error)
    }
  }

  async update<K extends keyof DT>(table: K, data: Partial<DT[K]>, where: Partial<DT[K]>): Promise<DT[K] | null> {
    if (!this.primaryDriver.update) throw new DatabaseError('Primary driver does not support update', this.primaryDriver.constructor.name)

    try {
      const response = await this.primaryDriver.update(table as string, data, where)
      return response.rows[0] || null
    } catch (error) {
      throw new QueryError('update', `Error updating ${String(table)}`, error as Error)
    }
  }

  async delete<K extends keyof DT>(table: K, where: Partial<DT[K]>): Promise<number> {
    if (!this.primaryDriver.delete) throw new DatabaseError('Primary driver does not support delete', this.primaryDriver.constructor.name)

    try {
      const affectedRows = await this.primaryDriver.delete(table as string, where)
      return affectedRows
    } catch (error) {
      throw new QueryError('delete', `Error deleting from ${String(table)}`, error as Error)
    }
  }

  getDriver(): DatabaseDriver {
    return this.primaryDriver
  }

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

// Legacy export for backward compatibility
export const DriftSQLClient = SQLClient
