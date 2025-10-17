// src/app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';

const N8N_BASE_URL = 'https://n8n.uqminds.org/webhook';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const company = searchParams.get('company');
    const status = searchParams.get('status');   // 👈 nuevo
    const urgency = searchParams.get('urgency'); // 👈 nuevo
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '10';

    const params = new URLSearchParams();
    if (month)   params.append('month', month);
    if (company) params.append('company', company);
    if (status)  params.append('status', status);     // 👈 nuevo
    if (urgency) params.append('urgency', urgency);   // 👈 nuevo
    params.append('page', page);
    params.append('pageSize', pageSize);

    const response = await fetch(`${N8N_BASE_URL}/tickets/list?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error fetching tickets: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in tickets API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
