// src/app/(portal)/usage/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

/* =========================
 * Types
 * ========================= */

type PortBinding = {
  container: string;
  host_ip: string | null;
  host_port: string | null;
};

type DockerNetwork = {
  IPAddress?: string;
  DNSNames?: string[] | null;
  Aliases?: string[] | null;
};

type Container = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports_list: string;
  ports?: PortBinding[];
  client: string;
  role: string;
  tls: { exposes_443: boolean };
  started_at: string;
  uptime_seconds: number | null;
  labels?: Record<string, string>;
  networks?: Record<string, DockerNetwork>;
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
  client_display?: Record<string, string>; // { rawClientKey: displayName }
};

type AwsInstance = {
  instanceId?: string;
  type?: string;
  state?: string;
  name?: string | null;
  launchTime?: string;
  az?: string | null;
};

type AwsPayload =
  | {
    ok: true;
    count: number;
    instances: AwsInstance[];
  }
  | {
    ok: false;
    error: string;
  };

/* =========================
 * Format helpers
 * ========================= */

const labelHasAny = (labels: Record<string, string> | undefined, prefixes: string[]) => {
  if (!labels) return false;
  const keys = Object.keys(labels);
  return keys.some((k) => prefixes.some((p) => k.startsWith(p)));
};

const pickPorts = (c: Container) => {
  if (Array.isArray(c.ports) && c.ports.length > 0) {
    const published = [
      ...new Set(
        c.ports
          .filter((p) => p.host_port)
          .map((p) => `${p.host_ip ?? '*'}:${p.host_port} -> ${p.container}`),
      ),
    ];
    const exposed = [
      ...new Set(c.ports.filter((p) => !p.host_port).map((p) => p.container)),
    ];
    if (published.length && exposed.length) {
      return `${published.join(', ')} (exposed: ${exposed.join(', ')})`;
    }
    if (published.length) return published.join(', ');
    if (exposed.length) return exposed.join(', ');
  }
  const raw = (c.ports_list ?? '').trim();
  return raw || '—';
};

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

const fmtBytes = (bytes: number) => {
  const b = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(b || 1) / Math.log(1024)),
    units.length - 1,
  );
  const val = b / Math.pow(1024, i);
  return `${fmtNum(val)} ${units[i]}`;
};

const percent = (num: number, den: number) => {
  if (!den || den <= 0) return '0%';
  return `${fmtNum((num / den) * 100)}%`;
};

const coalesce = (...vals: (string | undefined | null)[]) =>
  vals.find((v) => !!v && v.trim().length > 0)?.trim() ?? '';

const fmtDuration = (sec?: number | null) => {
  if (sec == null || sec < 0) return '';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/* =========================
 * Snapshot fallbacks
 * ========================= */

const pickName = (c: Container) => {
  const fromLabel = c.labels?.['com.docker.compose.service'];
  const fromNetworks = Object.values(c.networks ?? {})
    .flatMap((n) => [...(n.DNSNames ?? []), ...(n.Aliases ?? [])])
    .find(Boolean);
  const fromRole =
    c.role && c.client && c.role !== 'unknown'
      ? `vivace-${c.role}-${c.client}`
      : '';
  return coalesce(c.name, fromLabel, fromNetworks, fromRole, c.id?.slice(0, 12));
};

const pickImage = (c: Container) => coalesce(c.image) || '(unknown)';

const pickStatus = (c: Container) => {
  const s = coalesce(c.status);
  if (s) return s;
  const up = fmtDuration(c.uptime_seconds);
  return up ? `Up ${up}` : '—';
};

/* =========================
 * Client display helper
 * ========================= */

const resolveClientName = (id: string, map?: Record<string, string>) => {
  if (id === 'all') return 'All Clients';
  return map?.[id] || id;
};

/* =========================
 * Component
 * ========================= */

export default function UsagePage() {
  const [client, setClient] = useState<string>('all');
  const [date, setDate] = useState<'live' | string>('live');

  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySeries, setHistorySeries] = useState<
    Array<{ date: string; cpu: number; ram: number }>
  >([]);

  // AWS state (opcional, además de logs en consola)
  const [awsLoading, setAwsLoading] = useState(false);
  const [awsError, setAwsError] = useState<string | null>(null);
  const [awsSummary, setAwsSummary] = useState<{
    total: number;
    running: number;
    stopped: number;
  } | null>(null);

  /* =========================
   * Fetch AWS (/aws)
   * ========================= */

  useEffect(() => {
    const fetchAwsData = async () => {
      try {
        setAwsLoading(true);
        setAwsError(null);

        console.log('[AWS][UsagePage] Fetching /aws...');
        const res = await fetch('/api/aws', { cache: 'no-store' });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error(
            '[AWS][UsagePage] Error HTTP al consultar /aws:',
            res.status,
            text || '<sin cuerpo>',
          );
          setAwsError(`HTTP ${res.status}`);
          return;
        }

        const json = (await res.json()) as AwsPayload;
        console.log('[AWS][UsagePage] Payload desde /aws:', json);

        if (!json.ok) {
          setAwsError(json.error ?? 'Unknown AWS error');
          return;
        }

        const instances = json.instances ?? [];
        const total = instances.length;
        const running = instances.filter(
          (i) => i.state === 'running',
        ).length;
        const stopped = instances.filter(
          (i) => i.state === 'stopped',
        ).length;

        setAwsSummary({ total, running, stopped });
      } catch (err) {
        console.error('[AWS][UsagePage] Error al llamar /aws:', err);
        setAwsError('Failed to fetch AWS data');
      } finally {
        setAwsLoading(false);
      }
    };

    fetchAwsData();
  }, []);

  /* =========================
   * Available dates
   * ========================= */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch('/api/usage/dates', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const dates: string[] = (j?.dates ?? []).filter(Boolean).sort();
        if (alive) setAvailableDates(dates);
      } catch {
        // noop
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* =========================
   * Load metrics (live or snapshot)
   * ========================= */

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const url =
          date === 'live' ? '/api/usage' : `/api/usage?date=${date}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MetricsPayload;
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (e: unknown) {
        const err = e as Error;
        if (alive) {
          setError(err?.message ?? 'fetch_failed');
          setData(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    let id: ReturnType<typeof setInterval> | undefined;
    if (date === 'live') {
      id = setInterval(load, 10_000);
    }

    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
  }, [date]);

  /* =========================
   * Derived data
   * ========================= */

  const clients = useMemo(
    () => ['all', ...(data?.clients ?? [])],
    [data],
  );

  const selectedAgg = useMemo(() => {
    if (!data) return [];
    return client === 'all'
      ? data.client_agg
      : data.client_agg.filter((a) => a.client === client);
  }, [data, client]);

  const visibleContainers = useMemo<Container[]>(() => {
    if (!data) return [];
    const list =
      client === 'all'
        ? data.containers
        : data.containers.filter((c) => c.client === client);
    return list.slice().sort((a, b) => {
      const ca = a.client.localeCompare(b.client);
      if (ca !== 0) return ca;
      const ra = a.role.localeCompare(b.role);
      if (ra !== 0) return ra;
      return pickName(a).localeCompare(pickName(b));
    });
  }, [data, client]);

  /* =========================
   * Historical CPU/RAM series
   * ========================= */

  useEffect(() => {
    if (availableDates.length === 0) {
      setHistorySeries([]);
      return;
    }

    const lastDates = availableDates.slice(-14);
    let cancel = false;

    (async () => {
      setHistoryLoading(true);
      try {
        const results = await Promise.all(
          lastDates.map(async (d) => {
            const r = await fetch(`/api/usage?date=${d}`, {
              cache: 'no-store',
            });
            if (!r.ok) return null;
            const j = (await r.json()) as MetricsPayload;
            return { date: d, payload: j };
          }),
        );

        if (cancel) return;

        const series = results
          .filter(
            (
              x,
            ): x is { date: string; payload: MetricsPayload } => !!x,
          )
          .map(({ date, payload }) => {
            const aggs =
              client === 'all'
                ? payload.client_agg
                : payload.client_agg.filter(
                  (a) => a.client === client,
                );
            const cpu = aggs.reduce(
              (acc, a) => acc + (a.cpu_percent_sum || 0),
              0,
            );
            const memUsed = aggs.reduce(
              (acc, a) => acc + (a.mem_used_bytes_sum || 0),
              0,
            );
            const memLimit = aggs.reduce(
              (acc, a) => acc + (a.mem_limit_bytes_sum || 0),
              0,
            );
            const ramPct =
              memLimit > 0 ? (memUsed / memLimit) * 100 : 0;
            return {
              date,
              cpu: Number(cpu.toFixed(2)),
              ram: Number(ramPct.toFixed(2)),
            };
          });

        setHistorySeries(series);
      } finally {
        if (!cancel) setHistoryLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [availableDates, client]);

  const filteredHistory = useMemo(() => {
    if (date === 'live' || historySeries.length === 0) {
      return historySeries;
    }
    return historySeries.filter((x) => x.date <= date);
  }, [historySeries, date]);

  /* =========================
   * Handlers
   * ========================= */

  const onClientChange = useCallback((v: string) => setClient(v), []);
  const onDateChange = useCallback(
    (v: string) => setDate(v as 'live' | string),
    [],
  );

  /* =========================
   * Render
   * ========================= */

  return (
    <ProtectedComponent
      permissionKey="page:usage"
      fallback={<AccessDeniedFallback />}
    >
      <PageHeader
        title="Usage Administration"
        description="Per-client Docker metrics with a daily snapshot history."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={client} onValueChange={onClientChange}>
            <SelectTrigger
              className="w-[220px]"
              aria-label="Filter by client"
            >
              <SelectValue placeholder="Filter by client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c} value={c}>
                  {resolveClientName(c, data?.client_display)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={date} onValueChange={onDateChange}>
            <SelectTrigger
              className="w-[220px]"
              aria-label="Select snapshot date"
            >
              <SelectValue placeholder="Select date..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="live" value="live">
                Live (now)
              </SelectItem>
              {availableDates
                .slice()
                .reverse()
                .map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Separator
            orientation="vertical"
            className="h-6"
          />

          {data?.docker?.running ? (
            <Badge
              variant="outline"
              className="border-green-500/50 text-green-600"
            >
              Docker OK ({data.docker.server_version})
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-red-500/50 text-red-600"
            >
              Docker DOWN
            </Badge>
          )}

          {availableDates.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Updated: {availableDates[availableDates.length - 1]}
            </span>
          )}

          {loading && (
            <span className="text-xs text-muted-foreground">
              Loading…
            </span>
          )}
          {error && (
            <span className="text-xs text-destructive">
              Error: {error}
            </span>
          )}
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* AWS EC2 summary (opcional, basado en /aws) */}
        {awsSummary && (
          <Card>
            <CardHeader>
              <CardTitle>AWS EC2 Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-muted-foreground">Total instances</div>
                <div className="font-semibold">
                  {awsSummary.total}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Running</div>
                <div className="font-semibold text-green-600">
                  {awsSummary.running}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Stopped</div>
                <div className="font-semibold text-red-600">
                  {awsSummary.stopped}
                </div>
              </div>
              {awsLoading && (
                <div className="text-xs text-muted-foreground">
                  Loading AWS…
                </div>
              )}
              {awsError && (
                <div className="text-xs text-destructive">
                  AWS error: {awsError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {historySeries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {resolveClientName(
                  client,
                  data?.client_display,
                )}{' '}
                – CPU% and RAM% (latest snapshots)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart data={filteredHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 'auto']}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 'auto']}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip
                    formatter={(v: unknown) => `${v}%`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    name="CPU %"
                    yAxisId="left"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="ram"
                    name="RAM %"
                    yAxisId="right"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
              {historyLoading && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Loading history…
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Client Aggregates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedAgg.map((a) => {
              const memPct = percent(
                a.mem_used_bytes_sum,
                a.mem_limit_bytes_sum,
              );
              return (
                <div
                  key={a.client}
                  className="space-y-2 rounded-xl border p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {resolveClientName(
                        a.client,
                        data?.client_display,
                      )}
                    </div>
                    <Badge variant="outline">
                      {a.containers} containers
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">
                        CPU (sum)
                      </div>
                      <div className="font-medium">
                        {fmtNum(a.cpu_percent_sum)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        RAM
                      </div>
                      <div className="font-medium">
                        {fmtBytes(
                          a.mem_used_bytes_sum,
                        )}{' '}
                        /{' '}
                        {fmtBytes(
                          a.mem_limit_bytes_sum,
                        )}{' '}
                        ({memPct})
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Net RX
                      </div>
                      <div className="font-medium">
                        {fmtBytes(
                          a.net_rx_bytes_sum,
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Net TX
                      </div>
                      <div className="font-medium">
                        {fmtBytes(
                          a.net_tx_bytes_sum,
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedAgg.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">
                    CPU%
                  </TableHead>
                  <TableHead className="text-right">
                    RAM
                  </TableHead>
                  <TableHead className="text-right">
                    Net RX / TX
                  </TableHead>
                  <TableHead className="text-right">
                    PIDs
                  </TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContainers.map((c) => {
                  const ram = `${fmtBytes(
                    c.stats.mem_used_bytes,
                  )} / ${fmtBytes(
                    c.stats.mem_limit_bytes,
                  )} (${fmtNum(
                    c.stats.mem_percent,
                  )}%)`;
                  const net = `${fmtBytes(
                    c.stats.net_rx_bytes,
                  )} / ${fmtBytes(
                    c.stats.net_tx_bytes,
                  )}`;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {pickName(c)}
                        <div className="text-[10px] text-muted-foreground">
                          {pickImage(c)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {resolveClientName(
                            c.client,
                            data?.client_display,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.role}</TableCell>
                      <TableCell className="text-right">
                        {fmtNum(
                          c.stats.cpu_percent,
                        )}
                        %
                      </TableCell>
                      <TableCell className="text-right">
                        {ram}
                      </TableCell>
                      <TableCell className="text-right">
                        {net}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.stats.pids}
                      </TableCell>
                      <TableCell
                        className="max-w-[320px] truncate"
                        title={pickPorts(c)}
                      >
                        {pickPorts(c)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {pickStatus(c)}
                        </span>
                        {c.tls.exposes_443 && (
                          <Badge
                            className="ml-2"
                            variant="outline"
                          >
                            TLS/443
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visibleContainers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-sm text-muted-foreground"
                    >
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
