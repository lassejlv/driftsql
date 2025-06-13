import ky from 'ky'

import type { QueryResult, QueryResultRow } from 'pg'

export interface ClientOptions {
  url: string
  password: string
  options?: {
    defaultTimeout?: number
  }
}

export class PostgresHTTPClient {
  private client: typeof ky

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
  }

  async query<T extends QueryResultRow>(query: string, args?: string[]): Promise<QueryResult<T>> {
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
    const response = await this.client.get('status')
    return response.json()
  }

  async findFirst<T extends QueryResultRow>(where: Partial<T>, table: string): Promise<T | null> {
    const whereEntries = Object.entries(where)

    let query = `SELECT * FROM ${table}`
    let args: string[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
      query += ` WHERE ${whereClause}`
      args = whereEntries.map(([, value]) => String(value))
    }

    query += ' LIMIT 1'

    const result = await this.query<T>(query, args)
    return result.rows[0] || null
  }

  async findMany<T extends QueryResultRow>(where: Partial<T>, table: string): Promise<T[]> {
    const whereEntries = Object.entries(where)

    let query = `SELECT * FROM ${table}`
    let args: string[] = []

    if (whereEntries.length > 0) {
      const whereClause = whereEntries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
      query += ` WHERE ${whereClause}`
      args = whereEntries.map(([, value]) => String(value))
    }

    const result = await this.query<T>(query, args)
    return result.rows
  }

  async insert<T extends QueryResultRow>(table: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data)
    const values = Object.values(data)

    if (keys.length === 0) {
      throw new Error('No data provided for insert')
    }

    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`
    const args = values.map((value) => String(value))

    const result = await this.query<T>(query, args)

    if (!result.rows[0]) {
      throw new Error('Insert failed: No data returned')
    }

    return result.rows[0]
  }

  async update<T extends QueryResultRow>(table: string, data: Partial<T>, where: Partial<T>): Promise<T | null> {
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

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const args = [...setEntries.map(([, value]) => String(value)), ...whereEntries.map(([, value]) => String(value))]

    const result = await this.query<T>(query, args)

    return result.rows[0] || null
  }
  async delete<T extends QueryResultRow>(table: string, where: Partial<T>): Promise<boolean> {
    const whereEntries = Object.entries(where)

    if (whereEntries.length === 0) {
      throw new Error('No conditions provided for delete')
    }

    const whereClause = whereEntries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
    const query = `DELETE FROM ${table} WHERE ${whereClause}`
    const args = whereEntries.map(([, value]) => String(value))

    try {
      await this.query<T>(query, args)
      return true
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Delete failed: ${JSON.stringify(error)}`)
    }
  }

  deleteFirst<T extends QueryResultRow>(where: Partial<T>, table: string): Promise<boolean> {
    return this.delete<T>(table, where)
  }
}
