export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
  command?: string
  fields?: QueryField[]
}

export interface QueryField {
  name: string
  dataTypeID: number
}

export interface DatabaseDriver {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>
  findFirst?(table: string, where?: Record<string, any>): Promise<QueryResult<any> | null>
  findMany?(table: string, options?: { where?: Record<string, any>; limit?: number; offset?: number }): Promise<QueryResult<any>>
  insert?(table: string, data: Record<string, any>): Promise<QueryResult<any>>
  update?(table: string, data: Record<string, any>, where: Record<string, any>): Promise<QueryResult<any>>
  delete?(table: string, where: Record<string, any>): Promise<number>
  close(): Promise<void>
}

export interface TransactionCapable {
  transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T>
}

export interface PreparedStatementCapable {
  prepare(sql: string): Promise<PreparedStatement>
}

export interface PreparedStatement {
  execute<T = any>(params?: any[]): Promise<QueryResult<T>>
  finalize(): Promise<void>
}

export function hasTransactionSupport(driver: DatabaseDriver): driver is DatabaseDriver & TransactionCapable {
  return 'transaction' in driver && typeof (driver as any).transaction === 'function'
}

export function hasPreparedStatementSupport(driver: DatabaseDriver): driver is DatabaseDriver & PreparedStatementCapable {
  return 'prepare' in driver && typeof (driver as any).prepare === 'function'
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly driverType: string,
    public readonly originalError?: Error,
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class QueryError extends DatabaseError {
  constructor(driverType: string, sql: string, originalError?: Error) {
    super(`Query failed: ${sql}`, driverType, originalError)
    this.name = 'QueryError'
  }
}

export class ConnectionError extends DatabaseError {
  constructor(driverType: string, originalError?: Error) {
    super(`Failed to connect to ${driverType}`, driverType, originalError)
    this.name = 'ConnectionError'
  }
}

export interface DriverOptions {
  [key: string]: any
}
