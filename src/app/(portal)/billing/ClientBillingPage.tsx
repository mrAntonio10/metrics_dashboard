// src/app/(portal)/billing/ClientBillingPage.tsx
'use client'

import { useMemo, useTransition, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import BillingHeader, { Org } from './BillingHeader'
import TenantBillingCard from './TenantBillingCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BillingTable, type InvoiceLine, type BillingPagination } from '@/components/billing-table'

export type CountRow = {
  tenantId: string; tenantName: string;
  users: number; clients: number; admins: number; providers: number;
  management?: { status: string; date: string }; error?: string;
}

const N8N_INVOICES_ENDPOINT =
  process.env.NEXT_PUBLIC_BILLING_API ||
  'https://n8n.uqminds.org/webhook/invoices/list';

export default function ClientBillingPage({
  orgs, counts, selectedClient,
}: { orgs: Org[]; counts: CountRow[]; selectedClient: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // cliente -> ?client=
  const handleSelectClient = (val: string) => {
    startTransition(() => {
      const params = new URLSearchParams(search.toString())
      if (!val || val === 'all') params.delete('client')
      else params.set('client', val)
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  // nombre legible para COMPANY
  const selectedCompanyName = useMemo(() => {
    if (selectedClient === 'all') return ''
    return counts.find(c => c.tenantId === selectedClient)?.tenantName || ''
  }, [counts, selectedClient])

  // cards
  const filtered = useMemo(
    () => (selectedClient === 'all' ? counts : counts.filter(c => c.tenantId === selectedClient)),
    [counts, selectedClient]
  )

  // ====== fecha exacta ======
  // '' => sin filtrar; 'YYYY-MM-DD' => filtrar ese día
  const [selectedDate, setSelectedDate] = useState<string>('')

  const [invItems, setInvItems] = useState<InvoiceLine[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [invPagination, setInvPagination] = useState<BillingPagination>({
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  })

  // fetch invoices
  useEffect(() => {
    const abort = new AbortController()
    const load = async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const params = new URLSearchParams()
        if (selectedCompanyName) params.set('company', selectedCompanyName)
        if (selectedDate) params.set('date', selectedDate)    // YYYY-MM-DD directo
        params.set('page', String(invPagination.currentPage))
        params.set('pageSize', String(invPagination.pageSize))

        const url = `${N8N_INVOICES_ENDPOINT}?${params.toString()}`
        const res = await fetch(url, { signal: abort.signal, cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()

        const rows = (json?.data?.invoices ?? []) as Array<any>
        const mapped: InvoiceLine[] = rows.map((r: any, idx: number) => ({
          id: `${r.DESCRIPTION ?? ''}-${idx}`,
          description: String(r.DESCRIPTION ?? ''),
          quantity: Number(r.QUANTITY ?? 0),
          rate: Number(r.RATE ?? 0),
          total: Number(r.TOTAL ?? 0),
          companyName: String(r.COMPANY_NAME ?? ''),
          detail: String(r.DETAIL ?? ''),
        }))

        const p = json?.data?.pagination ?? {}
        setInvItems(mapped)
        setInvPagination({
          currentPage: Number(p.currentPage ?? 1),
          pageSize: Number(p.pageSize ?? 10),
          totalItems: Number(p.totalItems ?? mapped.length),
          totalPages: Math.max(1, Number(p.totalPages ?? 1)),
          hasNextPage: Boolean(p.hasNextPage ?? false),
          hasPreviousPage: Boolean(p.hasPreviousPage ?? false),
        })
      } catch (err: any) {
        if (err?.name !== 'AbortError') setErrorMsg(err?.message || 'Error loading invoices')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => abort.abort()
  }, [selectedCompanyName, selectedDate, invPagination.currentPage, invPagination.pageSize])

  const onPageChange = (p: number) => {
    setInvPagination(prev => ({
      ...prev,
      currentPage: p,
      hasPreviousPage: p > 1,
      hasNextPage: p < prev.totalPages,
    }))
  }
  const onPageSizeChange = (size: number) => {
    setInvPagination(prev => ({
      ...prev,
      pageSize: size,
      currentPage: 1,
    }))
  }

  return (
    <>
      <PageHeader title="Billing" description="Cobro por usuario activo + add-on de Chats">
        <BillingHeader
          orgs={orgs}
          selectedClient={selectedClient}
          onSelect={handleSelectClient}
          selectedDate={selectedDate}
          onDateChange={(d) => { setSelectedDate(d); setInvPagination(s => ({ ...s, currentPage: 1 })) }}
          onClearFilters={() => { setSelectedDate(''); setInvPagination(s => ({ ...s, currentPage: 1 })) }}
        />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(t => (
          <TenantBillingCard key={t.tenantId} tenant={t} onAdjust={(id) => console.log('adjust', id)} />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            Invoice Lines ({invPagination.totalItems})
            {errorMsg ? <span className="ml-2 text-red-600 text-sm">· {errorMsg}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BillingTable
            items={invItems}
            loading={loading}
            pagination={invPagination}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </>
  )
}
