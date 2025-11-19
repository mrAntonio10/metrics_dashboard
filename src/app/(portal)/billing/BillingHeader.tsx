// src/app/(portal)/billing/BillingHeader.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type Org = { id: string; name: string };

type BillingHeaderProps = {
  orgs: Org[];
  selectedClient: string;
  onSelect: (val: string) => void;
  selectedDate: string;            // 'YYYY-MM-DD' o ''
  onDateChange: (val: string) => void;
  onClearFilters: () => void;
};

export default function BillingHeader({
  orgs,
  selectedClient,
  onSelect,
  selectedDate,
  onDateChange,
  onClearFilters,
}: BillingHeaderProps) {
  const [clientSearch, setClientSearch] = useState(
    selectedClient === 'all'
      ? ''
      : orgs.find((o) => o.id === selectedClient)?.name ?? '',
  );

  useEffect(() => {
    if (selectedClient === 'all') {
      setClientSearch('');
    } else {
      const org = orgs.find((o) => o.id === selectedClient);
      setClientSearch(org?.name ?? '');
    }
  }, [selectedClient, orgs]);

  const filteredOrgsBySearch = useMemo(() => {
    if (!clientSearch.trim()) return orgs;
    const q = clientSearch.toLowerCase();
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, clientSearch]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 🔍 INPUT TEXT SEARCH para clients */}
      <div className="relative w-[260px]">
        <Input
          placeholder="Search client…"
          value={clientSearch}
          onChange={(e) => {
            const value = e.target.value;
            setClientSearch(value);
            if (!value) {
              onSelect('all');
            }
          }}
        />
        {filteredOrgsBySearch.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md">
            <button
              type="button"
              className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setClientSearch('');
                onSelect('all');
              }}
            >
              All Clients
            </button>
            {filteredOrgsBySearch.map((org) => (
              <button
                key={org.id}
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setClientSearch(org.name);
                  onSelect(org.id);
                }}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filtro de fecha exacta (YYYY-MM-DD) */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-[170px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setClientSearch('');
            onSelect('all');
            onClearFilters();
          }}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
