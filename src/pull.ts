import consola from 'consola'
import { PostgresDriver, LibSQLDriver, MySQLDriver, SQLClient, NeonDriver, SqliteCloudDriver } from '.'
import type { DatabaseDriver } from './types'
import fs from 'node:fs/promises'

interface InspectOptions {
  driver: DatabaseDriver
  outputFile?: string
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs = 30_000): Promise<T> => {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs))])
}

const retryQuery = async <T>(queryFn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      const delay = baseDelay * Math.pow(2, attempt - 1)
      consola.warn(`Query attempt ${attempt} failed, retrying in ${delay}ms...`, error)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

const mapDatabaseTypeToTypeScript = (dataType: string, isNullable: boolean = false, driverType: string = 'postgres'): string => {
  const nullable = isNullable ? ' | null' : ''
  const lowerType = dataType.toLowerCase()

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
      return `any${nullable}`
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
      return `string${nullable}`
    }
    default: {
      consola.warn(`Unknown ${driverType} type: ${dataType}, defaulting to 'any'`)
      return `any${nullable}`
    }
  }
}

const getDriverType = (driver: DatabaseDriver): string => {
  if (driver instanceof PostgresDriver) return 'postgres'
  if (driver instanceof LibSQLDriver) return 'libsql'
  if (driver instanceof MySQLDriver) return 'mysql'
  if (driver instanceof NeonDriver) return 'neon'
  if (driver instanceof SqliteCloudDriver) return 'sqlitecloud'
  return 'unknown'
}

export const inspectDB = async (options: InspectOptions) => {
  const { driver, outputFile = 'db-types.ts' } = options
  const driverType = getDriverType(driver)

  consola.log(`Inspecting database using ${driverType} driver`)

  const client = new SQLClient({ driver })
  let generatedTypes = ''

  try {
    // Use different queries based on the driver type
    let tablesQuery: string
    let tableSchemaFilter: string | undefined

    if (driverType === 'mysql') {
      // For MySQL, get the current database name first
      const dbResult = await withTimeout(
        retryQuery(() => client.query<{ database: string }>('SELECT DATABASE() as `database`', [])),
        10_000,
      )
      const currentDatabase = dbResult.rows[0]?.database

      if (!currentDatabase) {
        throw new Error('Could not determine current MySQL database name')
      }

      consola.log(`Using MySQL database: ${currentDatabase}`)
      tablesQuery = `SELECT TABLE_NAME as table_name
                   FROM information_schema.tables
                   WHERE TABLE_SCHEMA = ?
                   AND TABLE_TYPE = 'BASE TABLE'
                   ORDER BY TABLE_NAME`
      tableSchemaFilter = currentDatabase
    } else if (driverType === 'postgres' || driverType === 'neon') {
      // PostgreSQL
      tablesQuery = `SELECT table_name
                   FROM information_schema.tables
                   WHERE table_schema = $1
                   AND table_type = 'BASE TABLE'
                   ORDER BY table_name`
      tableSchemaFilter = 'public'
    } else if (driverType === 'libsql' || driverType === 'sqlite' || driverType === 'sqlitecloud') {
      // LibSQL/SQLite
      tablesQuery = `SELECT name as table_name
                   FROM sqlite_master
                   WHERE type = 'table'
                   ORDER BY name`
      tableSchemaFilter = undefined
    } else {
      throw new Error(`Unsupported driver type: ${driverType}`)
    }

    const tables = await withTimeout(
      retryQuery(() => client.query<{ table_name: string }>(tablesQuery, tableSchemaFilter ? [tableSchemaFilter] : [])),
      30_000,
    )

    consola.log('Tables in the database:', tables.rows.map((t) => t.table_name).join(', '))

    let processedTables = 0
    const totalTables = tables.rows.length

    for (const table of tables.rows) {
      const tableName = table.table_name
      processedTables++
      consola.log(`[${processedTables}/${totalTables}] Inspecting table: ${tableName}`)

      try {
        // Get columns with nullability information
        let columnsQuery: string
        let queryParams: (string | null)[]

        if (driverType === 'mysql') {
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
        } else if (driverType === 'postgres' || driverType === 'neon') {
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
          // LibSQL/SQLite
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
          15_000,
        )

        if (columns.rows.length === 0) {
          consola.log(`No columns found for table: ${tableName}`)
          continue
        }

        consola.log(`Columns in ${tableName}:`, columns.rows.map((c) => `${c.column_name} (${c.data_type}${c.is_nullable === 'YES' ? ', nullable' : ''})`).join(', '))

        // Deduplicate columns by name
        const uniqueColumns = new Map<string, (typeof columns.rows)[0]>()
        columns.rows.forEach((col) => {
          if (!uniqueColumns.has(col.column_name)) {
            uniqueColumns.set(col.column_name, col)
          }
        })

        generatedTypes += `export interface ${tableName.charAt(0).toUpperCase() + tableName.slice(1)} {\n`
        for (const col of uniqueColumns.values()) {
          const tsType = mapDatabaseTypeToTypeScript(col.data_type, col.is_nullable === 'YES', driverType)
          generatedTypes += `  ${col.column_name}: ${tsType};\n`
        }
        generatedTypes += '}\n\n'
      } catch (error) {
        consola.error(`Failed to process table ${tableName}:`, error)
        consola.log(`Skipping table ${tableName} and continuing...`)
        continue
      }
    }

    // Generate the Database interface
    generatedTypes += 'export interface Database {\n'
    for (const table of tables.rows) {
      const interfaceName = table.table_name.charAt(0).toUpperCase() + table.table_name.slice(1)
      generatedTypes += `  ${table.table_name}: ${interfaceName};\n`
    }
    generatedTypes += '}\n\n'

    await fs.writeFile(outputFile, generatedTypes, 'utf8')
    consola.log(`TypeScript types written to ${outputFile}`)
    consola.log(`Successfully processed ${processedTables} tables`)
  } catch (error) {
    consola.error('Fatal error during database inspection:', error)
    throw error
  } finally {
    await client.close()
  }
}

export default inspectDB
