import { NextRequest, NextResponse } from 'next/server';

const N8N_BASE = 'https://n8n.uqminds.org/webhook';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const company  = searchParams.get('company');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo   = searchParams.get('dateTo');
    const page     = searchParams.get('page')     || '1';
    const pageSize = searchParams.get('pageSize') || '10';

    const qs = new URLSearchParams();
    if (company)  qs.append('company', company);
    if (dateFrom) qs.append('dateFrom', dateFrom);
    if (dateTo)   qs.append('dateTo', dateTo);
    qs.append('page', page);
    qs.append('pageSize', pageSize);

    const upstream = `${N8N_BASE}/feedback/list?${qs.toString()}`;
    const res = await fetch(upstream, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('Upstream /feedback/list failed:', res.status, text);
      return new NextResponse(text || 'Upstream error', { status: res.status });
    }

    return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in feedback API:', error);
    return NextResponse.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
}
