import { BillingTable, type InvoiceLine, type BillingPagination } from '@/components/billing-table'
import { useState } from 'react'

// estado local (vacío por ahora)
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
  setInvPagination(s => ({
    ...s,
    currentPage: p,
    hasPreviousPage: p > 1,
    hasNextPage: p < s.totalPages,
  }))
  // TODO: fetch de esa página cuando tengas backend
}

const changeInvPageSize = (size: number) => {
  setInvPagination(s => ({
    ...s,
    pageSize: size,
    currentPage: 1,
    // TODO: recalcular totalPages al traer datos del backend
  }))
}

// dentro del render:
<BillingTable
  items={invItems}
  loading={false}
  pagination={invPagination}
  onPageChange={goToInvPage}
  onPageSizeChange={changeInvPageSize}
/>
