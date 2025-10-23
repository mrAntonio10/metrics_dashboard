// src/app/(support)/page.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { TicketsTable } from '@/components/tickets-table';
import { useTickets } from '@/hooks/use-tickets';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, BarChart, Line, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ProtectedComponent } from '@/hooks/use-permission';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// SLA fallbacks (used if backend does not provide a policy)
const SLA_DEFAULTS = {
  goalFirstResponsePercent: 95,
  goalResolutionPercent: 90,
  targetFirstResponseMinutes: 240, // 4h
  targetResolutionMinutes: 2880,   // 48h
} as const;

const diffMinutes = (a?: string, b?: string) => {
  if (!a || !b) return undefined;
  const tA = new Date(a).getTime();
  const tB = new Date(b).getTime();
  if (Number.isNaN(tA) || Number.isNaN(tB)) return undefined;
  return Math.max(0, Math.round((tA - tB) / 60000));
};

export default function SupportPage() {
  // Filters forwarded to webhook (company, month, status, urgency)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const {
    tickets,            // webhook data (already filtered by n8n)
    companies,          // [{ value, label }] from n8n
    pagination,         // backend pagination
    loading,
    error,
    filters,            // { month, company, status, urgency, ... }
    updateFilters,
    goToPage,
    changePageSize,
    catalogs,           // { availableStatuses?, availableUrgencies? }
    slaPolicy,          // optional SLA policy
  } = useTickets();

  // Month (DatePicker) → sent as 'YYYY-MM'
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

  // Options for selects (prefer backend catalogs; otherwise derive from tickets)
  const statusOptions = useMemo(() => {
    const fromApi = catalogs?.availableStatuses;
    if (fromApi?.length) return ['all', ...fromApi];
    const set = new Set<string>();
    tickets.forEach((t) => t.status && set.add(String(t.status).trim()));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [tickets, catalogs?.availableStatuses]);

  const urgencyOptions = useMemo(() => {
    const fromApi = catalogs?.availableUrgencies;
    if (fromApi?.length) return ['all', ...fromApi];
    const set = new Set<string>();
    tickets.forEach((t) => t.urgencyLevel && set.add(String(t.urgencyLevel).trim()));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [tickets, catalogs?.availableUrgencies]);

  // KPIs (based on data already filtered by n8n)
  const kpis = useMemo(() => {
    const totalTickets = pagination?.totalItems ?? tickets.length;
    const resolvedTickets = tickets.filter(
      (t) => t.status?.toLowerCase() === 'resolved' || t.status?.toLowerCase() === 'closed',
    ).length;
    const highPriorityTickets = tickets.filter(
      (t) => t.urgencyLevel?.toLowerCase() === 'high' || t.urgencyLevel?.toLowerCase() === 'critical',
    ).length;

    const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    return {
      totalTickets,
      resolutionRate,
      highPriorityCount: highPriorityTickets,
    };
  }, [tickets, pagination?.totalItems]);

  // Volume by date (sorted)
  const chartData = useMemo(() => {
    const map = tickets.reduce((acc, t) => {
      const d = t.issueStarted ? new Date(t.issueStarted) : null;
      const key = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'N/A'; // YYYY-MM-DD
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }, [tickets]);

  // SLA attainment (goal vs actual) computed from tickets + backend policy (or defaults)
  const computedSlaData = useMemo(() => {
    const policy = slaPolicy ?? SLA_DEFAULTS;

    let frElig = 0, frMet = 0;
    let resElig = 0, resMet = 0;

    for (const t of tickets) {
      // FIRST RESPONSE
      const frMin =
        t.firstResponseMinutes ?? diffMinutes(t.firstResponseAt, t.issueStarted);
      if (typeof frMin === 'number') {
        frElig++;
        if (frMin <= policy.targetFirstResponseMinutes) frMet++;
      }

      // RESOLUTION
      const resMin =
        t.resolutionMinutes ?? diffMinutes(t.resolvedAt, t.issueStarted);
      if (typeof resMin === 'number') {
        resElig++;
        if (resMin <= policy.targetResolutionMinutes) resMet++;
      }
    }

    const frActual = frElig ? Math.round((frMet / frElig) * 100) : 0;
    const resActual = resElig ? Math.round((resMet / resElig) * 100) : 0;

    return [
      { name: 'First Response', goal: policy.goalFirstResponsePercent, actual: frActual },
      { name: 'Resolution',     goal: policy.goalResolutionPercent,    actual: resActual },
    ];
  }, [tickets, slaPolicy]);

  return (
    <ProtectedComponent permissionKey="page:support">
      <PageHeader
        title="Support Operations"
        description="Track ticket volume, SLA performance, and customer satisfaction."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Company → forwarded to n8n */}
          <Select
            value={filters.company}
            onValueChange={(value) => updateFilters({ company: value })}
          >
            <SelectTrigger className="w-[200px]" aria-label="Filter by company">
              <SelectValue placeholder="Filter by company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.value} value={company.value}>
                  {company.label}
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

          {/* Status → forwarded to n8n */}
          <Select
            value={filters.status}
            onValueChange={(v) => updateFilters({ status: v })}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by status">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === 'all' ? 'All Statuses' : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Urgency → forwarded to n8n */}
          <Select
            value={filters.urgency}
            onValueChange={(v) => updateFilters({ urgency: v })}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by urgency">
              <SelectValue placeholder="Filter by urgency..." />
            </SelectTrigger>
            <SelectContent>
              {urgencyOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === 'all' ? 'All Urgencies' : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard title="Total Tickets" value={kpis.totalTickets.toString()} change={0} />
          <KpiCard title="Resolution Rate" value={`${kpis.resolutionRate}%`} change={0} />
          <KpiCard title="High Priority" value={kpis.highPriorityCount.toString()} change={0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Volume by Date</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-72">
                <LineChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Tickets"
                    stroke="var(--color-chart-1)"
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA Attainment</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-72">
                <BarChart data={computedSlaData} margin={{ top: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="goal" fill="hsl(var(--muted))" radius={4} name="Goal" />
                  <Bar dataKey="actual" fill="var(--color-chart-1)" radius={4} name="Actual" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tickets table (backend-paginated) */}
        <TicketsTable
          tickets={tickets}
          loading={loading}
          pagination={pagination}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>
    </ProtectedComponent>
  );
}
