// src/app/api/usage/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';

const LIVE = process.env.METRICS_PATH ?? '/var/lib/vivace-metrics/metrics.json';
const HIST_DIR = process.env.METRICS_HISTORY_DIR ?? '/var/lib/vivace-metrics/history';
const HIST_ALL = process.env.METRICS_HISTORY_FILE ?? '/var/lib/vivace-metrics/history.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date'); // YYYY-MM-DD

  try {
    if (date) {
      // 1) intenta snapshot del día
      const dayPath = `${HIST_DIR}/${date}.json`;
      try {
        const raw = await fs.readFile(dayPath, 'utf8');
        return NextResponse.json(JSON.parse(raw), { headers: { 'cache-control': 'no-store' } });
      } catch {
        // 2) fallback: history.json acumulado
        const rawAll = await fs.readFile(HIST_ALL, 'utf8');
        const all = JSON.parse(rawAll);
        if (all && all[date]) {
          return NextResponse.json(all[date], { headers: { 'cache-control': 'no-store' } });
        }
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
    }

    // sin fecha => “live”
    const raw = await fs.readFile(LIVE, 'utf8');
    return NextResponse.json(JSON.parse(raw), { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'metrics_unavailable' }, { status: 503 });
  }
}
