import { createClient, type ResultSet } from '@libsql/client'
import type { UnifiedQueryResult } from '..'

export interface LibSQLConfig {
  url: string
  authToken?: string
}

export class LibSQLDriver {
  private client: ReturnType<typeof createClient>

  constructor(private options: LibSQLConfig) {
    this.client = createClient({
      url: this.options.url,
      ...(this.options.authToken ? { authToken: this.options.authToken } : {}),
    })
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

  public async query<T extends Record<string, any>>(query: string, params?: (string | number | boolean | null)[]): Promise<{ rows: T[]; rowCount: number; command?: string }> {
    try {
      const result = await this.client.execute(query, params)

      return this.convertLibsqlResult<T>(result)
    } catch (error) {
      console.error('LibSQL query error:', error)
      throw error
    }
  }

  public async close(): Promise<void> {
    try {
      this.client.close()
    } catch (error) {
      console.error('Error closing LibSQL client:', error)
    }
  }
}
