# @lassejlv/postgres-http-driver

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/@lassejlv/postgres-http-driver?color=yellow)](https://npmjs.com/package/@lassejlv/postgres-http-driver)
[![npm downloads](https://img.shields.io/npm/dm/@lassejlv/postgres-http-driver?color=yellow)](https://npm.chart.dev/@lassejlv/postgres-http-driver)

<!-- /automd -->

Driver for Postgres HTTP Server (docker.com/lassejlv/postgres_http). This package provides a TypeScript client for connecting to PostgreSQL databases over HTTP, offering a simple and type-safe interface for database operations.

## Features

- 🔐 Type-safe database operations with TypeScript generics
- 🛡️ SQL injection protection with parameterized queries
- 🚀 Simple HTTP-based connection (no native PostgreSQL driver required)
- 📝 Auto-completion support for database schema types
- ⚡ Built-in error handling and connection management

## Usage

Install the package:

```sh
# ✨ Auto-detect (supports npm, yarn, pnpm, deno and bun)
npx nypm install @lassejlv/postgres-http-driver
```

Import and use:

<!-- automd:jsimport cdn name="@lassejlv/postgres-http-driver" -->

**ESM** (Node.js, Bun, Deno)

```js
import { PostgresHTTPClient } from "@lassejlv/postgres-http-driver";
```

**CDN** (Deno, Bun and Browsers)

```js
import { PostgresHTTPClient } from "https://esm.sh/@lassejlv/postgres-http-driver";
```

<!-- /automd -->

## Quick Start

```typescript
import { PostgresHTTPClient } from '@lassejlv/postgres-http-driver'

// Initialize the client
const db = new PostgresHTTPClient({
  url: 'https://your-postgres-http-server.com',
  password: 'your-bearer-token',
  options: {
    defaultTimeout: 5000 // optional, defaults to 5000ms
  }
})

// Define your table interface for type safety
interface User {
  id: number
  name: string
  email: string
  created_at: string
}

// Raw SQL queries
const users = await db.query<User>('SELECT * FROM users WHERE active = $1', ['true'])
console.log(users.rows)

// Find operations
const user = await db.findFirst<User>({ email: 'user@example.com' }, 'users')
const activeUsers = await db.findMany<User>({ active: true }, 'users')

// Insert operations
const newUser = await db.insert<User>('users', {
  name: 'John Doe',
  email: 'john@example.com'
})

// Update operations
const updatedUser = await db.update<User>('users', 
  { name: 'Jane Doe' }, 
  { id: 1 }
)

// Delete operations
const deleted = await db.delete<User>('users', { id: 1 })

// Check server status
const status = await db.status()
console.log(`Database OK: ${status.ok}, Ping: ${status.ping}ms`)
```

## API Reference

### Constructor Options

```typescript
interface ClientOptions {
  url: string           // HTTP server URL
  password: string      // Bearer token for authentication
  options?: {
    defaultTimeout?: number  // Request timeout in milliseconds
  }
}
```

### Methods

- `query<T>(sql: string, args?: string[])` - Execute raw SQL with parameters
- `findFirst<T>(where: Partial<T>, table: string)` - Find first matching record
- `findMany<T>(where: Partial<T>, table: string)` - Find all matching records
- `insert<T>(table: string, data: Partial<T>)` - Insert new record
- `update<T>(table: string, data: Partial<T>, where: Partial<T>)` - Update records
- `delete<T>(table: string, where: Partial<T>)` - Delete records
- `status()` - Get server status and ping

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
