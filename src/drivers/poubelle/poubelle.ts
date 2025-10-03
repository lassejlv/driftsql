import consola from 'consola'
import { QueryError, type DatabaseDriver, type QueryResult } from '../../types'
import PoubelleClient from './client'

interface PoubelleConfig {
  connectionString: string
}

export class PoubelleDriver implements DatabaseDriver {
  private client: PoubelleClient

  constructor(config: PoubelleConfig) {
    if (!Bun) {
      throw new Error('PoubelleDriver is only supported in Bun runtime')
    }

    consola.warn('PoubelleDriver is experimental, please use with caution')

    this.client = new PoubelleClient(config.connectionString)
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      if (params) throw new Error('PoubelleDriver does not support params')

      const result = await this.client.query(sql)

      return {
        rows: result as unknown as T[],
        rowCount: 0,
      }
    } catch (error) {
      throw new QueryError('poubelle', sql, error as Error)
    }
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
