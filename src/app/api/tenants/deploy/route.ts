// src/app/api/tenants/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loadTenants } from '@/lib/tenants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// poné aquí la URL real del webhook de n8n que levanta el tenant
const N8N_DEPLOY_WEBHOOK =
  process.env.N8N_DEPLOY_WEBHOOK ||
  'https://n8n.uqminds.org/webhook/deploy-tenant'; // ajustá este path

export async function POST(req: NextRequest) {
  if (!N8N_DEPLOY_WEBHOOK) {
    return NextResponse.json(
      { ok: false, error: 'Missing N8N_DEPLOY_WEBHOOK' },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json body' }, { status: 400 });
  }

  const tenantId = String(body.tenantId || '').trim();
  if (!tenantId || !/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    return NextResponse.json({ ok: false, error: 'invalid tenantId' }, { status: 400 });
  }

  // validar que exista ese tenant según tus .env.*
  try {
    const tenants = await loadTenants();
    const exists = tenants.some((t) => t.id === tenantId);
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: 'unknown tenantId', tenantId },
        { status: 400 },
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'failed to verify tenant', detail: String(e?.message || e) },
      { status: 500 },
    );
  }

  // forward al webhook de n8n
  try {
    const resp = await fetch(N8N_DEPLOY_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });

    const text = await resp.text();

    return NextResponse.json(
      {
        ok: resp.ok,
        status: resp.status,
        tenantId,
        n8nResponse: text,
      },
      { status: resp.ok ? 200 : 500 },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        tenantId,
        error: e?.message || 'failed to call n8n webhook',
      },
      { status: 500 },
    );
  }
}
