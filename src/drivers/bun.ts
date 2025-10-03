import { SQL } from 'bun'
import { type DatabaseDriver, type QueryResult, QueryError } from '../types'
import consola from 'consola'

interface BunConfig {
  connectionString: string
  adapter: 'postgres' | 'mysql' | 'mariadb' | 'sqlite'
}

export class BunDriver implements DatabaseDriver {
  private client: SQL
  private adapter: string

  constructor(config: BunConfig) {
    if (!Bun) {
      throw new Error('BunDriver is only supported in Bun runtime')
    }

    consola.warn('BunDriver only supports helper functions for PostgreSQL for now. But you can still use the query method.')

    this.adapter = config.adapter
    this.client = new SQL({
      url: config.connectionString,
      adapter: config.adapter === 'postgres' ? 'postgres' : config.adapter === 'mysql' ? 'mysql' : config.adapter === 'mariadb' ? 'mariadb' : 'sqlite',
    })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const response = await this.client.unsafe(sql, params)

      return {
        rows: response as unknown as T[],
        rowCount: (response as unknown as any[]).length,
      }
    } catch (error) {
      throw new QueryError('bun', sql, error as Error)
    }
  }

  async findFirst<T = any>(table: string, where?: Record<string, any>): Promise<QueryResult<T> | null> {
    if (this.adapter !== 'postgres') {
      throw new Error('Helper functions are only supported for PostgreSQL adapter')
    }

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
    if (this.adapter !== 'postgres') {
      throw new Error('Helper functions are only supported for PostgreSQL adapter')
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
    if (this.adapter !== 'postgres') {
      throw new Error('Helper functions are only supported for PostgreSQL adapter')
    }

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
    if (this.adapter !== 'postgres') {
      throw new Error('Helper functions are only supported for PostgreSQL adapter')
    }

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
    if (this.adapter !== 'postgres') {
      throw new Error('Helper functions are only supported for PostgreSQL adapter')
    }

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
    await this.client.close()
  }
}
