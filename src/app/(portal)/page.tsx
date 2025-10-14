'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { TimeRangeFilter } from '@/components/time-range-filter';
import { KpiCard } from '@/components/kpi-card';
import { mrrData, collectionsFunnelData, seatUsageData, uptimeData, incidentData, organizations } from '@/lib/mock-data';
import { CreditCard, Users, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from 'recharts';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function HomePage() {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');


    const uptimeSeries = uptimeData.map(d => ({ ...d, uptime: d.value }));
    const incidentSeries = incidentData.map(d => ({ ...d, incidents: d.value }));

    const formattedMrr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(mrrData[mrrData.length - 1].value);

    return (
        <ProtectedComponent permissionKey="page:home" fallback={<AccessDeniedFallback />}>
            <PageHeader
                title="Executive Summary"
                description="An aggregate, de-identified overview of operational metrics."
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
                            <SelectValue placeholder="Filter by Seats..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any Seats</SelectItem>
                            <SelectItem value="50">Up to 50 Seats</SelectItem>
                            <SelectItem value="100">Up to 100 Seats</SelectItem>
                            <SelectItem value="150">Up to 150 Seats</SelectItem>
                            <SelectItem value="200">200+ Seats</SelectItem>
                        </SelectContent>
                    </Select>
                    <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
                </div>
            </PageHeader>

            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <ProtectedComponent permissionKey="widget:mrr_arr">
                        <KpiCard
                            title="Monthly Recurring Revenue"
                            value={formattedMrr}
                            change={5.2}
                            changePeriod="MoM"
                            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                            tooltip="Total recurring revenue recognized in the period."
                        />
                    </ProtectedComponent>
                    <ProtectedComponent permissionKey="widget:seat_usage">
                        <KpiCard
                            title="Active Seats"
                            value={`${seatUsageData[1].value} / ${seatUsageData[0].value}`}
                            change={-1.5}
                            changePeriod="MoM"
                            icon={<Users className="h-4 w-4 text-muted-foreground" />}
                            tooltip="Number of active user seats vs. total licensed seats."
                        />
                    </ProtectedComponent>
                    <ProtectedComponent permissionKey="widget:collections">
                        <KpiCard
                            title="Collections Rate"
                            value={`${((collectionsFunnelData.succeeded + collectionsFunnelData.recovered) / collectionsFunnelData.attempted * 100).toFixed(1)}%`}
                            change={0.5}
                            changePeriod="MoM"
                            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                            tooltip="Percentage of attempted collections that succeeded or were recovered."
                        />
                    </ProtectedComponent>
                    <ProtectedComponent permissionKey="widget:uptime_incidents">
                        <KpiCard
                            title="90-Day Uptime"
                            value={`${uptimeData[uptimeData.length - 1].value.toFixed(3)}%`}
                            change={-0.01}
                            changePeriod="vs prev 90d"
                            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                            tooltip="Platform uptime SLO over the last 90 days."
                        />
                    </ProtectedComponent>
                </div>

                <Alert className="bg-primary/10 border-primary/20">
                    <AlertTriangle className="h-4 w-4 !text-primary/80" />
                    <AlertTitle className="text-primary/90 font-bold">Upcoming Maintenance</AlertTitle>
                    <AlertDescription className="text-primary/80">
                        Scheduled maintenance on {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString()} at 2 AM UTC. Brief interruptions are possible.
                    </AlertDescription>
                </Alert>

                <div className="grid gap-4 lg:grid-cols-2">
                    <ProtectedComponent permissionKey="widget:uptime_incidents" fallback={<AccessDeniedFallback />}>
                        <Card>
                            <CardHeader>
                                <CardTitle>90-Day Uptime &amp; Incident Burndown</CardTitle>
                            </CardHeader>
                            <CardContent>

                                <ChartContainer config={{}} className="h-64">
                                    <LineChart data={uptimeSeries} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8}
                                            tickFormatter={(value, index) => (index % 30 === 0 ? value : '')} />
                                        <YAxis yAxisId="left" domain={[99.5, 100]} tickFormatter={(v) => `${v}%`} />
                                        <YAxis yAxisId="right" orientation="right" domain={[0, 'dataMax + 2']} allowDecimals={false} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Line yAxisId="left" type="monotone" dataKey="uptime" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} name="Uptime" />
                                        <Line yAxisId="right" type="step" data={incidentSeries} dataKey="incidents" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} name="Incidents" />
                                    </LineChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </ProtectedComponent>

                    <ProtectedComponent permissionKey="widget:seat_usage" fallback={<AccessDeniedFallback />}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Seats vs. Licensed</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={{}} className="h-64">
                                    <BarChart data={seatUsageData} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={80} />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                        <Bar dataKey="value" radius={5} fill="var(--color-chart-1)" />
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
