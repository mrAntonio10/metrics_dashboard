// src/components/billing-table.tsx
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export type InvoiceLine = {
  id: string
  description: string
  quantity: number
  rate: number        // USD
  total?: number      // si no viene, se calcula = quantity * rate
}

export type BillingPagination = {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

interface Props {
  items: InvoiceLine[]
  loading: boolean
  pagination: BillingPagination
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export const BillingTable: React.FC<Props> = ({
  items, loading, pagination, onPageChange, onPageSizeChange,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading invoice lines...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Lines ({pagination.totalItems})</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No lines yet.</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const lineTotal = it.total ?? it.quantity * it.rate
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="whitespace-pre-wrap">{it.description}</TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">{usd(it.rate)}</TableCell>
                        <TableCell className="text-right font-semibold">{usd(lineTotal)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={pagination.pageSize.toString()}
                  onValueChange={(v) => onPageSizeChange(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 20, 30, 40, 50].map(size => (
                      <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex w-[140px] items-center justify-center text-sm font-medium">
                  Page {pagination.currentPage} of {Math.max(pagination.totalPages, 1)}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => onPageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => onPageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
