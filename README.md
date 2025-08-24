# DriftSQL

[![npm version](https://img.shields.io/npm/v/driftsql?color=yellow)](https://npmjs.com/package/driftsql)
[![npm downloads](https://img.shields.io/npm/dm/driftsql?color=yellow)](https://npm.chart.dev/driftsql)

A lightweight, type-safe SQL client for TypeScript with support for PostgreSQL, MySQL, and LibSQL/SQLite.

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
import { PostgresDriver, LibSQLDriver, MySQLDriver, SQLClient } from 'driftsql'

// PostgreSQL
const pg = new PostgresDriver({ connectionString: 'postgresql://...' })

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

## License

Published under the [MIT](https://github.com/lassejlv/driftsql/blob/main/LICENSE) license.
