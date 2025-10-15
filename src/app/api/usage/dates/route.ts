import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'node:path';

const BASE = process.env.VIVACE_METRICS_DIR ?? '/var/lib/vivace-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const dir = path.join(BASE, 'history');
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const dates = entries
      .filter(e => e.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(e.name))
      .map(e => e.name.replace(/\.json$/, ''))
      .sort();
    return NextResponse.json({ dates }, { headers: { 'cache-control': 'no-store, max-age=0' } });
  } catch (err: any) {
    return NextResponse.json({ dates: [], error: err?.message ?? 'list_failed' });
  }
}
