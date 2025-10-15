// src/app/(portal)/page.tsx
// Server Component — sin <html>/<body>, sin client components

import fs from 'fs/promises'
import path from 'path'
import mysql from 'mysql2/promise'

export const dynamic = 'force-dynamic' // evita que Next intente pre-render estatico

type TenantConfig = {
  id: string
  name: string
  envPath: string
  db: { host: string; port: number; database: string; user: string; password: string }
  tables: { users: string; clients: string }
}

type TenantCounts = {
  tenantId: string
  tenantName: string
  users: number
  clients: number
  admins: number
  error?: string
}

const TENANTS_DIR = '/root/mr/vivace-api/' // RUTA ABSOLUTA

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
    console.error('No se pudo leer el directorio:', TENANTS_DIR, e)
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
      const name = env.APP_NAME || id

      const host = env.DB_HOST
      const port = Number(env.DB_PORT || 3306)
      const database = env.DB_DATABASE
      const user = env.DB_USERNAME
      const password = env.DB_PASSWORD

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
      })
    } catch (e) {
      console.error('Error leyendo', file, e)
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
    const [uRows] = await conn.query('SELECT COUNT(*) AS c FROM `' + tenant.tables.users + '`')
    const [cRows] = await conn.query('SELECT COUNT(*) AS c FROM `' + tenant.tables.clients + '`')
    const [aRows] = await conn.query(
      'SELECT COUNT(*) AS c FROM `' + tenant.tables.users + '` WHERE (role = "admin" OR is_admin = 1)',
    )
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      users: Number((uRows as any)[0]?.c || 0),
      clients: Number((cRows as any)[0]?.c || 0),
      admins: Number((aRows as any)[0]?.c || 0),
    }
  } catch (e: any) {
    console.error('DB error', tenant.id, e?.code || e?.message || e)
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      users: 0,
      clients: 0,
      admins: 0,
      error: e?.code || e?.message,
    }
  } finally {
    try { await conn?.end() } catch {}
  }
}

async function getAllCounts(tenants: TenantConfig[]) {
  return Promise.all(tenants.map((t) => getTenantCounts(t)))
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

function BarsSVG({ data }: { data: { name: string; Users: number; Clients: number }[] }) {
  const width = 900
  const barH = 18
  const gap = 10
  const rowH = barH * 2 + gap * 2 + 6
  const height = Math.max(60, data.length * rowH + 40)
  const paddingLeft = 160
  const paddingRight = 30
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.Users, d.Clients]))
  const scaleX = (v: number) => {
    const innerW = width - paddingLeft - paddingRight
    return (v / maxVal) * innerW
  }
  const innerW = width - paddingLeft - paddingRight
  const ticks = 4
  const grid = Array.from({ length: ticks + 1 }, (_, i) => Math.round((i * maxVal) / ticks))

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Users vs Clients per tenant">
      {grid.map((v, i) => {
        const x = paddingLeft + (innerW * i) / ticks
        return (
          <g key={i}>
            <line x1={x} y1={10} x2={x} y2={height - 10} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={x} y={height - 2} textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#6b7280">
              {v}
            </text>
          </g>
        )
      })}

      <g>
        <rect x={paddingLeft} y={8} width="10" height="10" fill="#4f46e5" rx="2" />
        <text x={paddingLeft + 16} y={17} fontSize="12" fontFamily="sans-serif">
          Users
        </text>
        <rect x={paddingLeft + 70} y={8} width="10" height="10" fill="#06b6d4" rx="2" />
        <text x={paddingLeft + 86} y={17} fontSize="12" fontFamily="sans-serif">
          Clients
        </text>
      </g>

      <g transform="translate(0, 20)">
        {data.map((d, i) => {
          const yTop = 20 + i * rowH
          const uW = scaleX(d.Users)
          const cW = scaleX(d.Clients)
          return (
            <g key={d.name}>
              <text x={0} y={yTop + barH} fontSize="12" fontFamily="sans-serif">
                {d.name}
              </text>
              <rect x={paddingLeft} y={yTop} width={uW} height={barH} rx="4" ry="4" fill="#4f46e5" />
              <text x={paddingLeft + uW + 6} y={yTop + barH - 4} fontSize="11" fontFamily="sans-serif" fill="#111827">
                {d.Users}
              </text>
              <rect x={paddingLeft} y={yTop + barH + gap} width={cW} height={barH} rx="4" ry="4" fill="#06b6d4" />
              <text
                x={paddingLeft + cW + 6}
                y={yTop + barH + gap + barH - 4}
                fontSize="11"
                fontFamily="sans-serif"
                fill="#111827"
              >
                {d.Clients}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export default async function Page({ searchParams }: { searchParams?: { client?: string } }) {
  const selectedClient = (searchParams?.client || 'all').toLowerCase()

  const tenants = await loadTenants()
  const counts = await getAllCounts(tenants)
  const filtered = selectedClient === 'all' ? counts : counts.filter((c) => c.tenantId.toLowerCase() === selectedClient)

  const totalUsers = filtered.reduce((a, b) => a + b.users, 0)
  const totalClients = filtered.reduce((a, b) => a + b.clients, 0)
  const totalAdmins = filtered.reduce((a, b) => a + b.admins, 0)
  const barData = filtered.map((r) => ({ name: r.tenantName, Users: r.users, Clients: r.clients }))
  const errored = filtered.filter((r) => r.error)

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Executive Summary</h1>
      <p style={{ color: '#4b5563', marginBottom: 16 }}>
        Direct MySQL — envs en <code>{TENANTS_DIR}</code>
      </p>

      <form method="GET" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <label>
          <span style={{ fontSize: 13, color: '#6b7280', marginRight: 8 }}>Filter by Client</span>
          <select
            name="client"
            defaultValue={selectedClient}
            onChange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
            style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            <option value="all">All</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </form>

      {errored.length > 0 && (
        <div style={{ padding: 12, border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: 6 }}>Tenants con error</div>
          <div style={{ color: '#991b1b' }}>
            {errored.map((e) => (
              <div key={e.tenantId}>
                <strong>{e.tenantName}:</strong> {e.error}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Kpi title="Total Users" value={formatInt(totalUsers)} />
        <Kpi title="Total Clients" value={formatInt(totalClients)} />
        <Kpi title="Total Admins" value={formatInt(totalAdmins)} />
        <Kpi title="Environments" value={String(filtered.length)} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Comparación por Ambiente (Usuarios vs Clientes)</div>
        <BarsSVG data={barData} />
      </div>
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <div style={{ color: '#6b7280', fontSize: 12 }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: 22 }}>{value}</div>
    </div>
  )
}

