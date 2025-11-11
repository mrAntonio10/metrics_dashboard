// src/app/api/tenants/status/route.ts
import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadTenants } from '@/lib/tenants';

const exec = promisify(execFile);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// misma convención que usaste en stop
function containersForTenant(tenantId: string) {
  return [
    `vivace-app-${tenantId}`,
    `vivace-webserver-${tenantId}`,
  ];
}

type ContainerStatus = {
  name: string;
  rawStatus: string;   // ej: "Up 3 hours" o "Exited (0) 5 minutes ago" o "missing"
  isUp: boolean;
};

type TenantStatus = {
  tenantId: string;
  tenantName: string;
  overall: 'up' | 'down' | 'missing'; // up=todo arriba, down=existe alguno pero no todos "Up", missing=ningún contenedor encontrado
  containers: ContainerStatus[];
};

export async function GET() {
  try {
    const tenants = await loadTenants();

    // Traemos TODOS los contenedores con su status
    const { stdout } = await exec('docker', [
      'ps',
      '-a',
      '--format',
      '{{.Names}}||{{.Status}}',
    ]);

    const lines = stdout.trim().split('\n').filter(Boolean);
    const dockerMap = new Map<string, string>();
    for (const line of lines) {
      const [name, status] = line.split('||');
      if (name) dockerMap.set(name, status || '');
    }

    const items: TenantStatus[] = tenants.map((t) => {
      const names = containersForTenant(t.id);

      const containers: ContainerStatus[] = names.map((name) => {
        const raw = dockerMap.get(name);
        const rawStatus = raw || 'missing';
        const isUp = !!raw && raw.startsWith('Up ');
        return { name, rawStatus, isUp };
      });

      const anyExists = containers.some((c) => c.rawStatus !== 'missing');
      const allUp = containers.length > 0 && containers.every((c) => c.isUp);

      let overall: TenantStatus['overall'];
      if (!anyExists) overall = 'missing';
      else if (allUp) overall = 'up';
      else overall = 'down';

      return {
        tenantId: t.id,
        tenantName: t.name,
        overall,
        containers,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'status_failed' },
      { status: 500 },
    );
  }
}
