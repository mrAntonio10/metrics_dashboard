import { NextRequest, NextResponse } from 'next/server';

const N8N_ANTHROPIC_USAGE_URL =
  process.env.N8N_ANTHROPIC_USAGE_URL ||
  'https://n8n.uqminds.org/webhook/596bc3f6-651a-489b-b662-4f1033cd778c/get-anthropic-usage';

type RawRow = {
  EXECUTION_ID?: number | string;
  executionId?: number | string;
  execution_id?: number | string;

  TENANT?: string;
  tenant?: string;
  client?: string;
  company?: string;

  INPUT?: number | string;
  input?: number | string;
  inputTokens?: number | string;
  input_tokens?: number | string;

  OUTPUT?: number | string;
  output?: number | string;
  outputTokens?: number | string;
  output_tokens?: number | string;

  DATE?: string;
  date?: string;
  timestamp?: string;
};

function toNumber(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(N8N_ANTHROPIC_USAGE_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = (await res.text().catch(() => '')) || '<no body>';
      console.error('[ANTHROPIC_USAGE] HTTP error from n8n:', res.status, text);
      return NextResponse.json(
        {
          ok: false,
          error: `Upstream HTTP ${res.status}`,
        },
        { status: 502 },
      );
    }

    const json = await res.json();

    const rows: RawRow[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    const normalized = rows
      .map((r, index) => {
        const executionId =
          r.EXECUTION_ID ??
          r.executionId ??
          r.execution_id ??
          index + 1;

        const tenant =
          (r.TENANT ||
            r.tenant ||
            r.client ||
            r.company ||
            'unknown') as string;

        const inputTokens = toNumber(
          r.INPUT ??
            r.input ??
            r.inputTokens ??
            r.input_tokens,
        );

        const outputTokens = toNumber(
          r.OUTPUT ??
            r.output ??
            r.outputTokens ??
            r.output_tokens,
        );

        const date =
          (r.DATE ||
            r.date ||
            r.timestamp ||
            '') as string;

        return {
          executionId,
          tenant,
          inputTokens,
          outputTokens,
          date,
        };
      })
      .filter(
        (r) =>
          r.tenant &&
          (r.inputTokens > 0 ||
            r.outputTokens > 0 ||
            r.date),
      );

    return NextResponse.json({
      ok: true,
      rows: normalized,
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
