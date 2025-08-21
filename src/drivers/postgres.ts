import postgres from 'postgres'
import ky from 'ky'
import type { DatabaseDriver, QueryResult, TransactionCapable } from '../types'
import { QueryError, ConnectionError } from '../types'

export interface PostgresConfig {
  connectionString?: string
  experimental?: {
    http?: {
      url: string
      apiKey?: string
    }
  }
}

export class PostgresDriver implements DatabaseDriver, TransactionCapable {
  private client: postgres.Sql | PostgresHTTPDriver

  constructor(config: PostgresConfig) {
    try {
      if (config.experimental?.http) {
        this.client = new PostgresHTTPDriver(config.experimental.http)
      } else {
        this.client = postgres(config.connectionString || '')
      }
    } catch (error) {
      throw new ConnectionError('postgres', error as Error)
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      if (this.client instanceof PostgresHTTPDriver) {
        return await this.client.query<T>(sql, params)
      }

      const result = await this.client.unsafe(sql, params || [])
      return {
        rows: result as unknown as T[],
        rowCount: Array.isArray(result) ? result.length : 0,
        command: undefined,
      }
    } catch (error) {
      throw new QueryError('postgres', sql, error as Error)
    }
  }

  async transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    if (this.client instanceof PostgresHTTPDriver) {
      throw new Error('Transactions not supported with HTTP driver')
    }

    const result = await this.client.begin(async (sql) => {
      const transactionDriver = new PostgresDriver({ connectionString: '' })
      transactionDriver.client = sql
      return await callback(transactionDriver)
    })
    return result as T
  }

  async findFirst<T = any>(table: string, where?: Record<string, any>): Promise<QueryResult<T> | null> {
    const whereEntries = Object.entries(where || {})
    let sql = `SELECT * FROM ${table}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
      sql += ` WHERE ${whereClause}`
      params = whereEntries.map(([, value]) => value)
    }

    sql += ' LIMIT 1'

    const result = await this.query<T>(sql, params)
    return result.rows.length > 0 ? result : null
  }

  async findMany<T = any>(table: string, options?: { where?: Record<string, any>; limit?: number; offset?: number }): Promise<QueryResult<T>> {
    if (this.client instanceof PostgresHTTPDriver) {
      return await this.client.findMany<T>(table, options)
    }

    const { where, limit, offset } = options || {}
    const whereEntries = Object.entries(where || {})

    let sql = `SELECT * FROM ${table}`
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

    return this.query<T>(sql, params)
  }

  async insert<T = any>(table: string, data: Record<string, any>): Promise<QueryResult<T>> {
    const tableName = String(table)
    const keys = Object.keys(data)
    const values = Object.values(data)

    if (keys.length === 0) {
      throw new Error('No data provided for insert')
    }

    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`
    const result = await this.query<T>(sql, values)
    if (!result.rows[0]) {
      throw new Error('Insert failed: No data returned')
    }

    return result
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

    const setClause = setEntries.map((_, index) => `${setEntries[index]?.[0]} = $${index + 1}`).join(', ')
    const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${setEntries.length + index + 1}`).join(' AND ')
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const params = [...setEntries.map(([, value]) => value), ...whereEntries.map(([, value]) => value)]
    const result = await this.query<T>(sql, params)
    return result.rows.length > 0 ? result : result
  }

  async delete<T = any>(table: string, where: Record<string, any>): Promise<number> {
    const tableName = String(table)
    const whereEntries = Object.entries(where)
    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for delete')
    }

    const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`
    const params = whereEntries.map(([, value]) => value)

    const result = await this.query<T>(sql, params)
    return result.rowCount
  }

  async close(): Promise<void> {
    try {
      if (this.client instanceof PostgresHTTPDriver) {
        return await this.client.close()
      }
      await this.client.end()
    } catch (error) {
      console.error('Error closing Postgres client:', error)
    }
  }
}

class PostgresHTTPDriver {
  private httpClient: typeof ky

  constructor(config: { url: string; apiKey?: string }) {
    this.httpClient = ky.create({
      prefixUrl: config.url,
      headers: {
        Authorization: `Bearer ${config.apiKey || ''}`,
      },
    })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const response = await this.httpClient
        .post('query', {
          json: { query: sql, args: params },
        })
        .json<{ rows: T[]; rowCount: number }>()

      return {
        rows: response.rows,
        rowCount: response.rowCount,
        command: undefined,
      }
    } catch (error) {
      throw new QueryError('postgres-http', sql, error as Error)
    }
  }

  async findFirst<T = any>(table: string, where?: Record<string, any>): Promise<QueryResult<T> | null> {
    const whereEntries = Object.entries(where || {})
    let sql = `SELECT * FROM ${table}`
    let params: any[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
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

    return this.query<T>(sql, params)
  }

  async insert<T = any>(table: string, data: Record<string, any>): Promise<QueryResult<T>> {
    const tableName = String(table)
    const keys = Object.keys(data)
    const values = Object.values(data)

    if (keys.length === 0) {
      throw new Error('No data provided for insert')
    }

    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`
    const result = await this.query<T>(sql, values)
    if (!result.rows[0]) {
      throw new Error('Insert failed: No data returned')
    }

    return result
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

    const setClause = setEntries.map((_, index) => `${setEntries[index]?.[0]} = $${index + 1}`).join(', ')
    const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${setEntries.length + index + 1}`).join(' AND ')
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const params = [...setEntries.map(([, value]) => value), ...whereEntries.map(([, value]) => value)]
    const result = await this.query<T>(sql, params)
    return result.rows.length > 0 ? result : result
  }

  async delete<T = any>(table: string, where: Record<string, any>): Promise<number> {
    const tableName = String(table)
    const whereEntries = Object.entries(where)
    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for delete')
    }

    const whereClause = whereEntries.map((_, index) => `${whereEntries[index]?.[0]} = $${index + 1}`).join(' AND ')
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`
    const params = whereEntries.map(([, value]) => value)

    const result = await this.query<T>(sql, params)
    return result.rowCount
  }

  async close(): Promise<void> {
    // HTTP connections don't need explicit closing
    return Promise.resolve()
  }
}
