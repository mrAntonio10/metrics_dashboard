// src/app/(portal)/billing/BillingHeader.tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Org = { id: string; name: string }

export default function BillingHeader({
  orgs, selectedClient, onSelect,
}: {
  orgs: Org[]
  selectedClient: string
  onSelect: (val: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Select onValueChange={onSelect} value={selectedClient === 'all' ? undefined : selectedClient}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder={selectedClient === 'all' ? 'All Clients' : (orgs.find(o => o.id === selectedClient)?.name || 'All Clients')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {orgs.map(o => (
            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
