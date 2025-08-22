import { neon } from '@neondatabase/serverless'
import { type DatabaseDriver, QueryError, type QueryResult } from '../types'

export interface NeonDriverOptions {
  connectionString: string
}

export class NeonDriver implements DatabaseDriver {
  private client: ReturnType<typeof neon>

  constructor(options: NeonDriverOptions) {
    this.client = neon(options.connectionString)
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const resp = await this.client.query(sql, params)

      return {
        rows: resp as T[],
        rowCount: (resp as any[]).length || 0,
      }
    } catch (error) {
      throw new QueryError('neon', `Failed to query database: ${error}`)
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

  close(): Promise<void> {
    return Promise.resolve()
  }
}
