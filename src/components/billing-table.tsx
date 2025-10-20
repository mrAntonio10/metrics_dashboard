// components/billing-table.tsx
import React from 'react'

export type InvoiceLine = {
  id: string
  description: string
  companyName: string   // <- ya lo tienes en el tipo
  quantity: number
  rate: number
  total: number
  detail?: string
}

export type BillingPagination = {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export function BillingTable({
  items,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  items: InvoiceLine[]
  loading: boolean
  pagination: BillingPagination
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left border-b">
          <tr className="text-gray-500">
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4">Company</th> {/* <-- NUEVA COLUMNA */}
            <th className="py-2 pr-4">Quantity</th>
            <th className="py-2 pr-4">Rate</th>
            <th className="py-2 pr-4">Total</th>
            <th className="py-2 pr-4">Detail</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td className="py-4 text-gray-500" colSpan={6}>Loading…</td></tr>
          ) : items.length === 0 ? (
            <tr><td className="py-4 text-gray-500" colSpan={6}>No invoices</td></tr>
          ) : (
            items.map(row => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{row.description}</td>
                <td className="py-2 pr-4">{row.companyName}</td> {/* <-- AQUÍ SE MUESTRA */}
                <td className="py-2 pr-4">{row.quantity}</td>
                <td className="py-2 pr-4">{row.rate}</td>
                <td className="py-2 pr-4">{row.total}</td>
                <td className="py-2 pr-4">{row.detail || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Controles simples de paginación (si ya tienes unos, ignora esto) */}
      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-gray-500">
          Page {pagination.currentPage} of {pagination.totalPages} — {pagination.totalItems} items
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => onPageChange(Math.max(1, pagination.currentPage - 1))}
            disabled={!pagination.hasPreviousPage}
          >
            Prev
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
            disabled={!pagination.hasNextPage}
          >
            Next
          </button>
          <select
            className="ml-2 border rounded px-2 py-1 text-sm"
            value={pagination.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50].map(s => <option key={s} value={s}>{s}/page</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
