type CompanyKey = string; // lo que recibes del combo (ambiente/tenant)

export interface TenantCounts {
  clients: number;
  providers: number;
  admins: number;
  totalUsers: number; // normalmente = clients + providers + admins (+ otros roles si aplica)
}

export interface BuildInvoiceInput {
  company: CompanyKey;
  managementStatus: 'TRIAL' | 'ACTIVE' | string;
  managementDateIso: string; // env MANAGEMENT_DATE
  counts: TenantCounts;
  userRate: number; // costo por usuario
  runDateIso?: string; // opcional para pruebas
}

/** Texto en DETAIL, ej: "58 clients, 31 providers, 2 admins" */
export function detailString(c: TenantCounts): string {
  return `${c.clients} clients, ${c.providers} providers, ${c.admins} admins`;
}

/** Arma el objeto que espera tu n8n (en body.*) */
export function buildInvoiceBody(input: BuildInvoiceInput) {
  const runDate = input.runDateIso ?? todayUtcMinus4();
  const DESCRIPTION = `${runDate} - scheduled Invoice Notification`;
  const QUANTITY = input.counts.totalUsers;
  const RATE = input.userRate;
  const TOTAL = +(QUANTITY * RATE).toFixed(2);
  const COMPANY_NAME = input.company;
  const DETAIL = detailString(input.counts);

  return {
    body: { DESCRIPTION, QUANTITY, RATE, TOTAL, COMPANY_NAME, DETAIL }
  };
}

const N8N_WEBHOOK = 'https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a';

export async function postInvoiceToN8N(payload: ReturnType<typeof buildInvoiceBody>) {
  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`n8n error ${res.status}: ${text}`);
  }
  return text;
}

// ===== Helpers de fecha (copiados del módulo date.ts si prefieres no importar) =====
function todayUtcMinus4(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 4 * 60 * 60000).toISOString().slice(0, 10);
}
