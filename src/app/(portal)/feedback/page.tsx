// src/app/(feedback)/page.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
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

  return (
    <ProtectedComponent permissionKey="page:feedback">
      <PageHeader
        title="Customer Feedback"
        description="Browse customer opinions by company and month."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Company → forwarded to n8n */}
          <Select
            value={filters.company}
            onValueChange={(v) => updateFilters({ company: v })}
          >
            <SelectTrigger className="w-[220px]" aria-label="Filter by company">
              <SelectValue placeholder="Filter by company..." />
            </SelectTrigger>
            <SelectContent>
              {companyOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
