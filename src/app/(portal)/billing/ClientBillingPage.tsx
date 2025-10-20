// src/app/(portal)/billing/ClientBillingPage.tsx
'use client'

import { useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import BillingHeader, { Org } from './BillingHeader'
import TenantBillingCard from './TenantBillingCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BillingTable, type InvoiceLine, type BillingPagination } from '@/components/billing-table'
import { useState } from 'react'

export type CountRow = {
  tenantId: string; tenantName: string;
  users: number; clients: number; admins: number; providers: number;
  management?: { status: string; date: string }; error?: string;
}

export default function ClientBillingPage({
  orgs, counts, selectedClient,
}: { orgs: Org[]; counts: CountRow[]; selectedClient: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleSelectClient = (val: string) => {
    startTransition(() => {
      const params = new URLSearchParams(search.toString())
      if (!val || val === 'all') params.delete('client')
      else params.set('client', val)
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  const filtered = useMemo(
    () => (selectedClient === 'all' ? counts : counts.filter(c => c.tenantId === selectedClient)),
    [counts, selectedClient]
  )

  // Tabla (vacía por ahora)
  const [invItems] = useState<InvoiceLine[]>([])
  const [invPagination, setInvPagination] = useState<BillingPagination>({
    currentPage: 1, totalPages: 1, pageSize: 10, totalItems: 0, hasPreviousPage: false, hasNextPage: false,
  })

  return (
    <>
      <PageHeader title="Billing" description="Cobro por usuario activo + add-on de Chats">
        <BillingHeader orgs={orgs} selectedClient={selectedClient} onSelect={handleSelectClient} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(t => (
          <TenantBillingCard key={t.tenantId} tenant={t} onAdjust={(id) => console.log('adjust', id)} />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Invoice Lines (0)</CardTitle></CardHeader>
        <CardContent>
          <BillingTable
            items={invItems}
            loading={false}
            pagination={invPagination}
            onPageChange={(p) => setInvPagination(s => ({ ...s, currentPage: p, hasPreviousPage: p > 1, hasNextPage: p < s.totalPages }))}
            onPageSizeChange={(size) => setInvPagination(s => ({ ...s, pageSize: size, currentPage: 1 }))}
          />
        </CardContent>
      </Card>
    </>
  )
}
