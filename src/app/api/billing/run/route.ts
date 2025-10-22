// src/app/api/billing/run/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import mysql, { RowDataPacket, Pool, Connection } from 'mysql2/promise';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =========================
   Config
   ========================= */
const BILLING_WEBHOOK =
  process.env.BILLING_WEBHOOK?.trim() ||
  'https://n8n.uqminds.org/webhook/invoice/8face104-05ef-4944-b956-de775fbf389d';

const TENANTS_DIR = process.env.TENANTS_DIR || '/data/vivace-vivace-api';
const ENV_PREFIX = '.env.';
const DB_URL = (process.env.DATABASE_URL || '').trim();
const TZ = 'America/La_Paz';

// Quantity strategy: SUM | USERS | USERS_OR_SUM
const BILLING_QUANTITY_STRATEGY = (process.env.BILLING_QUANTITY_STRATEGY || 'SUM')
  .toUpperCase() as 'SUM' | 'USERS' | 'USERS_OR_SUM';

// Default attachment type: pdf | png | none (can be overridden by ?attach=)
const BILLING_ATTACH_DEFAULT = (process.env.BILLING_ATTACH || 'pdf')
  .toLowerCase() as 'pdf' | 'png' | 'none';

/* =========================
   Date helpers (La Paz)
   ========================= */
function todayLocalParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, dd] = f.format(d).split('-').map(Number);
  return { y, m, d: dd };
}
function todayLocalYMDString() {
  const t = todayLocalParts();
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
}
function parseYMD(s?: string) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
function lastDayOfMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function cmpYMD(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}
/** Due today if (1) anchor exists, (2) today >= anchor, (3) day = min(anchor.d, end of month) */
function dueTodayMonthly(anchorYmd?: string) {
  const anchor = parseYMD(anchorYmd);
  if (!anchor) return false;
  const today = todayLocalParts();
  if (cmpYMD(today, anchor) < 0) return false;
  const sched = Math.min(anchor.d, lastDayOfMonth(today.y, today.m));
  return today.d === sched;
}

/* =========================
   .env.* helpers
   ========================= */
function trim(s: string) {
  return s.replace(/^\s+|\s+$/g, '');
}
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = trim(raw);
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = trim(line.slice(0, i));
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}
async function listEnvFiles(dir: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.startsWith(ENV_PREFIX) && e.name.length > ENV_PREFIX.length)
      .map((e) => path.join(dir, e.name));
  } catch (e: any) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }
}
function normalizeEmails(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/* =========================
   Types
   ========================= */
type Tenant = {
  tenantId: string;
  companyKey: string;
  companyName: string;
  managementStatus: string;
  managementDate: string;
  envFile: string;
  db: { host: string; port: number; database: string; user: string; password: string };
  tables: { users: string; clients: string; providers: string };
  ratePerUser?: number;
  invoiceEmails: string[];
  appName: string;
  currency: string; // always 'USD' here
};
type Counts = { users: number; clients: number; providers: number; admins: number };

type AttachDebug = {
  wanted: 'pdf' | 'png' | 'none';
  tried: boolean;
  ok: boolean;
  bytes?: number;
  name?: string;
  mime?: string;
  error?: string;
  fallback?: 'html';
};

type N8nPayload = {
  DESCRIPTION: string;
  QUANTITY: number;
  RATE: number;
  TOTAL: number;
  COMPANY_NAME: string;
  DETAIL: string;
  CURRENCY?: string;
  TO_EMAIL?: string;
  recipients?: string[];
  EMAIL_HTML?: string;
  FILE_BASE64?: string;
  FILE_NAME?: string;
  FILE_MIME?: string;
  ATTACH_DEBUG?: AttachDebug;
};

type Result =
  | {
      tenantId: string;
      status: number;
      ok: true;
      reason?: string;
      qty?: number;
      rate?: number;
      total?: number;
      to?: string[];
      attachInfo?: { ok: boolean; bytes?: number; name?: string; mime?: string; error?: string };
    }
  | { tenantId: string; status: number; ok: false; error: string; attachInfo?: any };

/* =========================
   Read .env.{tenant}
   ========================= */
async function readTenantEnv(file: string): Promise<Tenant> {
  const base = path.basename(file);
  const tenantId = base.slice(ENV_PREFIX.length);
  const env = parseDotenv(await fs.readFile(file, 'utf8'));

  const companyKey = env['COMPANY_KEY'] || tenantId;
  const companyName = env['COMPANY_NAME'] || env['TENANT_NAME'] || env['APP_TENANT_NAME'] || tenantId;
  const managementStatus = (env['MANAGEMENT_STATUS'] || '').toUpperCase();
  const managementDate = env['MANAGEMENT_DATE'] || '';

  const host = env['DB_HOST'];
  const port = Number(env['DB_PORT'] || 3306);
  const database = env['DB_DATABASE'];
  const user = env['DB_USERNAME'];
  const password = env['DB_PASSWORD'];
  const usersTable = env['USERS_TABLE'] || 'users';
  const clientsTable = env['CLIENTS_TABLE'] || 'clients';
  const providersTable = env['PROVIDERS_TABLE'] || 'providers';

  const ratePerUser =
    env['RATE_PER_USER'] ? Number(env['RATE_PER_USER']) : env['USER_PRICE'] ? Number(env['USER_PRICE']) : undefined;

  const invoiceEmails =
    normalizeEmails(env['EMAIL_FOR_INVOICE']) ||
    normalizeEmails(env['INVOICE_EMAIL']) ||
    normalizeEmails(env['BILLING_EMAIL']);

  const appName = env['APP_NAME'] || companyName;

  // Force USD end-to-end (HTML, PDF/PNG, and webhook payload)
  const currency = 'USD';

  return {
    tenantId,
    companyKey,
    companyName,
    managementStatus,
    managementDate,
    envFile: file,
    db: { host: host || '', port, database: database || '', user: user || '', password: password || '' },
    tables: { users: usersTable, clients: clientsTable, providers: providersTable },
    ratePerUser,
    invoiceEmails,
    appName,
    currency,
  };
}

/* =========================
   DB helpers per tenant
   ========================= */
function isSoftDbError(e: any) {
  const code = String(e?.code || '');
  const msg = String(e?.message || e || '');
  return (
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|ER_ACCESS_DENIED|ER_DBACCESS/i.test(code) ||
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|connect|handshake|tenant-db-missing-params/i.test(msg)
  );
}

async function getCountsPerTenant(t: Tenant): Promise<Counts> {
  let conn: Connection | null = null;
  let users = 0,
    clients = 0,
    providers = 0,
    admins = 0;
  try {
    if (!t.db.host || !t.db.database || !t.db.user) throw new Error('tenant-db-missing-params');
    conn = await mysql.createConnection({
      host: t.db.host,
      port: t.db.port,
      database: t.db.database,
      user: t.db.user,
      password: t.db.password,
      connectTimeout: 6000,
    });

    const [cRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.tables.clients}\``);
    clients = Number((cRows as any)[0]?.c || 0);

    try {
      const [pRows] = await conn.query(
        `SELECT type, COUNT(*) AS c FROM \`${t.tables.providers}\` GROUP BY type`,
      );
      const map = new Map<string, number>();
      (pRows as any[]).forEach((r) => map.set(String(r.type).toLowerCase(), Number(r.c)));
      admins = map.get('admin') || 0;
      providers = map.get('provider') || 0;
    } catch {
      // keep 0/0 if table/column missing
    }

    try {
      const [uRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.tables.users}\``);
      users = Number((uRows as any)[0]?.c || 0);
    } catch {
      // fallback if users table missing
      users = clients + admins + providers;
    }
    return { users, clients, providers, admins };
  } finally {
    try {
      await conn?.end();
    } catch {}
  }
}

let planPool: Pool | null = null;
async function getRatePerUser(t: Tenant): Promise<number> {
  // Prefer per-tenant rate if present
  if (typeof t.ratePerUser === 'number' && !Number.isNaN(t.ratePerUser)) return Number(t.ratePerUser);

  // Optional global plan DB fallback
  if (!DB_URL || /@host[:/]/i.test(DB_URL)) return 0;
  try {
    if (!planPool) planPool = await mysql.createPool(DB_URL);
    const [rows] = await planPool.execute<RowDataPacket[]>(
      'SELECT rate_per_user FROM billing_plan WHERE company_key = ? ORDER BY updated_at DESC LIMIT 1',
      [t.companyKey],
    );
    return Number((rows as any)[0]?.rate_per_user ?? 0);
  } catch {
    return 0;
  }
}

/* =========================
   Invoice HTML (email-safe)
   ========================= */
function esc(s: any) {
  const str = String(s ?? '');
  return str.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}
function fmtMoney(v: number, currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v);
  } catch {
    return `${currency} ${Number(v || 0).toFixed(2)}`;
  }
}
function fmtNumber(v: number, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v);
  } catch {
    return String(v);
  }
}
function renderInvoiceHTML(opts: {
  appName: string;
  description: string;
  quantity: number;
  rate: number;
  total: number;
  companyName: string;
  detail: string;
  currency: string;
  issuedAt: string;
}) {
  const { appName, description, quantity, rate, total, companyName, detail, currency, issuedAt } = opts;
  const qtyStr = fmtNumber(quantity);
  const rateStr = fmtMoney(rate, currency);
  const totalStr = fmtMoney(total, currency);
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Invoice</title>
<style>
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
.wrap{max-width:720px;margin:0 auto;padding:24px}
.card{border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.hdr{padding:28px;border-bottom:1px solid #f1f5f9;text-align:center}
h1{margin:0;font-size:28px;line-height:1.2}
.desc{margin:8px 0 0 0;color:#334155;font-size:16px}
.sub{margin:6px 0 0 0;color:#64748b;font-size:12px}
.cnt{padding:24px}
table{width:100%;border-collapse:separate;border-spacing:0}
thead th{background:#f8fafc;color:#64748b;text-transform:uppercase;font-size:12px;letter-spacing:.04em;text-align:left;padding:10px}
tbody td{border-top:1px solid #f1f5f9;padding:12px;color:#111;font-size:14px;vertical-align:top}
.total{font-weight:600}
.stripe{margin-top:16px;background:#f8fafc;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.stripe .l{color:#475569;font-size:13px}
.stripe .r{font-weight:700}
.foot{margin-top:12px;color:#64748b;font-size:12px}
@media (max-width: 640px){
  .wrap{padding:16px}.hdr{padding:20px}h1{font-size:22px}.desc{font-size:15px}
  thead{display:none}table,tbody,tr,td{display:block;width:100%}tbody td{border-top:0;padding:8px 0}tbody td+td{border-top:1px solid #f1f5f9}
}
</style></head>
<body>
<div class="wrap"><div class="card">
  <div class="hdr">
    <h1>${esc(appName)}</h1>
    <p class="desc">${esc(description)}</p>
    <p class="sub">Issued on ${esc(issuedAt)}</p>
  </div>
  <div class="cnt">
    <table role="presentation" aria-hidden="true">
      <thead><tr><th>Quantity</th><th>Rate</th><th>Total</th><th>Company Name</th><th>Detail</th></tr></thead>
      <tbody><tr>
        <td>${esc(qtyStr)}</td><td>${esc(rateStr)}</td><td class="total">${esc(totalStr)}</td>
        <td>${esc(companyName)}</td><td>${esc(detail)}</td>
      </tr></tbody>
    </table>
    <div class="stripe">
      <div class="l"><strong>Subtotal</strong> • ${esc(qtyStr)} units × ${esc(rateStr)}</div>
      <div class="r">${esc(totalStr)}</div>
    </div>
    <p class="foot">This summary shows the charge details for your system usage. If you have any questions, please reply to this email.</p>
  </div>
</div></div>
</body></html>`;
}

/* =========================
   HTML -> PDF/PNG (Puppeteer)
   ========================= */
let browserPromise: Promise<puppeteer.Browser> | null = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}
async function htmlToPDF(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buf = await page.pdf({ format: 'A4', printBackground: true });
  await page.close();
  return buf;
}
async function htmlToPNG(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buf = await page.screenshot({ type: 'png', fullPage: true });
  await page.close();
  return buf;
}

/* =========================
   Business helpers
   ========================= */
function computeQuantity(s: Counts) {
  switch (BILLING_QUANTITY_STRATEGY) {
    case 'USERS':
      return s.users;
    case 'USERS_OR_SUM':
      return s.users > 0 ? s.users : s.clients + s.providers + s.admins;
    case 'SUM':
    default:
      return s.clients + s.providers + s.admins;
  }
}

/* =========================
   POST handler
   ========================= */
async function postToN8N(payload: N8nPayload, tenantId: string, companyKey: string) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 15000);
  try {
    const resp = await fetch(BILLING_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
        'x-company-key': companyKey,
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, text };
  } finally {
    clearTimeout(to);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!BILLING_WEBHOOK) return new Response('Missing BILLING_WEBHOOK', { status: 500 });

    const url = new URL(req.url);
    const onlyTenant = url.searchParams.get('tenant')?.trim();
    const force = url.searchParams.get('force') === '1';
    const sendZero = url.searchParams.get('sendZero') === '1';
    const attach = (url.searchParams.get('attach') || BILLING_ATTACH_DEFAULT) as 'pdf' | 'png' | 'none';
    // Optional currency override (e.g., ?currency=USD)
    const qCurrency = url.searchParams.get('currency')?.toUpperCase();

    const host = os.hostname();
    const todayStr = todayLocalYMDString();

    // Discover tenants
    let files = await listEnvFiles(TENANTS_DIR);
    if (onlyTenant) {
      const expected = `.env.${onlyTenant}`;
      files = files.filter((f) => path.basename(f) === expected);
    }
    const tenants: Tenant[] = [];
    for (const f of files) tenants.push(await readTenantEnv(f));

    const results: Result[] = [];

    for (const t of tenants) {
      // (A) date gating
      if (!t.managementDate && !force) {
        results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-management-date' });
        continue;
      }
      if (!force && !dueTodayMonthly(t.managementDate)) {
        results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'not-due-today' });
        continue;
      }

      // (B) snapshot
      let snap: Counts;
      try {
        snap = await getCountsPerTenant(t);
      } catch (e: any) {
        const tag = isSoftDbError(e)
          ? `db-skip:${e?.code || e?.message || 'unknown'}`
          : `skip:${e?.message || 'unknown'}`;
        results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: tag });
        continue;
      }

      // (C) pricing
      const RATE = await getRatePerUser(t);
      const QUANTITY = computeQuantity(snap);
      const TOTAL = Number((QUANTITY * RATE).toFixed(2));

      if (!sendZero && (Number.isNaN(RATE) || RATE <= 0)) {
        results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-rate' });
        continue;
      }
      if (!sendZero && (Number.isNaN(QUANTITY) || QUANTITY <= 0)) {
        results.push({ tenantId: t.tenantId, status: 204, ok: true, reason: 'no-users' });
        continue;
      }

      // (D) HTML body
      const DESCRIPTION = `${todayStr} — Scheduled Invoice (${t.managementStatus || 'N/A'})`;
      const DETAIL = `${snap.clients} clients, ${snap.providers} providers, ${snap.admins} admins — host=${host} envFile=${t.envFile}`;

      const effectiveCurrency = qCurrency || t.currency; // t.currency is 'USD' by default

      const EMAIL_HTML = renderInvoiceHTML({
        appName: t.appName,
        description: DESCRIPTION,
        quantity: QUANTITY,
        rate: RATE,
        total: TOTAL,
        companyName: t.companyName,
        detail: DETAIL,
        currency: effectiveCurrency,
        issuedAt: todayStr,
      });

      // (E) Attachment (try pdf/png; fallback to .html) — ALWAYS send a file
      let FILE_BASE64: string | undefined;
      let FILE_NAME: string | undefined;
      let FILE_MIME: string | undefined;
      const ATTACH_DEBUG: AttachDebug = { wanted: attach, tried: false, ok: false };

      try {
        if (attach === 'pdf') {
          ATTACH_DEBUG.tried = true;
          const buf = await htmlToPDF(EMAIL_HTML);
          FILE_BASE64 = buf.toString('base64');
          FILE_NAME = `invoice-${t.companyKey}-${todayStr}.pdf`;
          FILE_MIME = 'application/pdf';
          ATTACH_DEBUG.ok = true;
          ATTACH_DEBUG.bytes = buf.length;
          ATTACH_DEBUG.name = FILE_NAME;
          ATTACH_DEBUG.mime = FILE_MIME;
        } else if (attach === 'png') {
          ATTACH_DEBUG.tried = true;
          const buf = await htmlToPNG(EMAIL_HTML);
          FILE_BASE64 = buf.toString('base64');
          FILE_NAME = `invoice-${t.companyKey}-${todayStr}.png`;
          FILE_MIME = 'image/png';
          ATTACH_DEBUG.ok = true;
          ATTACH_DEBUG.bytes = buf.length;
          ATTACH_DEBUG.name = FILE_NAME;
          ATTACH_DEBUG.mime = FILE_MIME;
        }
      } catch (e: any) {
        ATTACH_DEBUG.ok = false;
        ATTACH_DEBUG.error = String(e?.message || e);
      }

      // Fallback to .html if PDF/PNG wasn't produced for any reason
      if (!FILE_BASE64) {
        const htmlBuf = Buffer.from(EMAIL_HTML, 'utf8');
        FILE_BASE64 = htmlBuf.toString('base64');
        FILE_NAME = `invoice-${t.companyKey}-${todayStr}.html`;
        FILE_MIME = 'text/html';
        ATTACH_DEBUG.fallback = 'html';
        ATTACH_DEBUG.ok = true;
        ATTACH_DEBUG.bytes = htmlBuf.length;
        ATTACH_DEBUG.name = FILE_NAME;
        ATTACH_DEBUG.mime = FILE_MIME;
      }

      // Build attachInfo summary for API response
      const attachInfo = {
        ok: ATTACH_DEBUG.ok,
        bytes: ATTACH_DEBUG.bytes,
        name: ATTACH_DEBUG.name,
        mime: ATTACH_DEBUG.mime,
        error: ATTACH_DEBUG.error,
      };

      // (F) recipients
      const toEmailStr = t.invoiceEmails.join(',') || '';
      const recipientsArr = t.invoiceEmails.length ? t.invoiceEmails : undefined;

      // (G) Send to n8n
      try {
        const resp = await postToN8N(
          {
            DESCRIPTION,
            QUANTITY,
            RATE,
            TOTAL,
            COMPANY_NAME: t.companyName,
            DETAIL,
            CURRENCY: effectiveCurrency,
            TO_EMAIL: toEmailStr || undefined,
            recipients: recipientsArr,
            EMAIL_HTML,
            FILE_BASE64,
            FILE_NAME,
            FILE_MIME,
            ATTACH_DEBUG, // diagnostic info for n8n
          },
          t.tenantId,
          t.companyKey,
        );

        if (resp.ok) {
          results.push({
            tenantId: t.tenantId,
            status: resp.status,
            ok: true,
            qty: QUANTITY,
            rate: RATE,
            total: TOTAL,
            to: t.invoiceEmails,
            attachInfo,
          });
        } else {
          results.push({
            tenantId: t.tenantId,
            status: resp.status,
            ok: false,
            error: resp.text || 'unknown',
            attachInfo,
          });
        }
      } catch (e: any) {
        results.push({
          tenantId: t.tenantId,
          status: 204,
          ok: true,
          reason: `webhook-skip:${e?.message || 'unknown'}`,
          attachInfo,
        } as any);
      }
    }

    const payload = {
      ok: true,
      sent: results.length,
      results,
      webhookUsed: BILLING_WEBHOOK,
      quantityStrategy: BILLING_QUANTITY_STRATEGY,
      attach,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(`Internal Error: ${e.message}`, { status: 500 });
  }
}
