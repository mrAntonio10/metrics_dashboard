import { NextResponse } from 'next/server';

const N8N_ANTHROPIC_USAGE_URL = 'https://n8n.uqminds.org/webhook/596bc3f6-651a-489b-b662-4f1033cd778c/get-anthropic-usage';

function toNumber(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    console.log(
      '[ANTHROPIC_USAGE][API] Fetching from n8n:',
      N8N_ANTHROPIC_USAGE_URL,
    );

    const res = await fetch(N8N_ANTHROPIC_USAGE_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    const rawText =
      (await res.text().catch(() => '')) || '';

    console.log(
      '[ANTHROPIC_USAGE][API] Raw response text:',
      rawText,
    );

    if (!res.ok) {
      console.error(
        '[ANTHROPIC_USAGE][API] HTTP error from n8n:',
        res.status,
      );
      return NextResponse.json(
        {
          ok: false,
          error: `Upstream HTTP ${res.status}`,
          raw: rawText,
        },
        { status: 502 },
      );
    }

    let json: any;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      console.error(
        '[ANTHROPIC_USAGE][API] JSON parse error:',
        e,
      );
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid JSON from n8n',
          raw: rawText,
        },
        { status: 500 },
      );
    }

    console.log(
      '[ANTHROPIC_USAGE][API] Parsed JSON:',
      JSON.stringify(json),
    );

    const arr: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    console.log(
      '[ANTHROPIC_USAGE][API] Detected rows length:',
      arr.length,
    );

    const rows = arr.map((r, index) => ({
      executionId:
        r.EXECUTION_ID ??
        r.executionId ??
        r.execution_id ??
        index + 1,
      tenant:
        r.TENANT ??
        r.tenant ??
        r.client ??
        r.company ??
        'unknown',
      inputTokens: toNumber(
        r.INPUT ??
          r.input ??
          r.inputTokens ??
          r.input_tokens,
      ),
      outputTokens: toNumber(
        r.OUTPUT ??
          r.output ??
          r.outputTokens ??
          r.output_tokens,
      ),
      date:
        r.DATE ??
        r.date ??
        r.timestamp ??
        '',
    }));

    console.log(
      '[ANTHROPIC_USAGE][API] Normalized rows:',
      rows,
    );

    return NextResponse.json({
      ok: true,
      rows,
    });
  } catch (e: any) {
    console.error(
      '[ANTHROPIC_USAGE][API] Unexpected error:',
      e,
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          e?.message ||
          'Failed to fetch Anthropic usage',
      },
      { status: 500 },
    );
  }
}
