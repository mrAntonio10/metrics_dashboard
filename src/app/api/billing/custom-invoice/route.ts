// src/app/api/billing/custom-invoice/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TENANTS_DIR = process.env.TENANTS_DIR || '/data/vivace-vivace-api';
const ENV_PREFIX = '.env.';

// 🔴 Ignora BILLING_WEBHOOK viejo si está mal configurado
// Asegúrate que este URL coincide EXACTO con el "Production URL" del Webhook node en n8n.
const BILLING_WEBHOOK =
  'https://n8n.uqminds.org/webhook/invoice/8face104-05ef-4944-b956-de775fbf389d';

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function findTenantEnv(tenantId: string) {
  const file = path.join(TENANTS_DIR, `${ENV_PREFIX}${tenantId}`);
  const content = await fs.readFile(file, 'utf8');
  const env = parseDotenv(content);

  const companyKey = env['COMPANY_KEY'] || tenantId;
  const companyName =
    env['COMPANY_NAME'] ||
    env['TENANT_NAME'] ||
    env['APP_TENANT_NAME'] ||
    tenantId;

  const invoiceEmailsRaw =
    env['EMAIL_FOR_INVOICE'] ||
    env['INVOICE_EMAIL'] ||
    env['BILLING_EMAIL'] ||
    '';

  const invoiceEmails = invoiceEmailsRaw
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    tenantId,
    companyKey,
    companyName,
    invoiceEmails,
  };
}

function esc(s: any) {
  return String(s ?? '').replace(/[&<>]/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!;
  });
}

function renderCustomHTML(opts: {
  companyName: string;
  description: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  paymentIntentId?: string;
}) {
  const {
    companyName,
    description,
    amount,
    currency,
    customerName,
    customerEmail,
    paymentIntentId,
  } = opts;

  const amt = amount.toFixed(2);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Custom Payment</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;color:#111827}
    .wrap{max-width:640px;margin:32px auto;padding:24px}
    .card{background:#ffffff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(15,23,42,0.06);padding:24px 24px 20px}
    h1{margin:0 0 4px;font-size:22px;font-weight:600;color:#111827}
    .sub{margin:0 0 16px;font-size:13px;color:#6b7280}
    .label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:4px}
    .value{font-size:14px;color:#111827;margin-bottom:10px}
    .amount{font-size:26px;font-weight:700;color:#111827;margin:10px 0 4px}
    .currency{font-size:11px;color:#9ca3af;text-transform:uppercase}
    .box{margin-top:14px;padding:10px 12px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;font-size:11px;color:#6b7280}
    .muted{margin-top:10px;font-size:10px;color:#9ca3af}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>${esc(companyName)} — Custom Payment</h1>
      <p class="sub">Payment confirmation summary</p>
      
      <div class="label">Description</div>
      <div class="value">${esc(description || 'Custom payment')}</div>

      <div class="label">Amount</div>
      <div class="amount">${esc(amt)} <span class="currency">${esc(currency)}</span></div>

      <div class="label">Billed to</div>
      <div class="value">${esc(customerName)} &lt;${esc(customerEmail)}&gt;</div>

      ${
        paymentIntentId
          ? `<div class="box">Stripe PaymentIntent ID: <strong>${esc(paymentIntentId)}</strong></div>`
          : ''
      }

      <p class="muted">
        This email confirms your custom payment. If you did not authorize this transaction or have questions, please reply directly to this message.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    if (!BILLING_WEBHOOK) {
      return NextResponse.json(
        { error: true, message: 'Missing BILLING_WEBHOOK' },
        { status: 500 },
      );
    }

    const body = await req.json();
    const {
      tenantId,
      amount,
      currency = 'USD',
      description,
      customerEmail,
      customerName,
      paymentIntentId,
    } = body || {};

    if (!tenantId || !amount || !customerEmail || !customerName) {
      return NextResponse.json(
        {
          error: true,
          message:
            'Missing required fields: tenantId, amount, customerEmail, customerName',
        },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: true, message: 'Invalid amount' },
        { status: 400 },
      );
    }

    let tenant;
    try {
      tenant = await findTenantEnv(tenantId);
    } catch (e: any) {
      console.error('Tenant env not found', e);
      return NextResponse.json(
        {
          error: true,
          message: `Tenant configuration not found for ${tenantId}`,
        },
        { status: 404 },
      );
    }

    const html = renderCustomHTML({
      companyName: tenant.companyName,
      description,
      amount: numericAmount,
      currency,
      customerEmail,
      customerName,
      paymentIntentId,
    });

    const buf = Buffer.from(html, 'utf8');
    const FILE_BASE64 = buf.toString('base64');
    const FILE_NAME = `custom-payment-${tenant.companyKey}-${Date.now()}.html`;
    const FILE_MIME = 'text/html';

    const DETAIL = `Custom payment for tenant=${tenant.tenantId}, PI=${paymentIntentId || 'n/a'}`;

    const TO_EMAIL =
      (tenant.invoiceEmails && tenant.invoiceEmails.join(',')) ||
      customerEmail;

    const recipients = (
      tenant.invoiceEmails?.length
        ? [...tenant.invoiceEmails, customerEmail]
        : [customerEmail]
    ).filter((v, i, arr) => arr.indexOf(v) === i);

    const payload = {
      DESCRIPTION: description || 'Custom payment',
      QUANTITY: 1,
      RATE: numericAmount,
      TOTAL: numericAmount,
      COMPANY_NAME: tenant.companyName,
      DETAIL,
      CURRENCY: currency,
      TO_EMAIL,
      recipients,
      EMAIL_HTML: html,
      FILE_BASE64,
      FILE_NAME,
      FILE_MIME,
    };

    const resp = await fetch(BILLING_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenant.tenantId,
        'x-company-key': tenant.companyKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();

    if (!resp.ok) {
      console.error('n8n webhook error', resp.status, text);
      return NextResponse.json(
        {
          error: true,
          status: resp.status,
          message: 'n8n webhook failed',
          body: text,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      tenantId: tenant.tenantId,
      status: resp.status,
    });
  } catch (error: any) {
    console.error('Error in /api/billing/custom-invoice', error);
    return NextResponse.json(
      {
        error: true,
        message: error?.message || 'Unexpected error',
      },
      { status: 500 },
    );
  }
}
