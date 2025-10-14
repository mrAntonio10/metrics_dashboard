'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { TimeRangeFilter } from '@/components/time-range-filter';
import { KpiCard } from '@/components/kpi-card';
import { ticketVolumeData, backlogData, organizations } from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, BarChart, Line, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ProtectedComponent } from '@/hooks/use-permission';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const slaData = [
  { name: 'First Response', goal: 95, actual: 97 },
  { name: 'Resolution', goal: 90, actual: 88 },
]

const ticketTypes = [
    { value: 'all', label: 'All Ticket Types' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'billing', label: 'Billing Inquiry' },
    { value: 'technical', label: 'Technical Support' },
]

export default function SupportPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');

  return (
    <ProtectedComponent permissionKey="page:support">
      <PageHeader
        title="Support Operations"
        description="Track ticket volume, SLA performance, and customer satisfaction."
      >
        <div className="flex flex-wrap items-center gap-2">
            <Select>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Client..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Ticket Type..." />
                </SelectTrigger>
                <SelectContent>
                    {ticketTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                </SelectContent>
            </Select>
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>
      </PageHeader>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard title="Tickets Opened (30d)" value="1,245" change={-10} />
          <KpiCard title="Resolution SLA (30d)" value="88%" change={-2} />
          <KpiCard title="CSAT (30d)" value="4.7 / 5.0" change={0.1} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
            <ProtectedComponent permissionKey="widget:ticket_volume">
                <Card>
                    <CardHeader>
                        <CardTitle>Ticket Volume vs. Backlog</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-72">
                            <LineChart>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} data={ticketVolumeData}/>
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Line yAxisId="left" type="monotone" data={ticketVolumeData} dataKey="value" name="Opened" stroke="var(--color-chart-1)" dot={false} />
                                <Line yAxisId="right" type="monotone" data={backlogData} dataKey="value" name="Backlog" stroke="var(--color-chart-2)" dot={false} />
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
                                <YAxis tickFormatter={(v) => `${v}%`}/>
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="goal" fill="hsl(var(--muted))" radius={4} name="Goal"/>
                                <Bar dataKey="actual" fill="var(--color-chart-1)" radius={4} name="Actual"/>
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </ProtectedComponent>
        </div>
      </div>
    </ProtectedComponent>
  );
}
