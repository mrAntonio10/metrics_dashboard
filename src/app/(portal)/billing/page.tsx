// src/app/(portal)/billing/page.tsx
import { loadTenants, getTenantCounts } from '@/lib/tenants';
import type { Org, CountRow } from './types';
import ClientBillingPage from './ClientBillingPage';

export const dynamic = 'force-dynamic';

function resolveSelectedClient(param: unknown): string {
  if (Array.isArray(param)) return param[0] ?? 'all';
  if (typeof param !== 'string' || !param.trim()) return 'all';
  return param.trim(); // keep original casing to match tenant IDs exactly
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tenants = await loadTenants();
  const countsRaw = await Promise.all(tenants.map(getTenantCounts));

  const orgs: Org[] = tenants.map((t) => ({ id: t.id, name: t.name }));

  const counts: CountRow[] = countsRaw.map((c) => ({
    tenantId: c.tenantId,
    tenantName: c.tenantName,
    users: c.users,
    clients: c.clients,
    admins: c.admins,
    providers: c.providers,
    management: c.management,
    error: c.error,
  }));

  const selectedClient = resolveSelectedClient(searchParams?.client);

  return <ClientBillingPage orgs={orgs} counts={counts} selectedClient={selectedClient} />;
}