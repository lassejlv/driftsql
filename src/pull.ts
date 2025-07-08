import { DriftSQLClient, type ClientOptions } from '.'
import fs from 'node:fs/promises'

type Drivers = ClientOptions['drivers']

const supportedDrivers = ['postgres', 'postgresHTTP', 'mysql', 'libsql'] as const

// Helper function to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 30_000): Promise<T> => {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs))])
}

// Helper function to retry queries with exponential backoff
const retryQuery = async <T>(queryFn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.warn(`Query attempt ${attempt} failed, retrying in ${delay}ms...`, error)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

const mapDatabaseTypeToTypeScript = (dataType: string, isNullable: boolean = false, driverType: string = 'postgres'): string => {
  const nullable = isNullable ? ' | null' : ''
  const lowerType = dataType.toLowerCase()

  // Common types that work for both PostgreSQL and MySQL
  switch (lowerType) {
    case 'uuid': {
      return `string${nullable}`
    }
    case 'character varying':
    case 'varchar':
    case 'text':
    case 'char':
    case 'character':
    case 'longtext':
    case 'mediumtext':
    case 'tinytext': {
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
    case 'float8':
    case 'tinyint':
    case 'mediumint':
    case 'float':
    case 'double': {
      return `number${nullable}`
    }
    case 'boolean':
    case 'bool':
    case 'bit': {
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
    case 'interval':
    case 'datetime':
    case 'year': {
      return `Date${nullable}`
    }
    case 'json':
    case 'jsonb': {
      return `any${nullable}` // or Record<string, any> if you prefer
    }
    case 'array': {
      return `any[]${nullable}`
    }
    case 'bytea':
    case 'binary':
    case 'varbinary':
    case 'blob':
    case 'longblob':
    case 'mediumblob':
    case 'tinyblob': {
      return `Buffer${nullable}`
    }
    case 'enum':
    case 'set': {
      return `string${nullable}` // MySQL specific
    }
    default: {
      console.warn(`Unknown ${driverType} type: ${dataType}, defaulting to 'any'`)
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

  const activeDriver = supportedConfiguredDrivers[0] // Get the first (and should be only) configured driver
  let generatedTypes = ''

  const client = new DriftSQLClient({ drivers })

  try {
    // Use different queries based on the driver type
    let tablesQuery: string
    let tableSchemaFilter: string | undefined

    if (activeDriver === 'mysql') {
      // For MySQL, get the current database name first
      const dbResult = await withTimeout(
        retryQuery(() => client.query<{ database: string }>('SELECT DATABASE() as `database`', [])),
        10_000,
      )
      const currentDatabase = dbResult.rows[0]?.database

      if (!currentDatabase) {
        throw new Error('Could not determine current MySQL database name')
      }

      console.log(`Using MySQL database: ${currentDatabase}`)
      tablesQuery = `SELECT TABLE_NAME as table_name
                   FROM information_schema.tables 
                   WHERE TABLE_SCHEMA = ? 
                   AND TABLE_TYPE = 'BASE TABLE'
                   ORDER BY TABLE_NAME`
      tableSchemaFilter = currentDatabase
    } else if (activeDriver === 'postgres' || activeDriver === 'postgresHTTP') {
      // PostgreSQL
      tablesQuery = `SELECT table_name 
                   FROM information_schema.tables 
                   WHERE table_schema = $1 
                   AND table_type = 'BASE TABLE'
                   ORDER BY table_name`
      tableSchemaFilter = 'public'
    } else {
      // LibSQL (SQLite)
      tablesQuery = `SELECT name as table_name 
                   FROM sqlite_master 
                   WHERE type = 'table' 
                   ORDER BY name`
      tableSchemaFilter = undefined // LibSQL does not have schemas like PostgreSQL or MySQL
    }

    const tables = await withTimeout(
      retryQuery(() => client.query<{ table_name: string }>(tablesQuery, tableSchemaFilter ? [tableSchemaFilter] : [])),
      30_000,
    )
    console.log('Tables in the database:', tables.rows.map((t) => t.table_name).join(', '))

    let processedTables = 0
    const totalTables = tables.rows.length

    for (const table of tables.rows) {
      const tableName = table.table_name
      processedTables++
      console.log(`[${processedTables}/${totalTables}] Inspecting table: ${tableName}`)

      try {
        // Get columns with nullability information - use different queries for different drivers
        let columnsQuery: string
        let queryParams: (string | null)[]

        if (activeDriver === 'mysql') {
          columnsQuery = `
          SELECT 
            COLUMN_NAME as column_name, 
            DATA_TYPE as data_type, 
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as column_default
          FROM information_schema.columns 
          WHERE TABLE_NAME = ? 
          AND TABLE_SCHEMA = ?
          ORDER BY ORDINAL_POSITION
        `
          queryParams = [tableName, tableSchemaFilter!]
        } else if (activeDriver === 'postgres' || activeDriver === 'postgresHTTP') {
          // PostgreSQL
          columnsQuery = `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND table_schema = $2
          ORDER BY ordinal_position
        `
          queryParams = [tableName, tableSchemaFilter!]
        } else {
          // LibSQL (SQLite)
          columnsQuery = `
          SELECT 
            name as column_name, 
            type as data_type, 
            CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END as is_nullable,
            dflt_value as column_default
          FROM pragma_table_info(?)
          ORDER BY cid
        `
          queryParams = [tableName]
        }

        const columns = await withTimeout(
          retryQuery(() =>
            client.query<{
              column_name: string
              data_type: string
              is_nullable: string
              column_default: string | null
            }>(columnsQuery, queryParams),
          ),
          15_000, // Shorter timeout for individual table queries
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
          const tsType = mapDatabaseTypeToTypeScript(col.data_type, col.is_nullable === 'YES', activeDriver)
          generatedTypes += `  ${col.column_name}: ${tsType};\n`
        }
        generatedTypes += '}\n\n'
      } catch (error) {
        console.error(`Failed to process table ${tableName}:`, error)
        console.log(`Skipping table ${tableName} and continuing...`)
        continue
      }
    }

    // Generate the Database interface
    generatedTypes += 'export interface Database {\n'
    for (const table of tables.rows) {
      const tableName = table.table_name.charAt(0).toUpperCase() + table.table_name.slice(1)
      generatedTypes += `  ${tableName}: ${tableName};\n`
    }
    generatedTypes += '}\n\n'

    await fs.writeFile('db-types.ts', generatedTypes, 'utf8')
    console.log('TypeScript types written to db-types.ts')
    console.log(`Successfully processed ${processedTables} tables`)
  } catch (error) {
    console.error('Fatal error during database inspection:', error)
    process.exit(1)
  }

  process.exit(0)
}

export default inspectDB
