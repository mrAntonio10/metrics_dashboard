// src/app/api/billing/run/route.ts
import { NextRequest } from 'next/server'

// Opcional: mueve esto a env del servidor
const RUN_SECRET = process.env.BILLING_RUN_SECRET || 'cámbiame-por-env'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-run-secret') || ''
    if (secret !== RUN_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    // TODO: aquí llamas a tu lógica de billing:
    //  - snapshot a DB
    //  - POST al webhook de n8n
    //  - logs
    // Puedes reusar tu `runBilling()` moviéndolo a un módulo compartido.
    // Ejemplo ultra simplificado:
    const resp = await fetch(process.env.BILLING_WEBHOOK!, { method: 'POST' })
    if (!resp.ok) {
      const txt = await resp.text()
      throw new Error(`Webhook HTTP ${resp.status}: ${txt.slice(0,120)}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 })
  }
}
