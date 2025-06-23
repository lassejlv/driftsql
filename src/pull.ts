import { DriftSQLClient, type ClientOptions } from '.'
import fs from 'node:fs/promises'

type Drivers = ClientOptions['drivers']

const supportedDrivers = ['postgres'] as const

const mapPostgresToTypeScript = (postgresType: string, isNullable: boolean = false): string => {
  const nullable = isNullable ? ' | null' : ''

  switch (postgresType.toLowerCase()) {
    case 'uuid': {
      return `string${nullable}`
    }
    case 'character varying':
    case 'varchar':
    case 'text':
    case 'char':
    case 'character': {
      return `string${nullable}`
    }
    case 'integer':
    case 'int':
    case 'int4':
    case 'smallint':
    case 'int2':
    case 'bigint':
    case 'int8':
    case 'serial':
    case 'bigserial':
    case 'numeric':
    case 'decimal':
    case 'real':
    case 'float4':
    case 'double precision':
    case 'float8': {
      return `number${nullable}`
    }
    case 'boolean':
    case 'bool': {
      return `boolean${nullable}`
    }
    case 'timestamp':
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'timestamptz':
    case 'date':
    case 'time':
    case 'time with time zone':
    case 'time without time zone':
    case 'timetz':
    case 'interval': {
      return `Date${nullable}`
    }
    case 'json':
    case 'jsonb': {
      return `any${nullable}` // or Record<string, any> if you prefer
    }
    case 'array': {
      return `any[]${nullable}`
    }
    case 'bytea': {
      return `Buffer${nullable}`
    }
    default: {
      console.warn(`Unknown PostgreSQL type: ${postgresType}, defaulting to 'any'`)
      return `any${nullable}`
    }
  }
}

export const inspectDB = async (drivers: Drivers) => {
  if (!drivers) throw new Error('No drivers provided for inspection')

  // Check which driver is configured
  const configuredDrivers = Object.keys(drivers).filter((key) => drivers[key as keyof Drivers] !== undefined)

  if (configuredDrivers.length === 0) {
    throw new Error('No drivers are configured')
  }

  const supportedConfiguredDrivers = configuredDrivers.filter((driver) => supportedDrivers.includes(driver as (typeof supportedDrivers)[number]))

  if (supportedConfiguredDrivers.length === 0) {
    throw new Error(`No supported drivers found. Configured: ${configuredDrivers.join(', ')}. Supported: ${supportedDrivers.join(', ')}`)
  }

  console.log(`Found supported drivers: ${supportedConfiguredDrivers.join(', ')}`)

  let generatedTypes = ''

  const client = new DriftSQLClient({ drivers })
  const tables = await client.query<{ table_name: string }>(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  )
  console.log('Tables in the database:', tables.rows.map((t) => t.table_name).join(', '))

  for (const table of tables.rows) {
    const tableName = table.table_name
    console.log(`Inspecting table: ${tableName}`)

    // Get columns with nullability information
    const columns = await client.query<{
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
    }>(
      `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `,
      [tableName],
    )

    if (columns.rows.length === 0) {
      console.log(`No columns found for table: ${tableName}`)
      continue
    }

    console.log(`Columns in ${tableName}:`, columns.rows.map((c) => `${c.column_name} (${c.data_type}${c.is_nullable === 'YES' ? ', nullable' : ''})`).join(', '))

    // Deduplicate columns by name (keep the first occurrence)
    const uniqueColumns = new Map<string, (typeof columns.rows)[0]>()
    columns.rows.forEach((col) => {
      if (!uniqueColumns.has(col.column_name)) {
        uniqueColumns.set(col.column_name, col)
      }
    })

    generatedTypes += `export interface ${tableName.charAt(0).toUpperCase() + tableName.slice(1)} {\n`
    for (const col of uniqueColumns.values()) {
      const tsType = mapPostgresToTypeScript(col.data_type, col.is_nullable === 'YES')
      generatedTypes += `  ${col.column_name}: ${tsType};\n`
    }
    generatedTypes += '}\n\n'
  }

  // And the last part: interface Database {
  generatedTypes += 'export interface Database {\n'
  for (const table of tables.rows) {
    const tableName = table.table_name.charAt(0).toUpperCase() + table.table_name.slice(1)
    generatedTypes += `  ${tableName}: ${tableName};\n`
  }
  generatedTypes += '}\n\n'

  await fs.writeFile('db-types.ts', generatedTypes, 'utf8')
  console.log('TypeScript types written to db-types.ts')
  process.exit(0)
}

export default inspectDB
