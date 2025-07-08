import consola from 'consola'

import inspectDB from './pull'

import { PostgresDriver, type PostgresConfig } from './drivers/postgres'
import { type LibSQLConfig, LibSQLDriver } from './drivers/libsql'
import { type MySQLConfig, MySQLDriver } from './drivers/mysql'

// Unified result type that works with both pg and libsql
export type UnifiedQueryResult<T extends Record<string, any>> = {
  rows: T[]
  rowCount: number
  command?: string
  fields?: Array<{ name: string; dataTypeID: number }>
}

export interface ClientOptions {
  drivers: {
    libsql?: LibSQLConfig
    postgres?: PostgresConfig
    mysql?: MySQLConfig
  }
}

export class DriftSQLClient<DT> {
  private postgres?: PostgresDriver
  private libsql?: LibSQLDriver
  private mysql?: MySQLDriver
  private drivers: Record<string, any>

  constructor(options: ClientOptions) {
    this.postgres = options.drivers?.postgres ? new PostgresDriver({ connectionString: options.drivers.postgres.connectionString! }) : undefined
    this.libsql = options.drivers?.libsql ? new LibSQLDriver(options.drivers.libsql) : undefined
    this.mysql = options.drivers?.mysql ? new MySQLDriver(options.drivers.mysql) : undefined
    this.drivers = options.drivers || {}
  }

  readonly inspect = async (): Promise<void> => {
    return inspectDB(this.drivers)
  }

  async query<T extends Record<string, any>>(query: string, args?: (string | number | boolean | null)[]): Promise<UnifiedQueryResult<T>> {
    if (this.postgres) {
      try {
        const result = await this.postgres.query<T>(query, args || [])
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command,
          fields: result.fields?.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })) || [],
        }
      } catch (error) {
        consola.error('Failed to execute query with PostgreSQL:', error)
        throw error
      }
    }

    // Try MySQL client
    if (this.mysql) {
      try {
        const result = await this.mysql.query<T>(query, args || [])
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command,
          fields: result.fields?.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })) || [],
        }
      } catch (error) {
        consola.error('Failed to execute query with MySQL:', error)
        throw error
      }
    }

    // Try libsql client
    if (this.libsql) {
      try {
        const result = await this.libsql.query<T>(query, args || [])
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command,
          fields: undefined,
        }
      } catch (error) {
        consola.error('Failed to execute query with LibSQL:', error)
        throw error
      }
    }

    const error = new Error('No database driver is configured or all drivers failed to execute the query')
    consola.error(error)
    throw error
  }

  async findFirst<K extends keyof DT>(table: K, where?: Partial<DT[K]>): Promise<DT[K] | null> {
    const tableName = String(table)
    const whereEntries = Object.entries(where || {})

    let query = `SELECT * FROM ${tableName}`
    let args: (string | number | boolean | null)[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
      query += ` WHERE ${whereClause}`
      args = whereEntries.map(([, value]) => value as string | number | boolean | null)
    }

    query += ' LIMIT 1'

    const result = await this.query<DT[K] & Record<string, any>>(query, args)
    return result.rows[0] || null
  }

  async findMany<K extends keyof DT>(
    table: K,
    options?: {
      where?: Partial<DT[K]>
      limit?: number
    },
  ): Promise<DT[K][]> {
    const tableName = String(table)

    const { where, limit } = options || {}
    const whereEntries = Object.entries(where || {})

    let query = `SELECT * FROM ${tableName}`
    let args: (string | number | boolean | null)[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
      query += ` WHERE ${whereClause}`
      args = whereEntries.map(([, value]) => value as string | number | boolean | null)
    }

    if (typeof limit === 'number' && limit > 0) {
      query += ` LIMIT $${args.length + 1}`
      args.push(limit)
    }

    const result = await this.query<DT[K] & Record<string, any>>(query, args)
    return result.rows
  }

  async insert<K extends keyof DT>(table: K, data: Partial<DT[K]>): Promise<DT[K]> {
    const tableName = String(table)
    const keys = Object.keys(data)
    const values = Object.values(data).map((value) => value as string | number | boolean | null)

    if (keys.length === 0) {
      throw new Error('No data provided for insert')
    }

    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`

    const result = await this.query<DT[K] & Record<string, any>>(query, values)

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

    const setClause = setEntries.map(([key], index) => `${key} = $${index + 1}`).join(', ')
    const whereClause = whereEntries.map(([key], index) => `${key} = $${setEntries.length + index + 1}`).join(' AND ')

    const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const args = [...setEntries.map(([, value]) => value as string | number | boolean | null), ...whereEntries.map(([, value]) => value as string | number | boolean | null)]

    const result = await this.query<DT[K] & Record<string, any>>(query, args)
    return result.rows[0] || null
  }

  async delete<K extends keyof DT>(table: K, where: Partial<DT[K]>): Promise<boolean> {
    const tableName = String(table)
    const whereEntries = Object.entries(where)

    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for delete')
    }

    const whereClause = whereEntries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
    const query = `DELETE FROM ${tableName} WHERE ${whereClause}`
    const args = whereEntries.map(([, value]) => value as string | number | boolean | null)

    const result = await this.query<DT[K] & Record<string, any>>(query, args)
    return (result.rowCount || 0) > 0
  }

  deleteFirst<K extends keyof DT>(table: K, where: Partial<DT[K]>): Promise<boolean> {
    return this.delete<K>(table, where)
  }

  async close(): Promise<void> {
    if (this.postgres) {
      await this.postgres.close()
    }

    if (this.libsql) {
      this.libsql.close()
    }

    if (this.mysql) {
      await this.mysql.close()
    }
  }
}

export { inspectDB } from './pull'
