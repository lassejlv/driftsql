import consola from 'consola'
import ky from 'ky'

import { Pool, type PoolConfig } from 'pg'
import { createClient, type Config as LibsqlClientConfig, type ResultSet } from '@libsql/client'
import { neon } from '@neondatabase/serverless'
import postgres from 'postgres'
import mysql from 'mysql2/promise'
import inspectDB from './pull'

// Unified result type that works with both pg and libsql
type UnifiedQueryResult<T extends Record<string, any>> = {
  rows: T[]
  rowCount: number
  command?: string
  fields?: Array<{ name: string; dataTypeID: number }>
}

export interface ClientOptions {
  url?: string
  password?: string
  drivers?: {
    libsql?: LibsqlClientConfig
    postgres?: PoolConfig
    mysql?: mysql.ConnectionOptions
  }
  options?: {
    defaultTimeout?: number
  }
}

export class DriftSQLClient<DT> {
  private client: typeof ky
  private pool?: Pool
  private mysqlClient?: ReturnType<typeof mysql.createConnection>
  private libsqlClient?: ReturnType<typeof createClient>
  private neonClient?: ReturnType<typeof neon>
  private postgresClient?: ReturnType<typeof postgres>
  private drivers: Record<string, any>

  constructor(options: ClientOptions) {
    this.client = ky.create({
      prefixUrl: options.url,
      headers: {
        Authorization: `Bearer ${options.password}`,
      },
      timeout: options.options?.defaultTimeout || 5000,
      hooks: {
        afterResponse: [
          async (request, options, response) => {
            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`HTTP Error: ${response.status} - ${errorText}`)
            }
            return response
          },
        ],
      },
    })

    this.pool = options.drivers?.postgres ? new Pool(options.drivers.postgres) : undefined
    this.libsqlClient = options.drivers?.libsql ? createClient(options.drivers.libsql) : undefined
    this.mysqlClient = options.drivers?.mysql ? mysql.createConnection(options.drivers.mysql) : undefined
    this.drivers = options.drivers || {}
  }

  private convertLibsqlResult<T extends Record<string, any>>(result: ResultSet): UnifiedQueryResult<T> {
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

  readonly inspect = async (): Promise<void> => {
    return inspectDB(this.drivers)
  }

  async query<T extends Record<string, any>>(query: string, args?: (string | number | boolean | null)[]): Promise<UnifiedQueryResult<T>> {
    // Try PostgreSQL pool first
    if (this.pool) {
      try {
        await this.pool.connect()
        const result = await this.pool.query(query, args || [])
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command,
          fields: result.fields,
        }
      } catch (error) {
        consola.error('Failed to connect to PostgreSQL pool:', error)
      }
    }

    // Try MySQL client
    if (this.mysqlClient) {
      try {
        consola.warn('MySQL client is experimental and may not be compatible with the helper functions, since they originally designed for PostgreSQL and libsql. But .query() method should work.')
        const [rows, fields] = await (await this.mysqlClient).execute(query, args || [])
        return {
          rows: rows as T[],
          rowCount: Array.isArray(rows) ? rows.length : 0,
          command: undefined, // MySQL does not return command info
          fields: fields.map((field: any) => ({ name: field.name, dataTypeID: field.columnType })),
        }
      } catch (error) {
        consola.error('Failed to execute query with MySQL:', error)
        throw error
      }
    }

    // Try PostgreSQL faster client
    if (this.postgresClient) {
      try {
        const result = await this.postgresClient.unsafe(query, args || [])
        //

        return {
          // @ts-ignore - postgres library returns rows directly
          rows: result as T[],
          rowCount: result.length,
          command: undefined,
          fields: [], // postgres library does not provide field info
        }
      } catch (error) {
        consola.error('Failed to execute query with postgres:', error)
        throw error
      }
    }

    // Try libsql client
    if (this.libsqlClient) {
      try {
        const result = await this.libsqlClient.execute({
          sql: query,
          args: args || [],
        })
        return this.convertLibsqlResult<T>(result)
      } catch (error) {
        consola.error('Failed to execute query with libsql:', error)
        throw error
      }
    }

    // Fallback to HTTP
    try {
      const response = await this.client.post('query', {
        json: { query, args: args || [] },
      })
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Query failed: ${JSON.stringify(error)}`)
    }
  }

  async status(): Promise<{ ok: boolean; ping: number }> {
    // only work with HTTP client
    if (!this.client) {
      throw new Error('HTTP client is not configured')
    }
    const response = await this.client.get('status')
    return response.json()
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
    if (this.pool) {
      await this.pool.end()
    }
    if (this.libsqlClient) {
      this.libsqlClient.close()
    }

    if (this.mysqlClient) {
      await (await this.mysqlClient).end()
    }

    if (this.postgresClient) {
      await this.postgresClient.end()
    }
  }
}

export { inspectDB } from './pull'
