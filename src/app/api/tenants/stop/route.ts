// src/app/api/admin/tenants/stop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadTenants } from '@/lib/tenants';

const exec = promisify(execFile);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_TOKEN = process.env.INTERNAL_N8N_TOKEN;

// Convención: cómo se llaman los contenedores por tenant
function containersForTenant(tenantId: string) {
  return [
    `vivace-app-${tenantId}`,
    `vivace-webserver-${tenantId}`,
  ];
}

export async function POST(req: NextRequest) {
  // 1) Auth (opcional pero recomendado)
  if (INTERNAL_TOKEN) {
    const token = req.headers.get('x-internal-token');
    if (token !== INTERNAL_TOKEN) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else {
    // ⚠️ Sin token → esto queda expuesto. Déjalo solo si estás en red privada / detrás de firewall.
    console.warn(
      '[admin/tenants/stop] INTERNAL_N8N_TOKEN is not set. Endpoint is unprotected!',
    );
  }

  // 2) Input
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  const tenantId = String(body.tenantId || '').trim();

  if (!tenantId || !/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    return NextResponse.json({ error: 'invalid tenantId' }, { status: 400 });
  }

  // 3) Validar que el tenant exista según tus .env.*
  try {
    const tenants = await loadTenants(); // ya lee .env.* y arma ids
    const exists = tenants.some((t) => t.id === tenantId);
    if (!exists) {
      return NextResponse.json(
        { error: 'unknown tenantId', tenantId },
        { status: 400 },
      );
    }
  } catch (e: any) {
    // si falla loadTenants, mejor no matar nada
    return NextResponse.json(
      { error: 'failed to verify tenant', detail: e?.message || String(e) },
      { status: 500 },
    );
  }

  const containers = containersForTenant(tenantId);

  try {
    // 4) Ejecutar docker stop
    const { stdout, stderr } = await exec('docker', ['stop', ...containers]);

    return NextResponse.json({
      ok: true,
      tenantId,
      containers,
      stdout,
      stderr,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        tenantId,
        containers,
        error: e?.message || 'docker stop failed',
        code: e?.code,
        stderr: e?.stderr,
        stdout: e?.stdout,
      },
      { status: 500 },
    );
  }
}
