import fs from 'fs/promises'
import path from 'path'

const TENANTS_DIR = '/root/mr/vivace-api'

function upsert(k: string, v: string, lines: string[]) {
  const idx = lines.findIndex(l => l.startsWith(`${k}=`))
  if (idx >= 0) lines[idx] = `${k}=${v}`
  else lines.push(`${k}=${v}`)
}

export async function POST(req: Request) {
  try {
    const { tenantId, newUserPrice, notifyAdmin, notifyTenant } = await req.json()
    if (!tenantId || newUserPrice == null) return new Response('Missing tenantId or newUserPrice', { status: 400 })

    const envPath = path.join(TENANTS_DIR, `.env.${tenantId}`)
    await fs.access(envPath).catch(() => { throw new Error(`.env for tenant '${tenantId}' not found`) })
    const content = await fs.readFile(envPath, 'utf8')
    const lines = content.split(/\r?\n/).filter(Boolean)

    upsert('USER_PRICE', String(newUserPrice), lines)
    // Si quieres persistir flags por auditoría:
    upsert('LAST_USER_PRICE_UPDATE_AT', new Date().toISOString(), lines)

    await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf8')

    // (Opcional) Enviar emails: aquí sólo dejamos hooks para que integres tu mailer o N8N
    // if (notifyAdmin) await fetch('http://n8n/…', { method:'POST', body: JSON.stringify({tenantId,newUserPrice,who:'admin'})})
    // if (notifyTenant) await fetch('http://n8n/…', { method:'POST', body: JSON.stringify({tenantId,newUserPrice,who:'tenant'})})

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e:any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
