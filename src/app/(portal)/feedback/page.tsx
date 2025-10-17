// src/app/(feedback)/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ProtectedComponent } from '@/hooks/use-permission';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { useFeedback } from '@/hooks/use-feedbacks';
import { FeedbackTable } from '@/components/feedback-table';

export default function FeedbackPage() {
  const {
    items, companies, pagination, loading, error,
    filters, updateFilters, goToPage, changePageSize,
  } = useFeedback();

  // date pickers locales
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);

  // helpers
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined); // YYYY-MM-DD

  const applyDates = () => {
    updateFilters({ dateFrom: fmt(from), dateTo: fmt(to) });
  };

  const clearDates = () => {
    setFrom(null);
    setTo(null);
    updateFilters({ dateFrom: undefined, dateTo: undefined });
  };

  const companyOptions = useMemo(() => companies, [companies]);

  return (
    <ProtectedComponent permissionKey="page:feedback">
      <PageHeader
        title="Customer Feedback"
        description="Browse customer opinions by client and date."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Company */}
          <Select
            value={filters.company}
            onValueChange={(v) => updateFilters({ company: v })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by Client..." />
            </SelectTrigger>
            <SelectContent>
              {companyOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <DatePicker
              selected={from}
              onChange={(d) => setFrom(d)}
              placeholderText="From (YYYY-MM-DD)"
              className="w-[150px] px-3 py-2 text-sm border border-input bg-background rounded-md"
            />
            <DatePicker
              selected={to}
              onChange={(d) => setTo(d)}
              placeholderText="To (YYYY-MM-DD)"
              className="w-[150px] px-3 py-2 text-sm border border-input bg-background rounded-md"
            />
            <Button variant="default" size="sm" onClick={applyDates}>Apply</Button>
            {(filters.dateFrom || filters.dateTo) && (
              <Button variant="outline" size="sm" onClick={clearDates}>Clear</Button>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-2 rounded-md">
            Error: {error}
          </div>
        )}

        <FeedbackTable
          items={items}
          loading={loading}
          pagination={pagination}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>
    </ProtectedComponent>
  );
}
