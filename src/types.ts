// Core result type for all database operations
export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
  command?: string
  fields?: QueryField[]
}

// Field information for query results
export interface QueryField {
  name: string
  dataTypeID: number
}

// Base driver interface that all drivers must implement
export interface DatabaseDriver {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>
  close(): Promise<void>
}

// Optional interfaces for advanced features
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

// Type guards
export function hasTransactionSupport(driver: DatabaseDriver): driver is DatabaseDriver & TransactionCapable {
  return 'transaction' in driver && typeof (driver as any).transaction === 'function'
}

export function hasPreparedStatementSupport(driver: DatabaseDriver): driver is DatabaseDriver & PreparedStatementCapable {
  return 'prepare' in driver && typeof (driver as any).prepare === 'function'
}

// Error classes
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

// Generic driver options
export interface DriverOptions {
  [key: string]: any
}
