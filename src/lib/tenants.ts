// src/lib/tenants.ts
import fs from 'fs/promises'
import path from 'path'
import mysql from 'mysql2/promise'

export type TenantConfig = {
  id: string
  name: string
  envPath: string
  db: { host: string; port: number; database: string; user: string; password: string }
  tables: { users: string; clients: string }
  management: { status: string; date: string }
}

export type TenantCounts = {
  tenantId: string
  tenantName: string
  users: number
  clients: number
  admins: number
  providers: number
  management?: { status: string; date: string }
  error?: string
}

const TENANTS_DIR = '/root/mr/vivace-api/'

function parseDotEnv(content: string) {
  const out: Record<string, string> = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i === -1) continue
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    const m = val.match(/^(['"])(.*)\1$/)
    if (m) val = m[2]
    out[key] = val
  }
  return out
}

export async function loadTenants(): Promise<TenantConfig[]> {
  const entries = await fs.readdir(path.resolve(TENANTS_DIR)).catch(() => [])
  const envFiles = entries.filter((f) => f.startsWith('.env.') && f !== '.env')
  const tenants: TenantConfig[] = []

  for (const file of envFiles) {
    try {
      const envPath = path.join(TENANTS_DIR, file)
      const content = await fs.readFile(envPath, 'utf8')
      const env = parseDotEnv(content)

      const id = file.slice('.env.'.length)
      const name = env.APP_NAME || id

      const host = env.DB_HOST
      const port = Number(env.DB_PORT || 3306)
      const database = env.DB_DATABASE
      const user = env.DB_USERNAME
      const password = env.DB_PASSWORD

      if (!host || !database || !user) continue

      tenants.push({
        id, name, envPath,
        db: { host, port, database, user, password },
        tables: { users: env.USERS_TABLE || 'users', clients: env.CLIENTS_TABLE || 'clients' },
        management: { status: env.MANAGEMENT_STATUS || '', date: env.MANAGEMENT_DATE || '' },
      })
    } catch {}
  }
  return tenants
}

export async function getTenantCounts(t: TenantConfig): Promise<TenantCounts> {
  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection(t.db)
    const [cRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.tables.clients}\``)
    const clients = Number((cRows as any)[0]?.c || 0)

    let admins = 0, providers = 0
    try {
      const [rows] = await conn.query(`SELECT type, COUNT(*) c FROM providers GROUP BY type`)
      const map = new Map<string, number>()
      ;(rows as any[]).forEach(r => map.set(String(r.type), Number(r.c)))
      admins = map.get('admin') || 0
      providers = map.get('provider') || 0
    } catch {}

    const users = admins + providers
    return { tenantId: t.id, tenantName: t.name, users, clients, admins, providers, management: t.management }
  } catch (e:any) {
    return { tenantId: t.id, tenantName: t.name, users: 0, clients: 0, admins: 0, providers: 0, management: t.management, error: e?.code || e?.message }
  } finally { try { await conn?.end() } catch {} }
}
