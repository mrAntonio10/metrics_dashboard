// src/app/api/billing/run/route.ts
import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import mysql, { RowDataPacket, Pool, Connection } from 'mysql2/promise'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* =========================
   Config
   ========================= */
const BILLING_RUN_SECRET = (process.env.BILLING_RUN_SECRET || '').trim()
const BILLING_WEBHOOK =
  process.env.BILLING_WEBHOOK ||
  'https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a'
const TENANTS_DIR = process.env.TENANTS_DIR || '/data/vivace-vivace-api'
const ENV_PREFIX = '.env.'
const DB_URL = process.env.DATABASE_URL // opcional: fallback para tarifa global
const TZ = 'America/La_Paz'

/* =========================
   Fecha (La Paz)
   ========================= */
function todayLocalParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  const [y, m, dd] = f.format(d).split('-').map(Number)
  return { y, m, d: dd }
}
function todayLocalYMDString() {
  const t = todayLocalParts()
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
}
function parseYMD(s?: string) {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}
function lastDayOfMonth(y: number, m: number) { return new Date(Date.UTC(y, m, 0)).getUTCDate() }
function cmpYMD(a:{y:number;m:number;d:number}, b:{y:number;m:number;d:number}) {
  if (a.y !== b.y) return a.y - b.y; if (a.m !== b.m) return a.m - b.m; return a.d - b.d
}
function dueTodayMonthly(anchorYmd?: string) {
  const anchor = parseYMD(anchorYmd); if (!anchor) return false
  const today = todayLocalParts(); if (cmpYMD(today, anchor) < 0) return false
  const sched = Math.min(anchor.d, lastDayOfMonth(today.y, today.m))
  return today.d === sched
}

/* =========================
   .env.* helpers
   ========================= */
function trim(s: string) { return s.replace(/^\s+|\s+$/g, '') }
function parseDotenv(text: string): Record<string,string> {
  const out: Record<string,string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = trim(raw); if (!line || line.startsWith('#')) continue
    const i = line.indexOf('='); if (i < 0) continue
    const key = trim(line.slice(0,i))
    let val = line.slice(i+1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
async function listEnvFiles(dir: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile() && e.name.startsWith(ENV_PREFIX) && e.name.length > ENV_PREFIX.length)
      .map(e => path.join(dir, e.name))
  } catch (e:any) {
    if (e?.code === 'ENOENT') return []
    throw e
  }
}

/* =========================
   Tipos
   ========================= */
type Tenant = {
  tenantId: string
  companyKey: string
  companyName: string
  managementStatus: string
  managementDate: string
  envFile: string
  db: { host:string; port:number; database:string; user:string; password:string }
  tables: { users: string; clients: string; providers: string }
  ratePerUser?: number
}
type Counts = { users:number; clients:number; providers:number; admins:number }
type Result = { tenantId:string; status:number; ok:boolean; reason?:string; error?:string }

async function readTenantEnv(file: string): Promise<Tenant> {
  const base = path.basename(file) // .env.client1
  const tenantId = base.slice(ENV_PREFIX.length)
  const env = parseDotenv(await fs.readFile(file, 'utf8'))

  const companyKey = env['COMPANY_KEY'] || tenantId
  const companyName = env['COMPANY_NAME'] || env['TENANT_NAME'] || env['APP_TENANT_NAME'] || tenantId
  const managementStatus = (env['MANAGEMENT_STATUS'] || '').toUpperCase()
  const managementDate = env['MANAGEMENT_DATE'] || ''

  const host = env['DB_HOST']; const port = Number(env['DB_PORT'] || 3306)
  const database = env['DB_DATABASE']; const user = env['DB_USERNAME']; const password = env['DB_PASSWORD']
  const usersTable = env['USERS_TABLE'] || 'users'
  const clientsTable = env['CLIENTS_TABLE'] || 'clients'
  const providersTable = env['PROVIDERS_TABLE'] || 'providers'
  const ratePerUser = env['RATE_PER_USER'] ? Number(env['RATE_PER_USER']) : undefined

  return {
    tenantId, companyKey, companyName, managementStatus, managementDate, envFile: file,
    db: { host: host || '', port, database: database || '', user: user || '', password: password || '' },
    tables: { users: usersTable, clients: clientsTable, providers: providersTable },
    ratePerUser
  }
}

/* =========================
   DB helpers por tenant
   ========================= */
function isSoftDbError(e: any) {
  const code = String(e?.code || '')
  const msg = String(e?.message || e || '')
  return (
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|ER_ACCESS_DENIED|ER_DBACCESS/i.test(code) ||
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|connect|handshake|tenant-db-missing-params/i.test(msg)
  )
}

async function getCountsPerTenant(t: Tenant): Promise<Counts> {
  let conn: Connection | null = null
  let users = 0, clients = 0, providers = 0, admins = 0
  try {
    if (!t.db.host || !t.db.database || !t.db.user) throw new Error('tenant-db-missing-params')
    conn = await mysql.createConnection({
      host: t.db.host, port: t.db.port, database: t.db.database, user: t.db.user, password: t.db.password,
      connectTimeout: 6000
    })

    // clients
    const [cRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.tables.clients}\``)
    clients = Number((cRows as any)[0]?.c || 0)

    // providers/admins (si no existe tabla 'providers', que no rompa)
    try {
      const [pRows] = await conn.query(`SELECT type, COUNT(*) AS c FROM \`${t.tables.providers}\` GROUP BY type`)
      const map = new Map<string, number>()
      ;(pRows as any[]).forEach(r => map.set(String(r.type), Number(r.c)))
      admins = map.get('admin') || 0
      providers = map.get('provider') || 0
    } catch {}

    // users (si existe):
    try {
      const [uRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.tables.users}\``)
      users = Number((uRows as any)[0]?.c || 0)
    } catch {
      users = clients + admins + providers
    }
    return { users, clients, providers, admins }
  } finally {
    try { await conn?.end() } catch {}
  }
}

let planPool: Pool | null = null
async function getRatePerUser(t: Tenant): Promise<number> {
  // 1) Preferir RATE_PER_USER en el .env.* del tenant
  if (typeof t.ratePerUser === 'number' && !Number.isNaN(t.ratePerUser)) return Number(t.ratePerUser)

  // 2) Fallback: leer de una tabla global si hay DATABASE_URL
  if (!DB_URL) return 0
  if (!planPool) {
    planPool = await mysql.createPool(DB_URL)
  }
  const [rows] = await planPool.execute<RowDataPacket[]>(
    'SELECT rate_per_user FROM billing_plan WHERE company_key = ? ORDER BY updated_at DESC LIMIT 1',
    [t.companyKey],
  )
  return Number((rows as any)[0]?.rate_per_user ?? 0)
}

/* =========================
   POST a n8n
   ========================= */
type N8nPayload = { DESCRIPTION:string; QUANTITY:number; RATE:number; TOTAL:number; COMPANY_NAME:string; DETAIL:string }
async function postToN8N(payload: N8nPayload, tenantId: string, companyKey: string) {
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), 15000)
  try {
    const resp = await fetch(BILLING_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
        'x-company-key': companyKey,
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
    const text = await resp.text()
    return { ok: resp.ok, status: resp.status, text }
  } finally { clearTimeout(to) }
}

/* =========================
   Handler
   ========================= */
export async function POST(req: NextRequest) {
  try {
    // Auth opcional
    if (BILLING_RUN_SECRET) {
      const secret = req.headers.get('x-run-secret') || ''
      if (secret !== BILLING_RUN_SECRET) return new Response('Unauthorized', { status: 401 })
    }
    if (!BILLING_WEBHOOK) return new Response('Missing BILLING_WEBHOOK', { status: 500 })

    const url = new URL(req.url)
    const onlyTenant = url.searchParams.get('tenant')?.trim()
    const force = url.searchParams.get('force') === '1'
    const sendZero = url.searchParams.get('sendZero') === '1'

    const host = os.hostname()
    const todayStr = todayLocalYMDString()

    // Descubre tenants
    let files = await listEnvFiles(TENANTS_DIR)
    if (onlyTenant) {
      const expected = `.env.${onlyTenant}`
      files = files.filter((f) => path.basename(f) === expected)
    }
    const tenants: Tenant[] = []
    for (const f of files) tenants.push(await readTenantEnv(f))

    const results: Result[] = []

    for (const t of tenants) {
      try {
        // 1) Fecha
        if (!t.managementDate && !force) {
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-management-date' })
          continue
        }
        if (!force && !dueTodayMonthly(t.managementDate)) {
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'not-due-today' })
          continue
        }

        // 2) Snapshot (DB propia)
        let snap: Counts
        try {
          snap = await getCountsPerTenant(t)
        } catch (e:any) {
          const tag = isSoftDbError(e) ? `db-skip:${e?.code || e?.message || 'unknown'}` : `skip:${e?.message || 'unknown'}`
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: tag })
          continue
        }

        // 3) Tarifa
        const RATE = await getRatePerUser(t)
        const QUANTITY = snap.users
        const TOTAL = Number((QUANTITY * RATE).toFixed(2))

        if (!sendZero && (Number.isNaN(RATE) || RATE <= 0)) {
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-rate' })
          continue
        }
        if (!sendZero && (Number.isNaN(QUANTITY) || QUANTITY <= 0)) {
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-users' })
          continue
        }

        // 4) Enviar a n8n
        const DESCRIPTION = `${todayStr} — Scheduled Invoice (${t.managementStatus || 'N/A'})`
        const DETAIL = `${snap.clients} clients, ${snap.providers} providers, ${snap.admins} admins — host=${host} envFile=${t.envFile}`

        const resp = await postToN8N({
          DESCRIPTION, QUANTITY, RATE, TOTAL, COMPANY_NAME: t.companyName, DETAIL
        }, t.tenantId, t.companyKey)

        results.push({
          tenantId: t.tenantId,
          status: resp.status,
          ok: resp.ok,
          error: resp.ok ? undefined : resp.text || 'unknown',
        })
      } catch (e:any) {
        // Cualquier error por-tenant se degrada a "skip suave"
        const tag = isSoftDbError(e) ? `db-skip:${e?.code || e?.message || 'unknown'}` : `skip:${e?.message || 'unknown'}`
        results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: tag })
        continue
      }
    }

    // 200 salvo error global fuera del loop
    const payload = { ok: true, sent: results.length, results }
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  } catch (e:any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
