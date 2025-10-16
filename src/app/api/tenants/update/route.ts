import fs from 'fs/promises'
import path from 'path'

const TENANTS_DIR = '/root/mr/vivace-api/'

export async function POST(req: Request) {
  const { tenantId, status } = await req.json()
  if (!tenantId || !status) return new Response('Missing data', { status: 400 })

  const envPath = path.join(TENANTS_DIR, `.env.${tenantId}`)
  try {
    const content = await fs.readFile(envPath, 'utf8')
    const now = new Date().toISOString().split('T')[0]
    const lines = content.split(/\r?\n/)

    const newLines = lines
      .filter((l) => !l.startsWith('MANAGEMENT_STATUS=') && !l.startsWith('MANAGEMENT_DATE='))
      .concat([`MANAGEMENT_STATUS=${status}`, `MANAGEMENT_DATE=${now}`])

    await fs.writeFile(envPath, newLines.join('\n'), 'utf8')

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('Error updating .env', tenantId, e)
    return new Response('Internal error', { status: 500 })
  }
}
