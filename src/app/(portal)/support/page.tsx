'use client';

import { useState, useMemo } from 'react';
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

const slaData = [
  { name: 'First Response', goal: 95, actual: 97 },
  { name: 'Resolution', goal: 90, actual: 88 },
];

const ticketTypes = [
  { value: 'all', label: 'All Ticket Types' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Inquiry' },
  { value: 'technical', label: 'Technical Support' },
];

// Helper para generar opciones de mes
const generateMonthOptions = () => {
  const options = [{ value: '', label: 'All Months' }];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  
  return options;
};

export default function SupportPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const {
    tickets,
    companies,
    pagination,
    loading,
    error,
    filters,
    updateFilters,
    goToPage,
    changePageSize,
  } = useTickets();

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Calcular KPIs basados en tickets reales
  const kpis = useMemo(() => {
    const totalTickets = pagination.totalItems;
    const resolvedTickets = tickets.filter(t => 
      t.status?.toLowerCase() === 'resolved' || t.status?.toLowerCase() === 'closed'
    ).length;
    const highPriorityTickets = tickets.filter(t => 
      t.urgencyLevel?.toLowerCase() === 'high' || t.urgencyLevel?.toLowerCase() === 'critical'
    ).length;

    const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;

    return {
      totalTickets,
      resolutionRate: Math.round(resolutionRate),
      highPriorityCount: highPriorityTickets,
    };
  }, [tickets, pagination.totalItems]);

  // Datos para gráficos basados en tickets reales
  const chartData = useMemo(() => {
    const ticketsByDate = tickets.reduce((acc, ticket) => {
      const date = new Date(ticket.issueStarted).toLocaleDateString();
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
          <Select
            value={filters.company}
            onValueChange={(value) => updateFilters({ company: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Client..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map(company => (
                <SelectItem key={company.value} value={company.value}>
                  {company.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Ticket Type..." />
            </SelectTrigger>
            <SelectContent>
              {ticketTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.month}
            onValueChange={(value) => updateFilters({ month: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Month..." />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
          <KpiCard 
            title="Total Tickets" 
            value={kpis.totalTickets.toString()} 
            change={0} 
          />
          <KpiCard 
            title="Resolution Rate" 
            value={`${kpis.resolutionRate}%`} 
            change={0} 
          />
          <KpiCard 
            title="High Priority" 
            value={kpis.highPriorityCount.toString()} 
            change={0} 
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ProtectedComponent permissionKey="widget:ticket_volume">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Volume by Date</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-72">
                  <LineChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8}
                    />
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
          </ProtectedComponent>

          <ProtectedComponent permissionKey="widget:sla_attainment">
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
          </ProtectedComponent>
        </div>

        {/* Tabla de tickets */}
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