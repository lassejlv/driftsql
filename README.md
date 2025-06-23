# DriftSQL

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/driftsql?color=yellow)](https://npmjs.com/package/driftsql)
[![npm downloads](https://img.shields.io/npm/dm/driftsql?color=yellow)](https://npm.chart.dev/driftsql)

<!-- /automd -->

A lightweight SQL client for TypeScript, supporting multiple databases like PostgreSQL, LibSQL, and HTTP-based database services. DriftSQL provides a unified, type-safe interface for database operations across different database drivers.

## Features

- 🔐 Type-safe database operations with TypeScript generics
- 🛡️ SQL injection protection with parameterized queries
- 🚀 Multiple driver support (PostgreSQL, LibSQL, HTTP)
- 📝 Auto-completion support for database schema types
- ⚡ Built-in error handling and connection management
- 🔄 Unified API across different database types

## Supported Drivers

- **PostgreSQL** - Native PostgreSQL driver via `pg`
- **LibSQL** - SQLite-compatible databases via `@libsql/client`
- **HTTP** - HTTP-based database services
- **Neon** - Neon serverless PostgreSQL (experimental)

## Usage

Install the package:

```sh
# ✨ Auto-detect (supports npm, yarn, pnpm, deno and bun)
npx nypm install driftsql
```

Import and use:

<!-- automd:jsimport cdn name="driftsql" -->

**ESM** (Node.js, Bun, Deno)

```js
import { DriftSQLClient } from 'driftsql'
```

**CDN** (Deno, Bun and Browsers)

```js
import { DriftSQLClient } from 'https://esm.sh/driftsql'
```

<!-- /automd -->

## Quick Start

### Define Your Database Schema

```typescript
import { DriftSQLClient } from 'driftsql'

// Define your database schema types
interface User {
  id: number
  name: string
  email: string
  created_at: string
}

interface Post {
  id: number
  title: string
  content: string | null
  user_id: number | null
  published: boolean
  created_at: Date
  updated_at: Date
}

// Define your database schema
interface MyDatabase {
  users: User
  posts: Post
}
```

### Initialize with PostgreSQL

```typescript
const db = new DriftSQLClient<MyDatabase>({
  drivers: {
    postgres: {
      connectionString: 'postgresql://user:password@localhost:5432/mydb',
      // or individual options:
      // host: 'localhost',
      // port: 5432,
      // database: 'mydb',
      // user: 'user',
      // password: 'password'
    },
  },
})
```

### Initialize with LibSQL

```typescript
const db = new DriftSQLClient<MyDatabase>({
  drivers: {
    libsql: {
      url: 'file:local.db',
      // or for remote:
      // url: 'libsql://your-database.turso.io',
      // authToken: 'your-auth-token'
    },
  },
})
```

### Initialize with HTTP

```typescript
const db = new DriftSQLClient<MyDatabase>({
  url: 'https://your-database-api.com',
  password: 'your-bearer-token',
  options: {
    defaultTimeout: 5000, // optional, defaults to 5000ms
  },
})
```

### Database Operations

```typescript
// Raw SQL queries
const users = await db.query<User>('SELECT * FROM users WHERE active = $1', [true])
console.log(users.rows)

// Find operations
const user = await db.findFirst('users', { email: 'user@example.com' })
const activeUsers = await db.findMany('users', { active: true })

// Insert operations
const newUser = await db.insert('users', {
  name: 'John Doe',
  email: 'john@example.com',
})

// Update operations
const updatedUser = await db.update('users', { name: 'Jane Doe' }, { id: 1 })

// Delete operations
const deleted = await db.delete('users', { id: 1 })

// Check server status (HTTP only)
const status = await db.status()
console.log(`Database OK: ${status.ok}, Ping: ${status.ping}ms`)

// Clean up connections
await db.close()
```

## API Reference

### Constructor Options

```typescript
interface ClientOptions {
  url?: string // HTTP server URL (for HTTP driver)
  password?: string // Bearer token for HTTP authentication
  drivers?: {
    libsql?: LibsqlClientConfig // LibSQL configuration
    postgres?: PoolConfig // PostgreSQL configuration
    postgresNeonHTTP?: {
      // Neon configuration (experimental)
      connectionString: string
    }
  }
  options?: {
    defaultTimeout?: number // Request timeout in milliseconds
  }
}
```

### Methods

- `query<T>(sql: string, args?: (string | number | boolean | null)[])` - Execute raw SQL with parameters
- `findFirst<K>(table: K, where?: Partial<DT[K]>)` - Find first matching record
- `findMany<K>(table: K, where?: Partial<DT[K]>)` - Find all matching records
- `insert<K>(table: K, data: Partial<DT[K]>)` - Insert new record
- `update<K>(table: K, data: Partial<DT[K]>, where: Partial<DT[K]>)` - Update records
- `delete<K>(table: K, where: Partial<DT[K]>)` - Delete records
- `deleteFirst<K>(table: K, where: Partial<DT[K]>)` - Delete first matching record
- `status()` - Get server status and ping (HTTP driver only)
- `close()` - Close database connections

### Return Types

All query methods return a unified result format:

```typescript
type UnifiedQueryResult<T> = {
  rows: T[]
  rowCount: number
  command?: string
  fields?: Array<{ name: string; dataTypeID: number }>
}
```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

</details>

## License

<!-- automd:contributors license=MIT -->

Published under the [MIT](https://github.com/lassejlv/postgres-http-js/blob/main/LICENSE) license.
Made by [community](https://github.com/lassejlv/postgres-http-js/graphs/contributors) 💛
<br><br>
<a href="https://github.com/lassejlv/postgres-http-js/graphs/contributors">
<img src="https://contrib.rocks/image?repo=lassejlv/postgres-http-js" />
</a>

<!-- /automd -->

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
