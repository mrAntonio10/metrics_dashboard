// src/app/api/billing/run/route.ts
import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ENV esperadas en el contenedor
const RUN_SECRET = process.env.BILLING_RUN_SECRET || 'cambialo'
const BILLING_WEBHOOK = process.env.BILLING_WEBHOOK // <--- pon aquí tu webhook n8n por ENV
const TENANTS_DIR = process.env.TENANTS_DIR || '/data/vivace-api'
const ENV_PREFIX = '.env.' // .env.client1, .env.stock1, etc.

function trim(s: string) {
  return s.replace(/^\s+|\s+$/g, '')
}

function parseDotenv(text: string): Record<string, string> {
  // Parser sencillo (sin evaluar nada), respeta comillas simples/dobles
  const out: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = trim(raw)
    if (!line || line.startsWith('#')) continue
    const noExport = line.startsWith('export ') ? line.slice(7) : line
    const eq = noExport.indexOf('=')
    if (eq <= 0) continue
    const key = trim(noExport.slice(0, eq))
    let val = noExport.slice(eq + 1)
    // quita envolturas de comillas si existen
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function boolify(v?: string) {
  if (!v) return false
  return /^(1|true|yes|y|on)$/i.test(v)
}

async function postJSON(url: string, body: unknown, timeoutMs = 20000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
    const text = await resp.text()
    return { ok: resp.ok, status: resp.status, text }
  } finally {
    clearTimeout(t)
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-run-secret') || ''
    if (secret !== RUN_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (!BILLING_WEBHOOK) {
      return new Response('Missing BILLING_WEBHOOK env', { status: 500 })
    }

    const host = os.hostname()
    const ts = new Date().toISOString()

    // Lee el directorio TENANTS_DIR y filtra archivos que empiecen con ".env."
    const entries = await fs.readdir(TENANTS_DIR, { withFileTypes: true })
    const envFiles = entries
      .filter(e => e.isFile() && e.name.startsWith(ENV_PREFIX) && e.name.length > ENV_PREFIX.length)
      .map(e => path.join(TENANTS_DIR, e.name))

    const results: Array<{ file: string; tenantId: string; status: number; ok: boolean; error?: string }> = []

    for (const file of envFiles) {
      // tenantId por convención: .env.<tenantId>
      const base = path.basename(file) // p.ej ".env.client1"
      const tenantId = base.slice(ENV_PREFIX.length) // "client1"

      // Carga y parsea el .env.<tenantId>
      const content = await fs.readFile(file, 'utf8')
      const envObj = parseDotenv(content)

      // Ajusta estas keys a tu realidad de .env
      const TENANT_NAME = envObj['TENANT_NAME'] || envObj['APP_TENANT_NAME'] || tenantId

      const BILLING_USER_PRICE = Number(envObj['BILLING_USER_PRICE'] || 0)
      const BILLING_CHATS_ENABLED = boolify(envObj['BILLING_CHATS_ENABLED'])
      const BILLING_CHATS_PRICE = Number(envObj['BILLING_CHATS_PRICE'] || 0)
      const MANAGEMENT_DATE = envObj['MANAGEMENT_DATE'] || envObj['BILLING_MANAGEMENT_DATE'] || ''

      // Aquí podrías “procesar” más datos (consultar DB, contar usuarios, etc.)
      // Por ahora enviamos los del .env + metadatos:
      const payload = {
        timestamp: ts,
        host,
        envFile: file,
        tenant: {
          id: tenantId,
          name: TENANT_NAME,
        },
        billing: {
          userPrice: BILLING_USER_PRICE,
          chatsEnabled: BILLING_CHATS_ENABLED,
          chatsPrice: BILLING_CHATS_PRICE,
          managementDate: MANAGEMENT_DATE,
        },
        raw: {
          BILLING_USER_PRICE: envObj['BILLING_USER_PRICE'] || '',
          BILLING_CHATS_ENABLED: envObj['BILLING_CHATS_ENABLED'] || '',
          BILLING_CHATS_PRICE: envObj['BILLING_CHATS_PRICE'] || '',
        },
      }

      const r = await postJSON(BILLING_WEBHOOK, payload)
      results.push({
        file,
        tenantId,
        status: r.status,
        ok: !!r.ok,
        error: r.ok ? undefined : (r.text || 'unknown error'),
      })
    }

    // Si al menos uno falló, devolvemos 500 con detalle para que lo veas en logs del cron
    const anyFail = results.some(r => !r.ok)
    const body = JSON.stringify({ ok: !anyFail, sent: results.length, results }, null, 2)
    return new Response(body, {
      status: anyFail ? 500 : 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
