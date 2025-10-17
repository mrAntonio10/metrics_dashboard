'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { TimeRangeFilter } from '@/components/time-range-filter';
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

const slaData = [
  { name: 'First Response', goal: 95, actual: 97 },
  { name: 'Resolution', goal: 90, actual: 88 },
];

export default function SupportPage() {
  // ➜ Filtros que viajan al webhook (company, month, status, urgency)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');

  const {
    tickets,            // datos del webhook (ya filtrados por n8n)
    companies,          // [{value,label}] desde n8n
    pagination,         // paginación del backend (n8n)
    loading,
    error,
    filters,            // { month, company, status?, urgency?, availableStatuses?, availableUrgencies? }
    updateFilters,
    goToPage,
    changePageSize,
  } = useTickets();

  // Month (DatePicker) → viaja al webhook
  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      updateFilters({ month: monthYear });
      goToPage(1);
    }
  };

  const handleClearDate = () => {
    setSelectedDate(null);
    updateFilters({ month: 'all' });
    goToPage(1);
  };

  // Opciones para combos (si n8n ya las manda, úsales; si no, deduce desde tickets)
  const statusOptions = useMemo(() => {
    const fromApi = (filters as any)?.availableStatuses as string[] | undefined;
    if (fromApi?.length) return fromApi;
    const set = new Set<string>();
    tickets.forEach(t => t.status && set.add(String(t.status).trim()));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [tickets, filters]);

  const urgencyOptions = useMemo(() => {
    const fromApi = (filters as any)?.availableUrgencies as string[] | undefined;
    if (fromApi?.length) return fromApi;
    const set = new Set<string>();
    tickets.forEach(t => t.urgencyLevel && set.add(String(t.urgencyLevel).trim()));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [tickets, filters]);

  // KPIs (sobre data ya filtrada por n8n)
  const kpis = useMemo(() => {
    const totalTickets = pagination?.totalItems ?? tickets.length;
    const resolvedTickets = tickets.filter(
      t => t.status?.toLowerCase() === 'resolved' || t.status?.toLowerCase() === 'closed'
    ).length;
    const highPriorityTickets = tickets.filter(
      t => t.urgencyLevel?.toLowerCase() === 'high' || t.urgencyLevel?.toLowerCase() === 'critical'
    ).length;

    const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    return {
      totalTickets,
      resolutionRate,
      highPriorityCount: highPriorityTickets,
    };
  }, [tickets, pagination?.totalItems]);

  // Gráfico (sobre data ya filtrada por n8n)
  const chartData = useMemo(() => {
    const ticketsByDate = tickets.reduce((acc, ticket) => {
      const d = ticket.issueStarted ? new Date(ticket.issueStarted) : null;
      const date = d && !isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A';
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(ticketsByDate).map(([date, count]) => ({
      date,
      value: count,
    }));
  }, [tickets]);

  return (
    <ProtectedComponent permissionKey="page:support">
      <PageHeader
        title="Support Operations"
        description="Track ticket volume, SLA performance, and customer satisfaction."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Company → n8n */}
          <Select
            value={filters.company}
            onValueChange={(value) => { updateFilters({ company: value }); goToPage(1); }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Client..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.value} value={company.value}>
                  {company.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month (DatePicker) → n8n */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                placeholderText="Select Month/Year"
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
              >
                All Months
              </Button>
            )}
          </div>

          {/* Status → n8n */}
          <Select
            value={(filters as any)?.status ?? 'all'}
            onValueChange={(v) => { updateFilters({ status: v }); goToPage(1); }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Status..." />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === 'all' ? 'All Statuses' : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Urgency → n8n */}
          <Select
            value={(filters as any)?.urgency ?? 'all'}
            onValueChange={(v) => { updateFilters({ urgency: v }); goToPage(1); }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Urgency..." />
            </SelectTrigger>
            <SelectContent>
              {urgencyOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === 'all' ? 'All Urgencies' : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time range (como antes) — solo UI local si lo usabas para algo visual */}
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>
      </PageHeader>

      <div className="space-y-6">
        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-2 rounded-md">
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
                <BarChart data={slaData} margin={{ top: 20 }}>
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

        {/* Tabla con paginación del backend */}
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
