import { NextResponse } from 'next/server';
import AWS from 'aws-sdk';

export const runtime = 'nodejs'; // aseguramos Node.js

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.warn(
    '[AWS][Billing] Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in env',
  );
}

// Cost Explorer es global pero se usa vía us-east-1
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId,
  secretAccessKey,
});

type BillingServiceCost = {
  service: string;
  amount: number;
  unit: string;
};

type BillingOkPayload = {
  ok: true;
  start: string;
  end: string;
  totalUsd: number;
  currency: string;
  topServices: BillingServiceCost[];
  allServices: BillingServiceCost[];
};

type BillingErrorPayload = {
  ok: false;
  error: string;
};

const formatDate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Rango: últimos 30 días (End exclusivo, como requiere Cost Explorer).
 * Ej: si hoy es 2025-11-10 -> Start=2025-10-11, End=2025-11-10
 */
const getLast30DaysRange = () => {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);

  return {
    Start: formatDate(start),
    End: formatDate(end),
  };
};

export async function GET() {
  try {
    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json<BillingErrorPayload>(
        {
          ok: false,
          error:
            'Missing AWS credentials in environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)',
        },
        { status: 500 },
      );
    }

    const ce = new AWS.CostExplorer({ region: 'us-east-1' });

    const { Start, End } = getLast30DaysRange();

    const params: AWS.CostExplorer.GetCostAndUsageRequest = {
      TimePeriod: {
        Start,
        End,
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    };

    const result = await ce.getCostAndUsage(params).promise();

    const groups = result.ResultsByTime?.[0]?.Groups ?? [];

    const services: BillingServiceCost[] = groups.map((g) => {
      const service = g.Keys?.[0] || 'Other / Unknown';
      const metric = g.Metrics?.UnblendedCost;
      const amount = metric?.Amount ? parseFloat(metric.Amount) : 0;
      const unit = metric?.Unit || 'USD';
      return { service, amount, unit };
    });

    services.sort((a, b) => b.amount - a.amount);

    const totalUsd = services.reduce((sum, s) => sum + s.amount, 0);
    const currency = services[0]?.unit || 'USD';

    const payload: BillingOkPayload = {
      ok: true,
      start: Start,
      end: End,
      totalUsd: Number(totalUsd.toFixed(2)),
      currency,
      topServices: services.slice(0, 10),
      allServices: services,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const err = error as Error;
    console.error('[AWS][Billing] Error consultando Cost Explorer:', err.message, err.stack);

    return NextResponse.json<BillingErrorPayload>(
      {
        ok: false,
        error: err.message || 'Error consultando AWS Cost Explorer',
      },
      { status: 500 },
    );
  }
}
