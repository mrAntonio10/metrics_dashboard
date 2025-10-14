'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { TimeRangeFilter } from '@/components/time-range-filter';
import { KpiCard } from '@/components/kpi-card';
import { uptimeData, errorRateData, p95LatencyData, incidents } from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncidentSummary } from '@/lib/types';



export default function PlatformPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('90d');

  const impactBadge = (impact: IncidentSummary['impactScope']) => {
    const variants = {
      critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
      major: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
      minor: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
    };
    return <Badge variant="outline" className={cn("capitalize", variants[impact])}>{impact}</Badge>;
  };


  return (
    <ProtectedComponent permissionKey="page:platform" fallback={<AccessDeniedFallback />}>
      <PageHeader
        title="Platform Health"
        description="Monitor service uptime, performance, and stability."
      >
        <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
      </PageHeader>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard title="Uptime (90d)" value={`${uptimeData[uptimeData.length - 1].value.toFixed(3)}%`} change={-0.01} />
          <KpiCard title="Error Rate (90d)" value={`${errorRateData[errorRateData.length - 1].value.toFixed(2)}%`} change={-0.05} />
          <KpiCard title="P95 Latency (90d)" value={`${p95LatencyData[p95LatencyData.length - 1].value.toFixed(0)}ms`} change={-15} />
        </div>

        <Card>
          <CardHeader><CardTitle>Performance Metrics (90d)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-72">
              <LineChart data={p95LatencyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v, i) => i % 30 === 0 ? v : ''} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="value" name="P95 Latency (ms)" stroke="var(--color-chart-1)" dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Incidents</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Duration (min)</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map(incident => (
                  <TableRow key={incident.id}>
                    <TableCell>{incident.startedAt.toLocaleDateString()}</TableCell>
                    <TableCell>{impactBadge(incident.impactScope)}</TableCell>
                    <TableCell>{incident.duration}</TableCell>
                    <TableCell className="flex items-center gap-2 font-mono text-sm">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      <span>{incident.summary}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ProtectedComponent>
  );
}
