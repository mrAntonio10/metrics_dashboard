// src/app/(portal)/billing/page.tsx
import { loadTenants, getTenantCounts } from '@/lib/tenants'
import type { Org, CountRow } from './types'
import ClientBillingPage from './ClientBillingPage'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams?: { client?: string } }) {
  const tenants = await loadTenants()
  const countsRaw = await Promise.all(tenants.map(getTenantCounts))

  const orgs: Org[] = tenants.map(t => ({ id: t.id, name: t.name }))
  const counts: CountRow[] = countsRaw.map(c => ({
    tenantId: c.tenantId, tenantName: c.tenantName,
    users: c.users, clients: c.clients, admins: c.admins, providers: c.providers,
    management: c.management, error: c.error,
  }))

  const selectedClient = (searchParams?.client || 'all').toLowerCase()
  return <ClientBillingPage orgs={orgs} counts={counts} selectedClient={selectedClient} />
}
