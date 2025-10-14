import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';

const HIST_DIR = process.env.METRICS_HISTORY_DIR ?? '/var/lib/vivace-metrics/history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entries = await fs.readdir(HIST_DIR);
    const dates = entries
      .filter(n => n.endsWith('.json'))
      .map(n => n.replace('.json',''))
      .sort(); // YYYY-MM-DD ordena por fecha
    return NextResponse.json({ dates });
  } catch {
    return NextResponse.json({ dates: [] });
  }
}
