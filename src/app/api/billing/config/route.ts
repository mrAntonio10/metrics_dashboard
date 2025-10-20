// src/app/api/billing/config/route.ts
import fs from 'fs/promises'
import path from 'path'

const TENANTS_DIR = '/root/mr/vivace-api'

type BillingConfig = {
  tenantId: string
  userPrice: number
  chatsEnabled: boolean
  chatsPrice: number
  managementStatus?: string
  managementDate?: string
  invoiceEmail?: string
}

function parseEnv(content: string) {
  const map: Record<string, string> = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    // quita comillas si vienen "..."
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    map[m[1]] = val
  }
  return map
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await req.json()
    if (!tenantId) return new Response('Missing tenantId', { status: 400 })

    const envPath = path.join(TENANTS_DIR, `.env.${tenantId}`)
    await fs.access(envPath).catch(() => { throw new Error(`.env for tenant '${tenantId}' not found`) })
    const raw = await fs.readFile(envPath, 'utf8')
    const env = parseEnv(raw)

    const cfg: BillingConfig = {
      tenantId,
      userPrice: Number(env.USER_PRICE ?? 15),
      chatsEnabled: (env.CHATS_ENABLED ?? 'false').toLowerCase() === 'true',
      chatsPrice: Number(env.CHATS_PRICE ?? 0),
      managementStatus: env.MANAGEMENT_STATUS || undefined,
      managementDate: env.MANAGEMENT_DATE || undefined,
      invoiceEmail: env.EMAIL_FOR_INVOICE || '',
    }

    return new Response(JSON.stringify(cfg), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
