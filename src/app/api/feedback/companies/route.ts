import { NextResponse } from 'next/server';

const N8N_BASE = 'https://n8n.uqminds.org/webhook';

export async function GET() {
  try {
    const upstream = `${N8N_BASE}/feedback/companies`;
    const res = await fetch(upstream, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    // Para ver el error real si falla:
    const text = await res.text();
    if (!res.ok) {
      console.error('Upstream /feedback/companies failed:', res.status, text);
      return new NextResponse(text || 'Upstream error', { status: res.status });
    }

    return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in feedback companies API:', error);
    return NextResponse.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
}
