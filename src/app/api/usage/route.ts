// src/app/api/usage/route.ts
import { NextResponse } from 'next/server';
import { readMetrics } from '@/app/services/localService.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await readMetrics();
    return NextResponse.json(data, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'metrics_unavailable' }, { status: 503 });
  }
}
