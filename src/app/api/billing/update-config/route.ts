// src/app/api/billing/update-config/route.ts
import fs from 'fs/promises'
import path from 'path'

const TENANTS_DIR = '/root/vivace-api'

function sanitizeLine(s: string) {
  return s.replace(/\r?\n/g, '').trim()
}

function upsert(lines: string[], k: string, v: string) {
  const keyEq = `${k}=`
  const newLine = `${k}=${v}`
  // elimina ocurrencias previas de esa key (si las hubiera)
  const filtered = lines.filter(l => !sanitizeLine(l).startsWith(keyEq))
  filtered.push(newLine)
  return filtered
}

export async function POST(req: Request) {
  try {
    const { tenantId, newUserPrice, invoiceEmail } = await req.json()
    if (!tenantId) return new Response('Missing tenantId', { status: 400 })
    if (newUserPrice == null) return new Response('Missing newUserPrice', { status: 400 })

    // validación simple de email (opcional)
    if (invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(invoiceEmail))) {
      return new Response('Invalid invoiceEmail', { status: 400 })
    }

    const envPath = path.join(TENANTS_DIR, `.env.${tenantId}`)
    await fs.access(envPath).catch(() => { throw new Error(`.env for tenant '${tenantId}' not found`) })

    const content = await fs.readFile(envPath, 'utf8')
    let lines = content.split(/\r?\n/).filter(l => l.length > 0)

    // USER_PRICE
    lines = upsert(lines, 'USER_PRICE', String(newUserPrice))

    // EMAIL_FOR_INVOICE (vacío => borra la key)
    if (invoiceEmail === '' || invoiceEmail == null) {
      lines = lines.filter(l => !sanitizeLine(l).startsWith('EMAIL_FOR_INVOICE='))
    } else {
      // no uses comillas para mantener estilo del archivo, salvo que quieras forzarlas
      lines = upsert(lines, 'EMAIL_FOR_INVOICE', String(invoiceEmail))
    }

    // marca de auditoría opcional
    lines = upsert(lines, 'LAST_USER_PRICE_UPDATE_AT', new Date().toISOString())

    await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf8')

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
