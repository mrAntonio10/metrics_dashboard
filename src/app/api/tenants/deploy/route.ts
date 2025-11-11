import { NextRequest, NextResponse } from 'next/server';
import { loadTenants } from '@/lib/tenants';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const exec = promisify(execFile);

// Convención local: nombres de contenedores por tenant
function containersForTenant(tenantId: string) {
  return [
    `vivace-app-${tenantId}`,
    `vivace-webserver-${tenantId}`,
  ];
}

export async function POST(req: NextRequest) {
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

  // 1) Validar tenant contra .env.*
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

  const containers = containersForTenant(tenantId);

  try {
    // 2) Intentar levantar contenedores existentes (detenidos)
    // Si alguno no existe o falla, docker devolverá código != 0
    const { stdout, stderr } = await exec('docker', ['start', ...containers]);

    return NextResponse.json(
      {
        ok: true,
        tenantId,
        containers,
        stdout,
        stderr,
      },
      { status: 200 },
    );
  } catch (e: any) {
    // Aquí podrías agregar lógica extra:
    // - intentar `docker compose -f ... up -d`
    // - o devolver info más detallada
    return NextResponse.json(
      {
        ok: false,
        tenantId,
        containers,
        error: e?.message || 'docker start failed',
        code: e?.code,
        stderr: e?.stderr,
        stdout: e?.stdout,
      },
      { status: 500 },
    );
  }
}
