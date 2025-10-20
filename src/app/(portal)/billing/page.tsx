// src/app/(portal)/billing/page.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BillingTable, type InvoiceLine, type BillingPagination } from '@/components/billing-table'

export default function BillingPage() {
  // ✅ Hooks dentro del componente
  const [invItems, setInvItems] = useState<InvoiceLine[]>([])
  const [invPagination, setInvPagination] = useState<BillingPagination>({
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  })

  const goToInvPage = (p: number) => {
    setInvPagination((s) => ({
      ...s,
      currentPage: p,
      hasPreviousPage: p > 1,
      hasNextPage: p < s.totalPages,
    }))
    // TODO: fetch página p cuando conectes backend
  }

  const changeInvPageSize = (size: number) => {
    setInvPagination((s) => ({
      ...s,
      pageSize: size,
      currentPage: 1,
      // TODO: recalcular totalPages tras fetch
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
      </CardHeader>
      <CardContent>
        <BillingTable
          items={invItems}
          loading={false}
          pagination={invPagination}
          onPageChange={goToInvPage}
          onPageSizeChange={changeInvPageSize}
        />
      </CardContent>
    </Card>
  )
}

