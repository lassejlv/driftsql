import { connect, type Socket } from 'bun'

export interface Row {
  [key: string]: number | string | null
}

interface ParsedConnection {
  host: string
  port: number
  username: string
  password: string
}

export class PoubelleClient {
  private socket: Socket | null = null
  private config: ParsedConnection
  private connected = false
  private buffer = ''

  constructor(connectionString: string) {
    this.config = this.parseConnectionString(connectionString)
  }

  private parseConnectionString(connStr: string): ParsedConnection {
    const urlPattern = /^poubelle:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/
    const match = connStr.match(urlPattern)

    if (!match) {
      throw new Error('Invalid connection string format. Expected: poubelle://username:password@host:port')
    }

    const [, username, password, host, port] = match

    return {
      username,
      password,
      host,
      port: parseInt(port, 10),
    }
  }

  async connect(): Promise<void> {
    this.socket = await connect({
      hostname: this.config.host,
      port: this.config.port,
      socket: {
        data: (socket, data) => {
          const text = Buffer.from(data).toString()
          this.buffer += text
        },
        error: (socket, error) => {
          console.error('Socket error:', error)
        },
      },
    })

    await this.waitForPrompt('Username: ')
    await this.send(`${this.config.username}\n`)

    await this.waitForPrompt('Password: ')
    await this.send(`${this.config.password}\n`)

    await this.waitForPrompt('Connected to Poubelle DB')
    this.connected = true
  }

  async query(sql: string): Promise<string> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected')
    }

    await this.waitForPrompt('poubelle> ')
    this.buffer = ''
    await this.send(`${sql}\n`)

    await new Promise((resolve) => setTimeout(resolve, 100))
    const result = this.buffer.split('poubelle> ')[0].trim()
    return result
  }

  async createTable(name: string, columns: Record<string, 'INT' | 'TEXT'>): Promise<string> {
    const cols = Object.entries(columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(', ')
    return this.query(`CREATE TABLE ${name} (${cols})`)
  }

  async insert(table: string, data: Record<string, number | string | null>): Promise<string> {
    const columns = Object.keys(data).join(', ')
    const values = Object.values(data)
      .map((v) => {
        if (v === null) return 'NULL'
        if (typeof v === 'string') return `'${v}'`
        return v
      })
      .join(', ')
    return this.query(`INSERT INTO ${table} (${columns}) VALUES (${values})`)
  }

  async select(table: string, columns: string[] = ['*']): Promise<Row[]> {
    const cols = columns.join(', ')
    const result = await this.query(`SELECT ${cols} FROM ${table}`)

    if (result === 'No rows') {
      return []
    }

    const rows: Row[] = []
    const lines = result.split('\n').filter((l) => l.trim())

    for (const line of lines) {
      try {
        const cleaned = line.replace(/^{|}$/g, '')
        const pairs = cleaned.split(', ')
        const row: Row = {}

        for (const pair of pairs) {
          const [key, value] = pair.split(': ')
          if (key && value) {
            const cleanKey = key.replace(/"/g, '')
            const cleanValue = value.replace(/"/g, '')

            if (cleanValue === 'Null') {
              row[cleanKey] = null
            } else if (cleanValue.startsWith('Int(')) {
              row[cleanKey] = parseInt(cleanValue.slice(4, -1))
            } else if (cleanValue.startsWith('Text(')) {
              row[cleanKey] = cleanValue.slice(5, -1)
            } else {
              row[cleanKey] = cleanValue
            }
          }
        }

        if (Object.keys(row).length > 0) {
          rows.push(row)
        }
      } catch (e) {
        console.error('Failed to parse row:', line)
      }
    }

    return rows
  }

  async close(): Promise<void> {
    if (this.socket) {
      await this.send('exit\n')
      this.socket.end()
      this.socket = null
      this.connected = false
    }
  }

  private async send(data: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.write(data)
  }

  private async waitForPrompt(prompt: string, timeout = 5000): Promise<void> {
    const start = Date.now()
    while (!this.buffer.includes(prompt)) {
      if (Date.now() - start > timeout) {
        throw new Error(`Timeout waiting for prompt: ${prompt}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}

export default PoubelleClient
