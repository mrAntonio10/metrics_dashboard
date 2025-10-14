'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';

// ⬇️ Recharts
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// —— Tipos alineados al JSON —— //
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

type ClientAgg = {
  client: string;
  containers: number;
  cpu_percent_sum: number;
  mem_used_bytes_sum: number;
  mem_limit_bytes_sum: number;
  net_rx_bytes_sum: number;
  net_tx_bytes_sum: number;
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
  client_agg: ClientAgg[];
};

// —— helpers —— //
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

// ————————————————————————————————————————————————

export default function UsagePage() {
  const [client, setClient] = useState('all');
  const [date, setDate] = useState<'live' | string>('live'); // 'live' o YYYY-MM-DD

  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySeries, setHistorySeries] = useState<Array<{ date: string; cpu: number; ram: number }>>([]);

  // Cargar lista de fechas disponibles para snapshots
  useEffect(() => {
    const loadDates = async () => {
      try {
        const res = await fetch('/api/usage/dates', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const dates: string[] = (j?.dates ?? []).sort(); // ascendente YYYY-MM-DD
        setAvailableDates(dates);
      } catch (_) {
        // opcional: ignorar
      }
    };
    loadDates();
  }, []);

  // Live vs Snapshot fetch
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const url = date === 'live' ? '/api/usage' : `/api/usage?date=${date}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MetricsPayload;
        if (alive) { setData(json); setError(null); }
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'fetch_failed');
      }
    };

    load();
    // Solo hacemos polling en “live”
    let id: any;
    if (date === 'live') id = setInterval(load, 10_000);
    return () => { alive = false; if (id) clearInterval(id); };
  }, [date]);

  // Opciones de cliente
  const clients = useMemo(() => ['all', ...(data?.clients ?? [])], [data]);

  // Agregados visibles
  const selectedAgg = useMemo(() => {
    if (!data) return [];
    return client === 'all' ? data.client_agg : data.client_agg.filter(a => a.client === client);
  }, [data, client]);

  // Contenedores visibles
  const visibleContainers = useMemo<Container[]>(() => {
    if (!data) return [];
    return client === 'all' ? data.containers : data.containers.filter(c => c.client === client);
  }, [data, client]);

  // —— Construir serie histórica para el gráfico (CPU% y RAM%) —— //
  useEffect(() => {
    // Si no hay fechas históricas o no hay nada que mostrar, vaciamos
    if (availableDates.length === 0) { setHistorySeries([]); return; }

    // Traemos, por defecto, las últimas 14 fechas para el gráfico
    const lastDates = availableDates.slice(-14);

    let cancel = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const results = await Promise.all(
          lastDates.map(async (d) => {
            const r = await fetch(`/api/usage?date=${d}`, { cache: 'no-store' });
            if (!r.ok) return null;
            const j = (await r.json()) as MetricsPayload;
            return { date: d, payload: j };
          })
        );

        if (cancel) return;

        // Calcula CPU% y RAM% agregados del cliente (o “all” = sumatoria global)
        const series = results
          .filter((x): x is { date: string; payload: MetricsPayload } => !!x)
          .map(({ date, payload }) => {
            const aggs = client === 'all'
              ? payload.client_agg
              : payload.client_agg.filter(a => a.client === client);

            const cpu = aggs.reduce((acc, a) => acc + (a.cpu_percent_sum || 0), 0);
            const memUsed = aggs.reduce((acc, a) => acc + (a.mem_used_bytes_sum || 0), 0);
            const memLimit = aggs.reduce((acc, a) => acc + (a.mem_limit_bytes_sum || 0), 0);
            const ramPct = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;

            return { date, cpu: Number(cpu.toFixed(2)), ram: Number(ramPct.toFixed(2)) };
          });

        setHistorySeries(series);
      } finally {
        if (!cancel) setHistoryLoading(false);
      }
    };

    loadHistory();
    return () => { cancel = true; };
  }, [availableDates, client]);

  return (
    <ProtectedComponent permissionKey="page:usage" fallback={<AccessDeniedFallback />}>
      <PageHeader title="Usage Administration" description="Métricas reales de Docker por cliente, con histórico diario.">
        <div className="flex flex-wrap items-center gap-2">
          {/* Cliente */}
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

          {/* Fecha */}
          <Select value={date} onValueChange={(v) => setDate(v as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select date..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="live" value="live">Live (ahora)</SelectItem>
              {availableDates.slice().reverse().map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
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
        {/* DASHBOARD: líneas CPU% y RAM% (histórico diario) */}
        {historySeries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {client === 'all' ? 'All Clients' : client} – CPU% y RAM% (últimos snapshots)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                  {/* CPU% */}
                  <Line type="monotone" dataKey="cpu" name="CPU %" yAxisId="left" dot={false} strokeWidth={2} />
                  {/* RAM% */}
                  <Line type="monotone" dataKey="ram" name="RAM %" yAxisId="right" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              {historyLoading && <div className="text-xs text-muted-foreground mt-2">Cargando histórico…</div>}
            </CardContent>
          </Card>
        )}

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
