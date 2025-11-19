// src/app/(portal)/billing/BillingHeader.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export type Org = { id: string; name: string };

type BillingHeaderProps = {
  orgs: Org[];
  selectedClient: string;
  onSelect: (val: string) => void;
  selectedDate: string;            // '', 'YYYY-MM-DD' o 'YYYY-MM-DD,YYYY-MM-DD'
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

  // estado local para el rango de fechas
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // helpers para parsear/format fechas
  const parseIso = (v: string): Date | null => {
    if (!v) return null;
    const [y, m, d] = v.split('-');
    if (!y || !m || !d) return null;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const toIso = (d: Date | null) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Sincroniza input cuando cambie selectedClient u orgs
  useEffect(() => {
    if (selectedClient === 'all') {
      setClientSearch('');
    } else {
      const org = orgs.find((o) => o.id === selectedClient);
      setClientSearch(org?.name ?? '');
    }
  }, [selectedClient, orgs]);

  // Sincroniza el rango local cuando cambie selectedDate desde el parent
  useEffect(() => {
    if (!selectedDate) {
      setStartDate(null);
      setEndDate(null);
      return;
    }

    const parts = selectedDate.split(',');
    if (parts.length === 2) {
      const [from, to] = parts;
      setStartDate(parseIso(from.trim()));
      setEndDate(parseIso(to.trim()));
    } else {
      setStartDate(parseIso(selectedDate.trim()));
      setEndDate(null);
    }
  }, [selectedDate]);

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

  const handleRangeChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);

    if (start && end) {
      // rango completo
      const from = toIso(start);
      const to = toIso(end);
      onDateChange(`${from},${to}`);
    } else if (start && !end) {
      // solo fecha inicial seleccionada
      onDateChange(toIso(start));
    } else {
      // limpiado
      onDateChange('');
    }
  };

  const handleClear = () => {
    setClientSearch('');
    onSelect('all');
    onClearFilters();
    setDropdownOpen(false);
    setStartDate(null);
    setEndDate(null);
  };

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

      {/* Filtro de rango de fechas */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <DatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
            dateFormat="dd/MM/yyyy"
            placeholderText="Select date range"
            className="w-[210px] px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            wrapperClassName="w-full"
            calendarClassName="!font-sans"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
