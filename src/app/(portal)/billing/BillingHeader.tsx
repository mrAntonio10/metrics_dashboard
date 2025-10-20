// src/app/(portal)/billing/BillingHeader.tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Org = { id: string; name: string }
export type DateMode = 'month' | 'day'

export default function BillingHeader({
  orgs,
  selectedClient,
  onSelect,

  // filtros de fecha
  dateMode,
  monthYear,
  day,
  onDateModeChange,
  onMonthChange,
  onDayChange,
  onClearFilters,
}: {
  orgs: Org[]
  selectedClient: string
  onSelect: (val: string) => void

  dateMode: DateMode
  monthYear: string            // 'YYYY-MM'
  day: string                  // 'all' | '1'..'31'
  onDateModeChange: (m: DateMode) => void
  onMonthChange: (ym: string) => void
  onDayChange: (d: string) => void
  onClearFilters: () => void
}) {
  // util local para cantidad de días del mes seleccionado
  const daysInMonth = (ym: string) => {
    if (!/^\d{4}-\d{2}$/.test(ym)) return 31
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }

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

      {/* Filtros de fecha */}
      <div className="flex items-center gap-2">
        {/* Modo: mes o día */}
        <Select value={dateMode} onValueChange={(v) => onDateModeChange(v as DateMode)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="By Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">By Month</SelectItem>
            <SelectItem value="day">By Day</SelectItem>
          </SelectContent>
        </Select>

        {/* Mes */}
        <input
          type="month"
          className="border rounded px-2 py-1 text-sm h-9"
          value={monthYear}
          onChange={(e) => {
            // si el día actual no existe en el nuevo mes, el padre puede decidir resetearlo
            onMonthChange(e.target.value)
          }}
        />

        {/* Día (solo en modo day y con mes seleccionado) */}
        {dateMode === 'day' && monthYear ? (
          <Select value={day} onValueChange={onDayChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {Array.from({ length: daysInMonth(monthYear) }, (_, i) => String(i + 1)).map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {/* Clear */}
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
