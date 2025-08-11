# DriftSQL

[![npm version](https://img.shields.io/npm/v/driftsql?color=yellow)](https://npmjs.com/package/driftsql)
[![npm downloads](https://img.shields.io/npm/dm/driftsql?color=yellow)](https://npm.chart.dev/driftsql)

A lightweight, type-safe SQL client for TypeScript that supports multiple database drivers. Import only what you need.

## Features

- 🔐 **Type-safe** - Full TypeScript support with generics
- 🚀 **Modular** - Import only the drivers you need
- 🛡️ **SQL injection protection** - Parameterized queries by default
- 🔄 **Unified API** - Same interface across all drivers
- ⚡ **Multiple drivers** - PostgreSQL, LibSQL, MySQL, SQLite
- 🎯 **Custom drivers** - Easy to implement your own drivers

## Installation

```sh
npm install driftsql
```

## Basic Usage

### Import Individual Drivers

```typescript
import { PostgresDriver, LibSQLDriver, MySQLDriver, SqliteDriver, SQLClient } from 'driftsql'

// Use PostgreSQL
const postgresDriver = new PostgresDriver({
  connectionString: 'postgresql://user:password@localhost:5432/mydb'
})

// Use LibSQL/Turso
const libsqlDriver = new LibSQLDriver({
  url: 'libsql://your-database.turso.io',
  authToken: 'your-auth-token'
})

// Use MySQL
const mysqlDriver = new MySQLDriver({
  connectionString: 'mysql://user:password@localhost:3306/mydb'
})

// Use SQLite
const sqliteDriver = new SqliteDriver({
  filename: './database.db'
})

// Create a client with any driver
const client = new SQLClient({ driver: postgresDriver })
```

### Factory Functions

```typescript
import { createPostgresClient, createLibSQLClient, createMySQLClient, createSqliteClient } from 'driftsql'

// Quick setup
const postgresClient = createPostgresClient({
  connectionString: 'postgresql://user:password@localhost:5432/mydb'
})

const libsqlClient = createLibSQLClient({
  url: 'file:local.db'
})

const mysqlClient = createMySQLClient({
  connectionString: 'mysql://user:password@localhost:3306/mydb'
})

const sqliteClient = createSqliteClient({
  filename: './database.db'
})
```

## Database Operations

### Raw Queries

```typescript
// Type-safe queries
interface User {
  id: number
  name: string
  email: string
}

const result = await client.query<User>('SELECT * FROM users WHERE id = $1', [1])
console.log(result.rows) // User[]
console.log(result.rowCount) // number
```

### Helper Methods

```typescript
// Define your database schema
interface MyDatabase {
  users: User
  posts: Post
}

const client = new SQLClient<MyDatabase>({ driver: postgresDriver })

// Find operations
const user = await client.findFirst('users', { email: 'user@example.com' })
const users = await client.findMany('users', { 
  where: { active: true },
  limit: 10 
})

// Insert
const newUser = await client.insert('users', {
  name: 'John Doe',
  email: 'john@example.com'
})

// Update
const updatedUser = await client.update('users', 
  { name: 'Jane Doe' }, 
  { id: 1 }
)

// Delete
const deletedCount = await client.delete('users', { id: 1 })
```

## Transactions

```typescript
// Check if driver supports transactions
if (client.supportsTransactions()) {
  await client.transaction(async (txClient) => {
    await txClient.insert('users', { name: 'User 1', email: 'user1@example.com' })
    await txClient.insert('users', { name: 'User 2', email: 'user2@example.com' })
    // Both inserts will be committed together
  })
}
```

## Custom Drivers

Implement your own database driver:

```typescript
import type { DatabaseDriver, QueryResult } from 'driftsql'

class MyCustomDriver implements DatabaseDriver {
  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    // Your implementation here
    return {
      rows: [], // T[]
      rowCount: 0,
      command: 'SELECT'
    }
  }

  async close(): Promise<void> {
    // Cleanup logic
  }
}

// Use your custom driver
const client = new SQLClient({ driver: new MyCustomDriver() })
```

## Driver-Specific Features

### PostgreSQL HTTP Support

```typescript
const postgresDriver = new PostgresDriver({
  experimental: {
    http: {
      url: 'https://your-postgres-http-api.com',
      apiKey: 'your-api-key'
    }
  }
})
```

### LibSQL with Turso Serverless

```typescript
const libsqlDriver = new LibSQLDriver({
  url: 'libsql://your-database.turso.io',
  authToken: 'your-auth-token',
  useTursoServerlessDriver: true
})
```

### SQLite with Prepared Statements

```typescript
const sqliteDriver = new SqliteDriver({ filename: './db.sqlite' })
const client = new SQLClient({ driver: sqliteDriver })

if (client.supportsPreparedStatements()) {
  const stmt = await client.prepare('SELECT * FROM users WHERE id = ?')
  const result = await stmt.execute([1])
  await stmt.finalize()
}
```

## Error Handling

```typescript
import { DatabaseError, QueryError, ConnectionError } from 'driftsql'

try {
  await client.query('SELECT * FROM users')
} catch (error) {
  if (error instanceof QueryError) {
    console.log('Query failed:', error.message)
    console.log('Driver:', error.driverType)
  } else if (error instanceof ConnectionError) {
    console.log('Connection failed:', error.message)
  }
}
```

## Fallback Drivers

```typescript
// Use multiple drivers with automatic fallback
const client = new SQLClient({
  driver: primaryDriver,
  fallbackDrivers: [backupDriver1, backupDriver2]
})

// Will try drivers in order until one succeeds
const result = await client.query('SELECT 1')
```

## API Reference

### DatabaseDriver Interface

```typescript
interface DatabaseDriver {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>
  close(): Promise<void>
}
```

### SQLClient

```typescript
class SQLClient<DT = any> {
  constructor(options: { driver: DatabaseDriver; fallbackDrivers?: DatabaseDriver[] })
  
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>
  findFirst<K extends keyof DT>(table: K, where?: Partial<DT[K]>): Promise<DT[K] | null>
  findMany<K extends keyof DT>(table: K, options?: FindManyOptions<DT[K]>): Promise<DT[K][]>
  insert<K extends keyof DT>(table: K, data: Partial<DT[K]>): Promise<DT[K]>
  update<K extends keyof DT>(table: K, data: Partial<DT[K]>, where: Partial<DT[K]>): Promise<DT[K] | null>
  delete<K extends keyof DT>(table: K, where: Partial<DT[K]>): Promise<number>
  
  transaction<T>(callback: (client: SQLClient<DT>) => Promise<T>): Promise<T>
  prepare(sql: string): Promise<PreparedStatement>
  
  getDriver(): DatabaseDriver
  supportsTransactions(): boolean
  supportsPreparedStatements(): boolean
  close(): Promise<void>
}
```

## License

Published under the [MIT](https://github.com/lassejlv/driftsql/blob/main/LICENSE) license.