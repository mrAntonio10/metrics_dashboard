// src/app/(portal)/page.tsx
import fs from 'fs/promises'
import path from 'path'
import mysql from 'mysql2/promise'
import HomePageClient from './HomePageClient'

export const dynamic = 'force-dynamic' // avoid static pre-rendering

type TenantConfig = {
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
  management?: { status: string; date: string } // added this field
  error?: string
}

const TENANTS_DIR = '/root/vivace-api/' // path inside the container

function parseDotEnv(content: string): Record<string, string> {
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

async function loadTenants(): Promise<TenantConfig[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(path.resolve(TENANTS_DIR))
  } catch (e) {
    console.error('Failed to read directory:', TENANTS_DIR, e)
    return []
  }

  const envFiles = entries.filter((f) => f.startsWith('.env.') && f !== '.env')
  const tenants: TenantConfig[] = []

  for (const file of envFiles) {
    try {
      const envPath = path.join(TENANTS_DIR, file)
      const content = await fs.readFile(envPath, 'utf8')
      const env = parseDotEnv(content)

      const id = file.slice('.env.'.length)

      const realName = (env.REAL_NAME || env.NEXT_PUBLIC_REAL_NAME || '').trim()
      const appName = (env.APP_NAME || env.NEXT_PUBLIC_APP_NAME || '').trim()

      const name =
        realName || appName || id

      const host = env.DB_HOST
      const port = Number(env.DB_PORT || 3306)
      const database = env.DB_DATABASE
      const user = env.DB_USERNAME
      const password = env.DB_PASSWORD

      const managementStatus = env.MANAGEMENT_STATUS || ''
      const managementDate = env.MANAGEMENT_DATE || ''

      if (!host || !database || !user) continue

      tenants.push({
        id,
        name,
        envPath,
        db: { host, port, database, user, password },
        tables: {
          users: env.USERS_TABLE || 'users',
          clients: env.CLIENTS_TABLE || 'clients',
        },
        management: {
          status: managementStatus,
          date: managementDate,
        },
      })
    } catch (e) {
      console.error('Error reading', file, e)
    }
  }
  return tenants
}

async function getTenantCounts(tenant: TenantConfig): Promise<TenantCounts> {
  const base = {
    host: tenant.db.host,
    port: tenant.db.port,
    database: tenant.db.database,
    user: tenant.db.user,
    password: tenant.db.password,
  } as const

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection(base)

    // Client count
    const [cRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${tenant.tables.clients}\``)
    const clients = Number((cRows as any)[0]?.c || 0)

    // Provider count by type
    let admins = 0
    let providers = 0
    try {
      const [typeRows] = await conn.query(`
        SELECT type, COUNT(*) AS c
        FROM providers
        GROUP BY type
      `)
      const map = new Map<string, number>()
        ; (typeRows as any[]).forEach((r) => map.set(String(r.type), Number(r.c)))
      admins = map.get('admin') || 0
      providers = map.get('provider') || 0
    } catch (err: any) {
      console.warn('Providers table missing or incompatible in', tenant.id, err.code)
    }

    const users = clients + admins + providers

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      users,
      clients,
      admins,
      providers,
      management: tenant.management, // pass management metadata
    }
  } catch (e: any) {
    console.error('DB error', tenant.id, e?.code || e?.message || e)
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      users: 0,
      clients: 0,
      admins: 0,
      providers: 0,
      management: tenant.management,
      error: e?.code || e?.message,
    }
  } finally {
    try {
      await conn?.end()
    } catch { }
  }
}

export default async function Page({ searchParams }: { searchParams?: { client?: string } }) {
  const tenants = await loadTenants()
  const counts = await Promise.all(tenants.map((t) => getTenantCounts(t)))

  const orgs = tenants.map((t) => ({ id: t.id, name: t.name }))
  const selectedClient = (searchParams?.client || 'all').toLowerCase()

  return <HomePageClient orgs={orgs} counts={counts} selectedClient={selectedClient} />
}
