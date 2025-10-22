// src/app/api/billing/run/route.ts
import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import mysql, { RowDataPacket, Pool, PoolConnection } from 'mysql2/promise'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* =========================
   Config (por ENV del contenedor)
   ========================= */
const BILLING_RUN_SECRET = (process.env.BILLING_RUN_SECRET || '').trim() // si vacío, no exige secreto
const BILLING_WEBHOOK =
  process.env.BILLING_WEBHOOK ||
  'https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a'
const TENANTS_DIR = process.env.TENANTS_DIR || '/data/vivace-vivace-api' // ajusta si tu volumen es /data/vivace-api
const ENV_PREFIX = '.env.' // .env.client1, .env.stock1, etc.
const DB_URL = process.env.DATABASE_URL // ej: mysql://user:pass@host:3306/dbname
const TZ = 'America/La_Paz'

/* =========================
   Tipos auxiliares
   ========================= */
type UsersRow = RowDataPacket & { users: number }
type ClientsRow = RowDataPacket & { clients: number }
type ProvidersRow = RowDataPacket & { providers: number }
type AdminsRow = RowDataPacket & { admins: number }
type PlanRow = RowDataPacket & { rate_per_user: number }

type Snapshot = {
  users: number
  clients: number
  providers: number
  admins: number
  ratePerUser: number
}

type TenantEnv = {
  tenantId: string
  companyKey: string
  companyName: string
  managementStatus: string // TRIAL/ACTIVE/etc
  managementDate: string | '' // YYYY-MM-DD
  envFile: string
}

/* =========================
   Utilidades de fecha (La Paz)
   ========================= */
function todayLocalParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [y, m, dd] = f
    .format(d)
    .split('-')
    .map((n) => Number(n))
  return { y, m, d: dd } // {2025,10,22}
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
function lastDayOfMonth(y: number, m: number) {
  // m: 1..12
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
function cmpYMD(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
) {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}
/** Lógica mensual anclada a MANAGEMENT_DATE (clamp al fin de mes).
 *  - anchor = día de MANAGEMENT_DATE (p.ej. 31)
 *  - scheduledDay = min(anchor, LDOM) del MES ACTUAL (La Paz)
 *  - due hoy si today.d == scheduledDay y today >= MANAGEMENT_DATE
 */
function dueTodayMonthly(anchorYmd?: string) {
  const anchor = parseYMD(anchorYmd)
  if (!anchor) return false
  const today = todayLocalParts()
  if (cmpYMD(today, anchor) < 0) return false // no antes del primer anchor
  const sched = Math.min(anchor.d, lastDayOfMonth(today.y, today.m))
  return today.d === sched
}

/* =========================
   Parsers de .env.*
   ========================= */
function trim(s: string) {
  return s.replace(/^\s+|\s+$/g, '')
}
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = trim(raw)
    if (!line || line.startsWith('#')) continue
    const noExport = line.startsWith('export ') ? line.slice(7) : line
    const eq = noExport.indexOf('=')
    if (eq <= 0) continue
    const key = trim(noExport.slice(0, eq))
    let val = noExport.slice(eq + 1)
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
async function listEnvFiles(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter(
      (e) => e.isFile() && e.name.startsWith(ENV_PREFIX) && e.name.length > ENV_PREFIX.length,
    )
    .map((e) => path.join(dir, e.name))
}
async function readTenantEnv(file: string): Promise<TenantEnv> {
  const base = path.basename(file) // .env.client1
  const tenantId = base.slice(ENV_PREFIX.length) // client1
  const env = parseDotenv(await fs.readFile(file, 'utf8'))

  const companyKey = env['COMPANY_KEY'] || tenantId
  const companyName =
    env['COMPANY_NAME'] || env['TENANT_NAME'] || env['APP_TENANT_NAME'] || tenantId
  const managementStatus = (env['MANAGEMENT_STATUS'] || '').toUpperCase()
  const managementDate = env['MANAGEMENT_DATE'] || ''

  return { tenantId, companyKey, companyName, managementStatus, managementDate, envFile: file }
}

/* =========================
   MySQL (pool + snapshot)
   ========================= */
let pool: Pool | null = null
async function getPool() {
  if (!pool) {
    if (!DB_URL) throw new Error('DATABASE_URL no definido en el contenedor')
    pool = await mysql.createPool(DB_URL)
  }
  return pool
}

async function count<T extends RowDataPacket>(
  conn: PoolConnection,
  sql: string,
  alias: keyof T & string,
  params: any[] = [],
): Promise<number> {
  const [rows] = await conn.execute<T[]>(sql as any, params)
  const first = rows[0] as Record<string, any> | undefined
  return Number(first?.[alias] ?? 0)
}

async function getRatePerUser(conn: PoolConnection, companyKey: string): Promise<number> {
  const [rows] = await conn.execute<PlanRow[]>(
    'SELECT rate_per_user FROM billing_plan WHERE company_key = ? ORDER BY updated_at DESC LIMIT 1',
    [companyKey],
  )
  return Number(rows[0]?.rate_per_user ?? 0)
}

async function getBillingSnapshot(companyKey: string): Promise<Snapshot> {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const users = await count<UsersRow>(
      conn,
      'SELECT COUNT(*) AS users FROM users WHERE company_key = ?',
      'users',
      [companyKey],
    )
    const clients = await count<ClientsRow>(
      conn,
      'SELECT COUNT(*) AS clients FROM clients WHERE company_key = ?',
      'clients',
      [companyKey],
    )
    const providers = await count<ProvidersRow>(
      conn,
      'SELECT COUNT(*) AS providers FROM providers WHERE company_key = ?',
      'providers',
      [companyKey],
    )
    const admins = await count<AdminsRow>(
      conn,
      "SELECT COUNT(*) AS admins FROM users WHERE company_key = ? AND role = 'admin'",
      'admins',
      [companyKey],
    )
    const ratePerUser = await getRatePerUser(conn, companyKey)
    return { users, clients, providers, admins, ratePerUser }
  } finally {
    conn.release()
  }
}

/* =========================
   POST a n8n (JSON con 6 claves)
   ========================= */
type N8nPayload = {
  DESCRIPTION: string
  QUANTITY: number
  RATE: number
  TOTAL: number
  COMPANY_NAME: string
  DETAIL: string
}
async function postToN8N(payload: N8nPayload) {
  const resp = await fetch(BILLING_WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await resp.text()
  return { ok: resp.ok, status: resp.status, text }
}

/* =========================
   Handler
   ========================= */
export async function POST(req: NextRequest) {
  try {
    // Auth opcional: si hay secreto, se exige; si no, libre.
    if (BILLING_RUN_SECRET) {
      const secret = req.headers.get('x-run-secret') || ''
      if (secret !== BILLING_RUN_SECRET) return new Response('Unauthorized', { status: 401 })
    }
    if (!BILLING_WEBHOOK) return new Response('Missing BILLING_WEBHOOK', { status: 500 })

    const host = os.hostname()
    const todayStr = todayLocalYMDString()

    // Soporte opcional: /api/billing/run?tenant=client1  (para ejecutar solo un tenant)
    const onlyTenant = new URL(req.url).searchParams.get('tenant')?.trim()

    // Descubre envs
    let files = await listEnvFiles(TENANTS_DIR)
    if (onlyTenant) {
      const expected = `.env.${onlyTenant}`
      files = files.filter((f) => path.basename(f) === expected)
    }

    const results: Array<{
      tenantId: string
      status: number
      ok: boolean
      reason?: string
      error?: string
    }> = []

    for (const file of files) {
      try {
        const t = await readTenantEnv(file)

        // Sin fecha de management -> no se factura
        if (!t.managementDate) {
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-management-date' })
          continue
        }

        // ¿Toca cobrar hoy? (clamp al fin de mes, nunca antes del primer MANAGEMENT_DATE)
        const due = dueTodayMonthly(t.managementDate)
        if (!due) {
          results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'not-due-today' })
          continue
        }

        // Snapshot DB
        const snap = await getBillingSnapshot(t.companyKey)
        const QUANTITY = snap.users
        const RATE = snap.ratePerUser
        const TOTAL = Number((QUANTITY * RATE).toFixed(2))

        if (!QUANTITY || !RATE) {
          results.push({
            tenantId: t.tenantId,
            status: 204,
            ok: true,
            reason: 'qty-or-rate-zero',
          })
          continue
        }

        const DESCRIPTION = `${todayStr} — Scheduled Invoice (${t.managementStatus || 'N/A'})`
        const DETAIL = `${snap.clients} clients, ${snap.providers} providers, ${snap.admins} admins — host=${host} envFile=${t.envFile}`

        const resp = await postToN8N({
          DESCRIPTION,
          QUANTITY,
          RATE,
          TOTAL,
          COMPANY_NAME: t.companyName,
          DETAIL,
        })

        results.push({
          tenantId: t.tenantId,
          status: resp.status,
          ok: resp.ok,
          error: resp.ok ? undefined : resp.text || 'unknown',
        })
      } catch (e: any) {
        results.push({
          tenantId: path.basename(file).slice(ENV_PREFIX.length),
          status: 500,
          ok: false,
          error: e?.message || String(e),
        })
      }
    }

    const anyFail = results.some((r) => !r.ok)
    return new Response(
      JSON.stringify({ ok: !anyFail, sent: results.length, results }, null, 2),
      { status: anyFail ? 500 : 200, headers: { 'content-type': 'application/json' } },
    )
  } catch (e: any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
