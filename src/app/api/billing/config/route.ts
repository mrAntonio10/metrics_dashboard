import fs from 'fs/promises'
import path from 'path'

const TENANTS_DIR = '/root/mr/vivace-api'

type BillingConfig = {
  tenantId: string
  userPrice: number      // USER_PRICE
  chatsEnabled: boolean  // CHATS_ENABLED (opcional)
  chatsPrice: number     // CHATS_PRICE (opcional)
  managementStatus?: string
  managementDate?: string // YYYY-MM-DD (aniversario de renovación)
}

function parseEnv(content: string) {
  const map: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) map[m[1]] = m[2]
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
      chatsEnabled: (env.CHATS_ENABLED ?? 'true').toLowerCase() === 'true',
      chatsPrice: Number(env.CHATS_PRICE ?? 0), // si quieres que “Chats” esté incluido en USER_PRICE, deja 0 aquí
      managementStatus: env.MANAGEMENT_STATUS,
      managementDate: env.MANAGEMENT_DATE, // día de aniversario (YYYY-MM-DD)
    }

    return new Response(JSON.stringify(cfg), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e:any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
