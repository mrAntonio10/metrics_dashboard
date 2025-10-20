// cron.js (Miami == Bolivia UTC-4 fijo usando America/La_Paz)
import cron from 'node-cron';
import mysql from 'mysql2/promise';

const TZ = 'America/La_Paz'; // UTC-4 sin DST
const BILLING_WEBHOOK   = process.env.BILLING_WEBHOOK || 'https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a';
const MANAGEMENT_STATUS = process.env.MANAGEMENT_STATUS || 'TRIAL';
const MANAGEMENT_DATE   = process.env.MANAGEMENT_DATE   || '';        // 'YYYY-MM-DD' interpretado en America/La_Paz
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

// -------- helpers de fecha en zona horaria fija (America/La_Paz) --------
function localParts(tz, d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, dd] = f.format(d).split('-').map(Number);
  return { y, m, d: dd };
}
function localYmd(tz, d = new Date()) {
  const { y, m, d: dd } = localParts(tz, d);
  return `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
function isLastDayOfMonthLocal(tz, d = new Date()) {
  const { y, m, d: dd } = localParts(tz, d);
  const daysInMonth = new Date(y, m, 0).getDate(); // maneja bisiestos
  return dd === daysInMonth;
}
function isBeforeLocalDate(tz, compareYmd, d = new Date()) {
  if (!compareYmd) return false;
  const { y, m, d: dd } = localParts(tz, d);
  const [cy, cm, cd] = compareYmd.split('-').map(Number);
  if (y !== cy) return y < cy;
  if (m !== cm) return m < cm;
  return dd < cd;
}

// ---------------- DB snapshot ----------------
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

// ---------------- POST al webhook ----------------
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

// ---------------- job principal ----------------
async function runBilling() {
  // Todo basado en hora local de La Paz (UTC-4 fijo)
  if (MANAGEMENT_DATE && isBeforeLocalDate(TZ, MANAGEMENT_DATE)) {
    console.log('[billing-cron] Antes de MANAGEMENT_DATE (hora La Paz), skip.');
    return;
  }
  if (!isLastDayOfMonthLocal(TZ)) {
    console.log('[billing-cron] No es último día (hora La Paz), skip.');
    return;
  }

  const { users, clients, providers, admins, ratePerUser } = await getBillingSnapshot(COMPANY_KEY);
  const QUANTITY = users;
  const RATE     = ratePerUser;
  const TOTAL    = QUANTITY * RATE;
  const DETAIL   = `${clients} clientes, ${providers} proveedores, ${admins} admins`;
  const DESCRIPTION = `${localYmd(TZ)} — Scheduled Invoice Notification (${MANAGEMENT_STATUS})`;

  await postInvoice({
    description: DESCRIPTION,
    quantity: QUANTITY,
    rate: RATE,
    total: TOTAL,
    companyName: COMPANY_NAME,
    detail: DETAIL,
  });
}

// Programa el cron a las **21:00** hora de La Paz, todos los días.
cron.schedule('0 21 * * *', () => {
  runBilling().catch(err => console.error('[billing-cron] Error:', err.message));
}, { timezone: TZ });

console.log(`[billing-cron] Scheduler activo (21:00 ${TZ} daily).`);

process.on('SIGTERM', async () => { try { await pool?.end(); } finally { process.exit(0); } });
process.on('SIGINT',  async () => { try { await pool?.end(); } finally { process.exit(0); } });

export {};
