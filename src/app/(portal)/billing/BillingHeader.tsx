// src/app/(portal)/billing/BillingHeader.tsx
'use client';

import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type Org = { id: string; name: string };

export type BillingHeaderProps = {
  orgs: Org[];
  selectedClient: string;            // 'all' or a tenant id
  onSelect: (val: string) => void;

  selectedDate: string;              // 'YYYY-MM-DD' or ''
  onDateChange: (val: string) => void;
  onClearFilters: () => void;
};

function BillingHeaderImpl({
  orgs,
  selectedClient,
  onSelect,
  selectedDate,
  onDateChange,
  onClearFilters,
}: BillingHeaderProps) {
  const selectedLabel = useMemo(
    () =>
      selectedClient === 'all'
        ? 'All Clients'
        : orgs.find((o) => o.id === selectedClient)?.name ?? 'All Clients',
    [orgs, selectedClient]
  );

  return (
    <div
      className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      role="group"
      aria-label="Billing filters"
    >
      {/* Client selector */}
      <div className="flex items-center gap-2">
        <Select onValueChange={onSelect} value={selectedClient}>
          <SelectTrigger className="w-[240px]" aria-label="Select client">
            <SelectValue placeholder={selectedLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Exact date (YYYY-MM-DD) */}
      <div className="flex items-center gap-2">
        <label htmlFor="billing-date" className="sr-only">
          Filter by exact date
        </label>
        <input
          id="billing-date"
          type="date"
          className="border rounded px-2 py-1 text-sm h-9"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)} // e.g. '2025-11-20'
        />
        <button
          type="button"
          className="text-xs underline ml-2"
          onClick={onClearFilters}
          aria-label="Clear client and date filters"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default React.memo(BillingHeaderImpl);
