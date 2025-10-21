// cron.js  (CommonJS)
const cron = require('node-cron');
const mysql = require('mysql2/promise');

const TZ = 'America/La_Paz';
const CRON_EXPR = process.env.CRON_EXPR || '20 10 * * *'; // 10:05 La Paz (cambia a '6 10 * * *' para 10:06)

const BILLING_WEBHOOK   = process.env.BILLING_WEBHOOK   || 'https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a';
const MANAGEMENT_STATUS = process.env.MANAGEMENT_STATUS || 'TRIAL';
const MANAGEMENT_DATE   = process.env.MANAGEMENT_DATE   || '';
const COMPANY_NAME      = process.env.COMPANY_NAME      || 'Acme Inc.';
const COMPANY_KEY       = process.env.COMPANY_KEY       || 'default';
const DB_URL            = process.env.DATABASE_URL;

let pool = null;
async function getPool() {
  if (pool) return pool;
  if (!DB_URL) throw new Error('DATABASE_URL no definido');
  pool = await mysql.createPool(DB_URL);
  return pool;
}

// Helpers de fecha (zona America/La_Paz)
function localParts(tz, d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, dd] = f.format(d).split('-').map(Number);
  return { y, m, d: dd };
}
function localYmd(tz, d = new Date()) {
  const { y, m, d: dd } = localParts(tz, d);
  return `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
function isBeforeLocalDate(tz, compareYmd, d = new Date()) {
  if (!compareYmd) return false;
  const { y, m, d: dd } = localParts(tz, d);
  const [cy, cm, cd] = compareYmd.split('-').map(Number);
  if (y !== cy) return y < cy;
  if (m !== cm) return m < cm;
  return dd < cd;
}

// DB snapshot
async function getBillingSnapshot(companyKey) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const [[{ users }]]     = await conn.query(`SELECT COUNT(*) AS users FROM users WHERE company_key = ?`, [companyKey]);
    const [[{ clients }]]   = await conn.query(`SELECT COUNT(*) AS clients FROM clients WHERE company_key = ?`, [companyKey]);
    const [[{ providers }]] = await conn.query(`SELECT COUNT(*) AS providers FROM providers WHERE company_key = ?`, [companyKey]);
    const [[{ admins }]]    = await conn.query(`SELECT COUNT(*) AS admins FROM users WHERE company_key = ? AND role = 'admin'`, [companyKey]);
    const [[plan]]          = await conn.query(
      `SELECT rate_per_user FROM billing_plan WHERE company_key = ? ORDER BY updated_at DESC LIMIT 1`, [companyKey]
    );
    return {
      users: Number(users), clients: Number(clients),
      providers: Number(providers), admins: Number(admins),
      ratePerUser: Number(plan?.rate_per_user ?? 0),
    };
  } finally { conn.release(); }
}

// POST al webhook (usa fetch y FormData del runtime de Node 18+)
async function postInvoice({ description, quantity, rate, total, companyName, detail }) {
  const form = new FormData();
  form.set('DESCRIPTION', description);
  form.set('QUANTITY', String(quantity));
  form.set('RATE', String(rate));
  form.set('TOTAL', String(total));
  form.set('COMPANY_NAME', companyName);
  form.set('DETAIL', detail);

  const resp = await fetch(BILLING_WEBHOOK, { method: 'POST', body: form });
  const text = await resp.text();
  console.log('[billing-cron] POST n8n ->', resp.status, text.slice(0, 200));
  if (!resp.ok) throw new Error(`Webhook respondió ${resp.status}`);
}

// Job principal
async function runBilling() {
  const nowLP = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(new Date());
  console.log(`[billing-cron] runBilling iniciado @ ${nowLP} (${TZ})`);

  if (MANAGEMENT_DATE && isBeforeLocalDate(TZ, MANAGEMENT_DATE)) {
    console.log('[billing-cron] Antes de MANAGEMENT_DATE (hora La Paz), skip.');
    return;
  }

  const { users, clients, providers, admins, ratePerUser } = await getBillingSnapshot(COMPANY_KEY);
  const QUANTITY = users;
  const RATE     = ratePerUser;
  const TOTAL    = QUANTITY * RATE;
  const DETAIL   = `${clients} clientes, ${providers} proveedores, ${admins} admins`;
  const DESCRIPTION = `${localYmd(TZ)} — Scheduled Invoice Notification (${MANAGEMENT_STATUS})`;

  console.log('[billing-cron] Payload:', { QUANTITY, RATE, TOTAL, COMPANY_NAME, DETAIL: DETAIL.slice(0,100) });

  await postInvoice({
    description: DESCRIPTION,
    quantity: QUANTITY,
    rate: RATE,
    total: TOTAL,
    companyName: COMPANY_NAME,
    detail: DETAIL,
  });

  console.log('[billing-cron] runBilling OK');
}

// === Scheduler ===
console.log(`[billing-cron] Boot: TZ=${TZ} CRON="${CRON_EXPR}" nowUTC=${new Date().toISOString()}`);
if (!cron.validate(CRON_EXPR)) {
  console.error('[billing-cron] EXPRESIÓN CRON INVÁLIDA:', CRON_EXPR);
}

cron.schedule(CRON_EXPR, () => {
  console.log('[billing-cron] Tick detectado. Ejecutando runBilling()...');
  runBilling().catch(err => console.error('[billing-cron] Error en runBilling:', err?.stack || err));
}, { timezone: TZ });

console.log(`[billing-cron] Scheduler activo (${CRON_EXPR} ${TZ} daily).`);

// Exponer para pruebas manuales (docker exec …)
global.runBilling = runBilling;

// Shutdown limpio
async function shutdown(sig) {
  try { await pool?.end(); } catch {}
  finally { process.exit(0); }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// (Opcional) Forzar una corrida al boot para verificar end-to-end
if (process.env.FORCE_RUN_ON_BOOT === '1') {
  runBilling().catch(e => console.error('[billing-cron] boot-run ERROR:', e?.stack || e));
}
