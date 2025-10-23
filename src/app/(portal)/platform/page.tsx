// src/app/(portal)/platform/page.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { TimeRangeFilter } from '@/components/time-range-filter';
import { KpiCard } from '@/components/kpi-card';
import { uptimeData, errorRateData, p95LatencyData, incidents } from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncidentSummary } from '@/lib/types';

type TimeRange = '7d' | '30d' | '90d' | 'custom';

const impactVariants: Record<IncidentSummary['impactScope'], string> = {
  critical:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
  major:
    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
  minor:
    'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
};

function formatPercent(n: number, fractionDigits = 2) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  } catch {
    return `${(n * 100).toFixed(fractionDigits)}%`;
  }
}

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat().format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

function getLast<T extends { value: number }>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined;
}

export default function PlatformPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');

  // KPI values (defensive if datasets are empty)
  const lastUptime = getLast(uptimeData)?.value ?? 0;
  const lastErrorRate = getLast(errorRateData)?.value ?? 0;
  const lastP95 = getLast(p95LatencyData)?.value ?? 0;

  // Display label derived from selected range (purely presentational for now)
  const rangeLabel = useMemo(() => (timeRange === 'custom' ? 'Custom' : timeRange), [timeRange]);

  const renderImpactBadge = useCallback(
    (impact: IncidentSummary['impactScope']) => (
      <Badge variant="outline" className={cn('capitalize', impactVariants[impact])}>
        {impact}
      </Badge>
    ),
    [],
  );

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
          <KpiCard
            title={`Uptime (${rangeLabel})`}
            value={formatPercent(lastUptime / 100, 3)} // uptimeData holds 0–100; convert to 0–1
            change={-0.01}
          />
          <KpiCard
            title={`Error Rate (${rangeLabel})`}
            value={formatPercent(lastErrorRate / 100, 2)} // errorRateData holds 0–100; convert to 0–1
            change={-0.05}
          />
          <KpiCard
            title={`P95 Latency (${rangeLabel})`}
            value={`${formatInt(lastP95)} ms`}
            change={-15}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics ({rangeLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-72">
              <LineChart data={p95LatencyData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string, i: number) => (i % 30 === 0 ? v : '')}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="P95 Latency (ms)"
                  stroke="var(--color-chart-1)"
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Incidents</CardTitle>
          </CardHeader>
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
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>{incident.startedAt.toLocaleDateString()}</TableCell>
                    <TableCell>{renderImpactBadge(incident.impactScope)}</TableCell>
                    <TableCell>{formatInt(incident.duration)}</TableCell>
                    <TableCell className="flex items-center gap-2 font-mono text-sm">
                      <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
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
