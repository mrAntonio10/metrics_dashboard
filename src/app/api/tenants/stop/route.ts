// src/app/api/tenants/stop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadTenants } from '@/lib/tenants';

const exec = promisify(execFile);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Convención: cómo se llaman los contenedores por tenant
function containersForTenant(tenantId: string) {
  return [
    `vivace-app-${tenantId}`,
    // `vivace-webserver-${tenantId}`, // Commented: webserver containers no longer exist
  ];
}

export async function POST(req: NextRequest) {
  // 1) Leer body
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

  // 2) Validar que el tenant exista según tus .env.*
  try {
    const tenants = await loadTenants();
    const exists = tenants.some((t) => t.id === tenantId);
    if (!exists) {
      return NextResponse.json(
        { error: 'unknown tenantId', tenantId },
        { status: 400 },
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: 'failed to verify tenant', detail: e?.message || String(e) },
      { status: 500 },
    );
  }

  const containers = containersForTenant(tenantId);

  // 3) Ejecutar docker stop
  try {
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
