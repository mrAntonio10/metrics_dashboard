// src/app/api/usage/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'node:path';
import { loadTenants } from '@/lib/tenants';

const BASE = process.env.VIVACE_METRICS_DIR ?? '/var/lib/vivace-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const file = date
      ? path.join(BASE, 'history', `${date}.json`)
      : path.join(BASE, 'metrics.json');

    const txt = await fs.readFile(file, 'utf8');

    // Parseamos el payload original
    let payload: any;
    try {
      payload = JSON.parse(txt);
    } catch {
      // Si no es JSON válido, devolvemos tal cual (comportamiento viejo)
      return new NextResponse(txt, {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store, max-age=0',
        },
      });
    }

    // Intentamos enriquecer con nombres bonitos usando loadTenants()
    try {
      const tenants = await loadTenants(); // ya aplica REAL_NAME || APP_NAME || id
      const map = new Map(tenants.map((t) => [t.id, t.name]));

      const clientDisplay: Record<string, string> = {};

      // Usamos la lista de clients si viene, si no inferimos desde containers/client_agg
      const clientIds = new Set<string>();

      if (Array.isArray(payload.clients)) {
        payload.clients.forEach((c: any) => {
          if (typeof c === 'string') clientIds.add(c);
        });
      }

      if (Array.isArray(payload.client_agg)) {
        payload.client_agg.forEach((a: any) => {
          if (a && typeof a.client === 'string') clientIds.add(a.client);
        });
      }

      if (Array.isArray(payload.containers)) {
        payload.containers.forEach((c: any) => {
          if (c && typeof c.client === 'string') clientIds.add(c.client);
        });
      }

      for (const id of clientIds) {
        const pretty = map.get(id);
        if (pretty) {
          clientDisplay[id] = pretty;
        } else {
          // fallback: si no está mapeado, dejamos el id tal cual
          clientDisplay[id] = id;
        }
      }

      // Solo agregamos si hay algo útil
      if (Object.keys(clientDisplay).length > 0) {
        payload.client_display = clientDisplay;
      }
    } catch (e) {
      // Si algo falla en loadTenants, no rompemos el endpoint
      // y seguimos devolviendo el payload original.
    }

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'metrics_unavailable' },
      { status: 503 },
    );
  }
}
