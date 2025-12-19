import fs from 'fs/promises'
import path from 'path'

const TENANTS_DIR = '/root/vivace-api/'

export async function POST(req: Request) {
  try {
    const { tenantId, status } = await req.json()
    if (!tenantId || !status) {
      console.error('❌ Missing tenantId or status', { tenantId, status })
      return new Response('Missing tenantId or status', { status: 400 })
    }

    const envPath = path.join(TENANTS_DIR, `.env.${tenantId}`)
    console.log('📝 Intentando actualizar archivo:', envPath)

    // Verificar si existe el archivo
    try {
      await fs.access(envPath)
    } catch {
      console.error('❌ No existe el archivo .env del tenant:', envPath)
      return new Response(`.env for tenant '${tenantId}' not found`, { status: 404 })
    }

    const content = await fs.readFile(envPath, 'utf8')
    const now = new Date().toISOString().split('T')[0]

    const lines = content.split(/\r?\n/)
    const newLines = lines
      .filter(
        (l) =>
          !l.startsWith('MANAGEMENT_STATUS=') &&
          !l.startsWith('MANAGEMENT_DATE='),
      )
      .concat([
        `MANAGEMENT_STATUS=${status}`,
        `MANAGEMENT_DATE=${now}`,
      ])

    await fs.writeFile(envPath, newLines.join('\n'), 'utf8')
    console.log(`✅ Archivo actualizado: ${tenantId} -> STATUS=${status}, DATE=${now}`)

    return new Response(JSON.stringify({ ok: true, tenantId, status, date: now }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('🔥 Error en API /api/tenants/update:', e)
    return new Response(`Internal Server Error: ${e.message}`, { status: 500 })
  }
}
