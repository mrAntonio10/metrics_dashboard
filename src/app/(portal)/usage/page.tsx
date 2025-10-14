'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';

// —— Tipos alineados al JSON de /var/lib/vivace-metrics/metrics.json ——
type Container = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports_list: string;
  client: string;
  role: string;
  tls: { exposes_443: boolean };
  started_at: string;
  uptime_seconds: number | null;
  stats: {
    cpu_percent: number;
    mem_used_bytes: number;
    mem_limit_bytes: number;
    mem_percent: number;
    net_rx_bytes: number;
    net_tx_bytes: number;
    block_read_bytes: number;
    block_write_bytes: number;
    pids: number;
  };
};

type MetricsPayload = {
  timestamp: string;
  host: string;
  docker: {
    running: boolean;
    server_version: string;
    client_version: string;
    context: string;
  };
  containers: Container[];
  clients: string[];
  client_agg: Array<{
    client: string;
    containers: number;
    cpu_percent_sum: number;
    mem_used_bytes_sum: number;
    mem_limit_bytes_sum: number;
    net_rx_bytes_sum: number;
    net_tx_bytes_sum: number;
  }>;
};

// —— helpers de formato ——
const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

const fmtBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${fmtNum(val)} ${units[i]}`;
};

const percent = (num: number, den: number) => {
  if (!den || den <= 0) return '0%';
  return `${fmtNum((num / den) * 100)}%`;
};

export default function UsagePage() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState('all');

  // fetch + polling cada 10s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/usage', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MetricsPayload;
        if (alive) { setData(json); setError(null); }
      } catch (e: any) {
        if (alive) setError(e.message ?? 'fetch_failed');
      }
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // opciones de cliente (dinámicas)
  const clients = useMemo(() => ['all', ...(data?.clients ?? [])], [data]);

  // agregados visibles
  const selectedAgg = useMemo(() => {
    if (!data) return [];
    return client === 'all' ? data.client_agg : data.client_agg.filter(a => a.client === client);
  }, [data, client]);

  // contenedores visibles
  const visibleContainers = useMemo<Container[]>(() => {
    if (!data) return [];
    return client === 'all' ? data.containers : data.containers.filter(c => c.client === client);
  }, [data, client]);

  return (
    <ProtectedComponent permissionKey="page:usage" fallback={<AccessDeniedFallback />}>
      <PageHeader
        title="Usage Administration"
        description="Métricas reales de Docker por cliente y contenedor."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by Client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c} value={c}>
                  {c === 'all' ? 'All Clients' : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />

          {data?.docker?.running
            ? <Badge variant="outline" className="border-green-500/50 text-green-600">Docker OK ({data.docker.server_version})</Badge>
            : <Badge variant="outline" className="border-red-500/50 text-red-600">Docker DOWN</Badge>
          }

          {data && (
            <span className="text-xs text-muted-foreground">
              Updated: {new Date(data.timestamp).toLocaleString()}
            </span>
          )}

          {error && <span className="text-xs text-destructive">Error: {error}</span>}
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* AGREGADOS POR CLIENTE */}
        <Card>
          <CardHeader><CardTitle>Client aggregates</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedAgg.map(a => {
              const memPct = percent(a.mem_used_bytes_sum, a.mem_limit_bytes_sum);
              return (
                <div key={a.client} className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{a.client}</div>
                    <Badge variant="outline">{a.containers} containers</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">CPU (sum)</div>
                      <div className="font-medium">{fmtNum(a.cpu_percent_sum)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">RAM</div>
                      <div className="font-medium">
                        {fmtBytes(a.mem_used_bytes_sum)} / {fmtBytes(a.mem_limit_bytes_sum)} ({memPct})
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Net RX</div>
                      <div className="font-medium">{fmtBytes(a.net_rx_bytes_sum)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Net TX</div>
                      <div className="font-medium">{fmtBytes(a.net_tx_bytes_sum)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedAgg.length === 0 && (
              <div className="text-sm text-muted-foreground">No data.</div>
            )}
          </CardContent>
        </Card>

        {/* TABLA DE CONTENEDORES */}
        <Card>
          <CardHeader><CardTitle>Containers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">CPU% </TableHead>
                  <TableHead className="text-right">RAM</TableHead>
                  <TableHead className="text-right">Net RX / TX</TableHead>
                  <TableHead className="text-right">PIDs</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContainers.map(c => {
                  const ram = `${fmtBytes(c.stats.mem_used_bytes)} / ${fmtBytes(c.stats.mem_limit_bytes)} (${fmtNum(c.stats.mem_percent)}%)`;
                  const net = `${fmtBytes(c.stats.net_rx_bytes)} / ${fmtBytes(c.stats.net_tx_bytes)}`;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {c.name}
                        <div className="text-[10px] text-muted-foreground">{c.image}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.client}</Badge></TableCell>
                      <TableCell>{c.role}</TableCell>
                      <TableCell className="text-right">{fmtNum(c.stats.cpu_percent)}%</TableCell>
                      <TableCell className="text-right">{ram}</TableCell>
                      <TableCell className="text-right">{net}</TableCell>
                      <TableCell className="text-right">{c.stats.pids}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={c.ports_list}>{c.ports_list || '—'}</TableCell>
                      <TableCell>
                        <span className="text-xs">{c.status}</span>
                        {c.tls.exposes_443 && <Badge className="ml-2" variant="outline">TLS/443</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visibleContainers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      No containers for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ProtectedComponent>
  );
}
