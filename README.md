# DriftSQL

[![npm version](https://img.shields.io/npm/v/driftsql?color=yellow)](https://npmjs.com/package/driftsql)
[![npm downloads](https://img.shields.io/npm/dm/driftsql?color=yellow)](https://npm.chart.dev/driftsql)

A lightweight, type-safe SQL client for TypeScript with support for PostgreSQL, MySQL, LibSQL/SQLite, and Neon.

## Installation

```sh
npm install driftsql
```

## Features

- 🔐 **Type-safe** - Full TypeScript support
- 🚀 **Modular** - Import only what you need
- 🛡️ **SQL injection protection** - Parameterized queries
- 🔄 **Unified API** - Same interface across all drivers
- ⚡ **Transactions** - When supported by the driver

## Quick Start

```typescript
import { PostgresDriver, SQLClient } from 'driftsql'

// Choose your database
const driver = new PostgresDriver({
  connectionString: 'postgresql://user:password@localhost:5432/mydb',
})
const client = new SQLClient({ driver })

// Raw queries
const result = await client.query('SELECT * FROM users WHERE id = $1', [1])

// Helper methods
const user = await client.findFirst('users', { email: 'user@example.com' })
const newUser = await client.insert('users', { name: 'John', email: 'john@example.com' })
```

## Supported Databases

```typescript
import { PostgresDriver, LibSQLDriver, MySQLDriver, NeonDriver, SQLClient } from 'driftsql'

// PostgreSQL
const pg = new PostgresDriver({ connectionString: 'postgresql://...' })

// Neon
const neon = new NeonDriver({ connectionString: 'postgresql://...' })

// LibSQL/Turso/SQLite
const libsql = new LibSQLDriver({ url: 'libsql://...', authToken: '...' })
// or for local SQLite: new LibSQLDriver({ url: 'file:./database.db' })

// MySQL
const mysql = new MySQLDriver({ connectionString: 'mysql://...' })

// Create client with any driver
const client = new SQLClient({ driver: pg })
```

## Custom Drivers

You can easily create your own database drivers by implementing the `DatabaseDriver` interface:

```typescript
import type { DatabaseDriver, QueryResult } from 'driftsql'

class MyCustomDriver implements DatabaseDriver {
  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    // Your implementation here
    return {
      rows: [], // T[]
      rowCount: 0,
      command: 'SELECT',
    }
  }

  async close(): Promise<void> {
    // Cleanup logic
  }
}

// Use your custom driver
const client = new SQLClient({ driver: new MyCustomDriver() })
```

## Database Inspection

Generate TypeScript interfaces from your database schema:

```typescript
import { inspectDB, PostgresDriver } from 'driftsql'

const driver = new PostgresDriver({
  connectionString: 'postgresql://user:password@localhost:5432/mydb',
})

// Generate types for all tables
await inspectDB({
  driver,
  outputFile: 'db-types.ts', // optional, defaults to 'db-types.ts'
})
```

This will create a file with TypeScript interfaces for each table:

```typescript
// Generated db-types.ts
export interface Users {
  id: number
  name: string
  email: string
  created_at: Date
  active: boolean | null
}

export interface Posts {
  id: number
  title: string
  content: string
  user_id: number
  published: boolean
}

export interface Database {
  users: Users
  posts: Posts
}
```

Then use the generated types with your client:

```typescript
import type { Database } from './db-types'
import { PostgresDriver, SQLClient } from 'driftsql'

const client = new SQLClient<Database>({ driver })

// Now you get full type safety
const user = await client.findFirst('users', { email: 'test@example.com' }) // Returns Users | null
const posts = await client.findMany('posts', { where: { published: true } }) // Returns Posts[]
```

## License

Published under the [MIT](https://github.com/lassejlv/driftsql/blob/main/LICENSE) license.
