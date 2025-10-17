// src/app/api/tickets/companies/route.ts
import { NextResponse } from 'next/server';

const N8N_BASE_URL = 'https://n8n.uqminds.org/webhook';

export async function GET() {
  try {
    const response = await fetch(`${N8N_BASE_URL}/tickets/companies`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching companies: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in companies API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}