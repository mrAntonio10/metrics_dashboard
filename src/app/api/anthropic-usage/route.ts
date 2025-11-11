import { NextResponse } from 'next/server';

const N8N_ANTHROPIC_USAGE_URL = 'https://n8n.uqminds.org/webhook/596bc3f6-651a-489b-b662-4f1033cd778c/get-anthropic-usage';

type N8nRow = {
  row_number?: number;
  EXECUTION_ID: number | string;
  TENANT: string;
  INPUT: number | string;
  OUTPUT: number | string;
  DATE: string;
};

function toNumber(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    const res = await fetch(N8N_ANTHROPIC_USAGE_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      const text =
        (await res.text().catch(() => '')) || '<no body>';
      console.error(
        '[ANTHROPIC_USAGE] HTTP error from n8n:',
        res.status,
        text,
      );
      return NextResponse.json(
        { ok: false, error: `Upstream HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const json = await res.json();

    // El webhook devuelve un array plano como el que mostraste
    const arr: N8nRow[] = Array.isArray(json) ? json : [];

    const rows = arr.map((r, index) => ({
      executionId: r.EXECUTION_ID ?? index + 1,
      tenant: r.TENANT || 'unknown',
      inputTokens: toNumber(r.INPUT),
      outputTokens: toNumber(r.OUTPUT),
      date: r.DATE || '',
    }));

    // Nada de filtros agresivos: devolvemos TODO y filtramos solo en el front
    return NextResponse.json({
      ok: true,
      rows,
    });
  } catch (e) {
    console.error('[ANTHROPIC_USAGE] Error:', e);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch Anthropic usage',
      },
      { status: 500 },
    );
  }
}
