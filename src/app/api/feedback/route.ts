// src/app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';

const N8N_BASE_URL = 'https://n8n.uqminds.org/webhook/feedback/list';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const company  = searchParams.get('company');    // 'all' | nombre exacto
    const dateFrom = searchParams.get('dateFrom');   // YYYY-MM-DD
    const dateTo   = searchParams.get('dateTo');     // YYYY-MM-DD
    const page     = searchParams.get('page')     || '1';
    const pageSize = searchParams.get('pageSize') || '10';

    const qs = new URLSearchParams();
    if (company)  qs.append('company', company);
    if (dateFrom) qs.append('dateFrom', dateFrom);
    if (dateTo)   qs.append('dateTo', dateTo);
    qs.append('page', page);
    qs.append('pageSize', pageSize);

    const res = await fetch(`${N8N_BASE_URL}/feedback/list?${qs.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error fetching feedback: ${res.statusText}`);

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in feedback API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
