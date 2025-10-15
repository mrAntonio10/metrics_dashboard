import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'node:path';

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

    // Passthrough — devolvemos el archivo tal cual
    return new NextResponse(txt, {
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
