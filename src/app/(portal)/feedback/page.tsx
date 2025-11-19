// src/app/(feedback)/page.tsx
'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { ProtectedComponent } from '@/hooks/use-permission';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { useFeedback } from '@/hooks/use-feedbacks'; // hook name intentionally singular
import { FeedbackTable } from '@/components/feedback-table';
import { Input } from '@/components/ui/input';

export default function FeedbackPage() {
  const {
    items,
    companies,
    pagination,
    loading,
    error,
    filters,            // { company, month, page, pageSize }
    updateFilters,      // updates filter state (resets page when relevant)
    goToPage,
    changePageSize,
  } = useFeedback();

  // Month (DatePicker) → forwarded to webhook as 'YYYY-MM'
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 🔍 search solo para company
  const [companySearch, setCompanySearch] = useState<string>('');

  const handleDateChange = useCallback(
    (date: Date | null) => {
      if (!date) return;
      setSelectedDate(date);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      updateFilters({ month: monthYear }); // hook resets page
    },
    [updateFilters],
  );

  const handleClearDate = useCallback(() => {
    setSelectedDate(null);
    updateFilters({ month: 'all' }); // hook resets page
  }, [updateFilters]);

  const companyOptions = useMemo(() => companies, [companies]);

  // sincroniza el input con el filtro actual
  useEffect(() => {
    if (!filters.company || filters.company === 'all') {
      setCompanySearch('');
      return;
    }
    const match = companyOptions.find((c) => c.value === filters.company);
    if (match) {
      setCompanySearch(match.label);
    }
  }, [filters.company, companyOptions]);

  const filteredCompanies = useMemo(() => {
    if (!companyOptions?.length) return [];
    if (!companySearch.trim()) return companyOptions;
    const q = companySearch.toLowerCase();
    return companyOptions.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.value.toLowerCase().includes(q),
    );
  }, [companyOptions, companySearch]);

  return (
    <ProtectedComponent permissionKey="page:feedback">
      <PageHeader
        title="Customer Feedback"
        description="Browse customer opinions by company and month."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Company → forwarded to n8n (input search + dropdown) */}
          <div className="relative w-[220px]">
            <Input
              placeholder="Filter by company..."
              aria-label="Filter by company"
              value={companySearch}
              onChange={(e) => {
                const value = e.target.value;
                setCompanySearch(value);
                if (!value) {
                  updateFilters({ company: 'all' });
                }
              }}
            />
            {filteredCompanies.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md">
                <button
                  type="button"
                  className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setCompanySearch('');
                    updateFilters({ company: 'all' });
                  }}
                >
                  All companies
                </button>
                {filteredCompanies
                  .filter((c) => c.value !== 'all')
                  .map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setCompanySearch(c.label);
                        updateFilters({ company: c.value });
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Month (DatePicker) → forwarded to n8n */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                placeholderText="Select month/year"
                className="w-[140px] px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                wrapperClassName="w-full"
                calendarClassName="!font-sans"
              />
            </div>
            {filters.month !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDate}
                className="px-2"
                aria-label="Clear month filter"
              >
                All Months
              </Button>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="bg-destructive/15 border border-destructive text-destructive px-4 py-2 rounded-md"
          >
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
