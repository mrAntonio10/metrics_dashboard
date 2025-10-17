// src/app/api/feedback/companies/route.ts
import { NextResponse } from 'next/server';

const N8N_BASE_URL = 'https://n8n.uqminds.org/webhook/feedback/companies';

export async function GET() {
  try {
    const res = await fetch(`${N8N_BASE_URL}/feedback/companies`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error fetching feedback companies: ${res.statusText}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in feedback companies API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
