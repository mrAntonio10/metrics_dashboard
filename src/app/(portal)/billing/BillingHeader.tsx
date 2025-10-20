// src/app/(portal)/billing/BillingHeader.tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Org = { id: string; name: string }

export default function BillingHeader({
  orgs,
  selectedClient,
  onSelect,
  selectedDate,       // 'YYYY-MM-DD' | ''
  onDateChange,       // (val: string) => void
  onClearFilters,
}: {
  orgs: Org[]
  selectedClient: string
  onSelect: (val: string) => void

  selectedDate: string
  onDateChange: (val: string) => void
  onClearFilters: () => void
}) {
  const selectedLabel =
    selectedClient === 'all'
      ? 'All Clients'
      : (orgs.find(o => o.id === selectedClient)?.name ?? 'All Clients')

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Cliente */}
      <div className="flex items-center gap-2">
        <Select onValueChange={onSelect} value={selectedClient}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder={selectedLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {orgs.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fecha exacta (YYYY-MM-DD) */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          className="border rounded px-2 py-1 text-sm h-9"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}  // e.g. '2025-11-20'
        />
        <button
          type="button"
          className="text-xs underline ml-2"
          onClick={onClearFilters}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
