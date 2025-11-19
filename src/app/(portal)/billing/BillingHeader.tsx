// src/app/(portal)/billing/BillingHeader.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement | null>(null);

  // Sincroniza input cuando cambie selectedClient u orgs
  useEffect(() => {
    if (selectedClient === 'all') {
      setClientSearch('');
    } else {
      const org = orgs.find((o) => o.id === selectedClient);
      setClientSearch(org?.name ?? '');
    }
  }, [selectedClient, orgs]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        clientBoxRef.current &&
        !clientBoxRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOrgsBySearch = useMemo(() => {
    if (!clientSearch.trim()) return orgs;
    const q = clientSearch.toLowerCase();
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, clientSearch]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 🔍 INPUT TEXT SEARCH para clients */}
      <div ref={clientBoxRef} className="relative w-[260px]">
        <Input
          placeholder="Search client…"
          value={clientSearch}
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            const value = e.target.value;
            setClientSearch(value);
            setDropdownOpen(true);
            if (!value) {
              onSelect('all');
            }
          }}
        />
        {dropdownOpen && filteredOrgsBySearch.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md">
            <button
              type="button"
              className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setClientSearch('');
                onSelect('all');
                setDropdownOpen(false);
              }}
            >
              All Clients
            </button>
            {filteredOrgsBySearch.map((org) => (
              <button
                key={org.id}
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setClientSearch(org.name);
                  onSelect(org.id);
                  setDropdownOpen(false);
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
            setDropdownOpen(false);
          }}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
