'use client';

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';

import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ProtectedComponent,
  AccessDeniedFallback,
} from '@/hooks/use-permission';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

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
 * Types: Metrics / Docker
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
  client_display?: Record<string, string>;
};

/* =========================
 * Types: AWS / Billing
 * ========================= */

type AwsInstance = {
  instanceId?: string;
  type?: string;
  state?: string;
  name?: string | null;
  launchTime?: string;
  az?: string | null;
};

type AwsPayloadOk = {
  ok: true;
  count: number;
  instances: AwsInstance[];
};

type AwsPayloadError = {
  ok: false;
  error: string;
};

type AwsPayload = AwsPayloadOk | AwsPayloadError;

type AwsBillingService = {
  service: string;
  amount: number;
  unit: string;
};

type AwsBillingOk = {
  ok: true;
  start: string;
  end: string;
  totalUsd: number;
  currency: string;
  topServices: AwsBillingService[];
  allServices: AwsBillingService[];
};

type AwsBillingError = {
  ok: false;
  error: string;
};

type AwsBillingPayload = AwsBillingOk | AwsBillingError;

/* =========================
 * Types: Anthropic Usage
 * ========================= */

type AnthropicUsageRow = {
  executionId: number | string;
  tenant: string;
  inputTokens: number;
  outputTokens: number;
  date: string;
};

/* =========================
 * Format helpers
 * ========================= */

const coalesce = (...vals: (string | null | undefined)[]) =>
  vals.find((v) => !!v && v.trim().length > 0)?.trim() ?? '';

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

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

const fmtDuration = (sec?: number | null) => {
  if (sec == null || sec < 0) return '';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const pickName = (c: Container) => {
  const fromLabel = c.labels?.['com.docker.compose.service'];
  const fromNetworks = Object.values(c.networks ?? {})
    .flatMap((n) => [...(n.DNSNames ?? []), ...(n.Aliases ?? [])])
    .find(Boolean);
  const fromRole =
    c.role && c.client && c.role !== 'unknown'
      ? `vivace-${c.role}-${c.client}`
      : '';
  return coalesce(
    c.name,
    fromLabel,
    fromNetworks,
    fromRole,
    c.id?.slice(0, 12),
  );
};

const pickImage = (c: Container) => coalesce(c.image) || '(unknown)';

const pickStatus = (c: Container) => {
  const s = coalesce(c.status);
  if (s) return s;
  const up = fmtDuration(c.uptime_seconds);
  return up ? `Up ${up}` : '—';
};

const pickPorts = (c: Container) => {
  if (Array.isArray(c.ports) && c.ports.length > 0) {
    const published = [
      ...new Set(
        c.ports
          .filter((p) => p.host_port)
          .map(
            (p) =>
              `${p.host_ip ?? '*'}:${p.host_port} -> ${p.container}`,
          ),
      ),
    ];
    const exposed = [
      ...new Set(
        c.ports
          .filter((p) => !p.host_port)
          .map((p) => p.container),
      ),
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

const resolveClientName = (
  id: string,
  map?: Record<string, string>,
) => {
  if (id === 'all') return 'All Clients';
  return map?.[id] || id;
};

/* Helpers para meses billing */

function getDefaultBillingMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getRecentMonths(count = 12): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
  }
  return out;
}

const formatMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}-${m}`;
};

/* =========================
 * Custom hooks: Usage Dates / Metrics
 * ========================= */

function useUsageDates() {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const res = await fetch('/api/usage/dates', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = await res.json();
        const list: string[] = (j?.dates ?? [])
          .filter(Boolean)
          .sort();
        if (!cancel) setDates(list);
      } catch {
        // noop
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  return dates;
}

function useMetrics(date: 'live' | string) {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      try {
        setLoading(true);
        const url =
          date === 'live'
            ? '/api/usage'
            : `/api/usage?date=${date}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MetricsPayload;
        if (!cancel) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        const err = e as Error;
        if (!cancel) {
          setData(null);
          setError(err.message || 'fetch_failed');
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    load();

    let interval: ReturnType<typeof setInterval> | undefined;
    if (date === 'live') {
      interval = setInterval(load, 10_000);
    }

    return () => {
      cancel = true;
      if (interval) clearInterval(interval);
    };
  }, [date]);

  return { data, loading, error };
}

function useHistorySeries(
  availableDates: string[],
  client: string,
) {
  const [series, setSeries] = useState<
    Array<{ date: string; cpu: number; ram: number }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!availableDates.length) {
      setSeries([]);
      return;
    }

    const lastDates = availableDates.slice(-14);
    let cancel = false;

    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          lastDates.map(async (d) => {
            const res = await fetch(`/api/usage?date=${d}`, {
              cache: 'no-store',
            });
            if (!res.ok) return null;
            const payload =
              (await res.json()) as MetricsPayload;
            return { date: d, payload };
          }),
        );

        if (cancel) return;

        const next = (results || [])
          .filter(
            (
              x,
            ): x is {
              date: string;
              payload: MetricsPayload;
            } => !!x,
          )
          .map(({ date, payload }) => {
            const aggs =
              client === 'all'
                ? payload.client_agg
                : payload.client_agg.filter(
                    (a) => a.client === client,
                  );
            const cpu = aggs.reduce(
              (acc, a) =>
                acc + (a.cpu_percent_sum || 0),
              0,
            );
            const memUsed = aggs.reduce(
              (acc, a) =>
                acc +
                (a.mem_used_bytes_sum || 0),
              0,
            );
            const memLimit = aggs.reduce(
              (acc, a) =>
                acc +
                (a.mem_limit_bytes_sum || 0),
              0,
            );
            const ramPct =
              memLimit > 0
                ? (memUsed / memLimit) * 100
                : 0;

            return {
              date,
              cpu: Number(cpu.toFixed(2)),
              ram: Number(ramPct.toFixed(2)),
            };
          });

        setSeries(next);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [availableDates, client]);

  return { series, loading };
}

/* =========================
 * Custom hooks: AWS
 * ========================= */

function useAwsEc2Summary() {
  const [summary, setSummary] = useState<{
    total: number;
    running: number;
    stopped: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    const fetchAws = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(
          '[AWS][UsagePage] Fetching /api/aws...',
        );
        const res = await fetch('/api/aws', {
          cache: 'no-store',
        });

        if (!res.ok) {
          const text =
            (await res.text().catch(() => '')) ||
            '<sin cuerpo>';
          console.error(
            '[AWS][UsagePage] HTTP error /api/aws:',
            res.status,
            text,
          );
          if (!cancel)
            setError(`HTTP ${res.status}`);
          return;
        }

        const json =
          (await res.json()) as AwsPayload;
        console.log(
          '[AWS][UsagePage] Payload /api/aws:',
          json,
        );

        if (!json.ok) {
          if (!cancel)
            setError(
              json.error ||
                'Unknown AWS error',
            );
          return;
        }

        const instances = json.instances || [];
        const total = instances.length;
        const running = instances.filter(
          (i) => i.state === 'running',
        ).length;
        const stopped = instances.filter(
          (i) => i.state === 'stopped',
        ).length;

        if (!cancel)
          setSummary({ total, running, stopped });
      } catch (e) {
        console.error(
          '[AWS][UsagePage] Error /api/aws:',
          e,
        );
        if (!cancel)
          setError('Failed to fetch AWS EC2');
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    fetchAws();

    return () => {
      cancel = true;
    };
  }, []);

  return { summary, loading, error };
}

function useAwsBilling(month: string) {
  const [data, setData] = useState<AwsBillingOk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!month) return;
    let cancel = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `/api/aws/billing?month=${month}`;
        console.log('[AWS][Billing] Fetching', url);

        const res = await fetch(url, {
          cache: 'no-store',
        });

        if (!res.ok) {
          const text =
            (await res.text().catch(() => '')) ||
            '<sin cuerpo>';
          console.error(
            '[AWS][Billing] HTTP error:',
            res.status,
            text,
          );
          if (!cancel)
            setError(`HTTP ${res.status}`);
          return;
        }

        const json =
          (await res.json()) as AwsBillingPayload;
        console.log(
          '[AWS][Billing] Payload:',
          json,
        );

        if (!json.ok) {
          if (!cancel)
            setError(
              json.error ||
                'Unknown billing error',
            );
          return;
        }

        if (!cancel) setData(json);
      } catch (e) {
        console.error(
          '[AWS][Billing] Error:',
          e,
        );
        if (!cancel)
          setError(
            'Failed to fetch AWS billing',
          );
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    run();

    return () => {
      cancel = true;
    };
  }, [month]);

  return { data, loading, error };
}

/* =========================
 * Custom hooks: Anthropic Usage
 * ========================= */

function useAnthropicUsage() {
  const [rows, setRows] = useState<AnthropicUsageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/anthropic-usage', {
          cache: 'no-store',
        });

        if (!res.ok) {
          const text =
            (await res.text().catch(() => '')) ||
            '<sin cuerpo>';
          console.error(
            '[ANTHROPIC][UsagePage] HTTP error:',
            res.status,
            text,
          );
          if (!cancel)
            setError(`HTTP ${res.status}`);
          return;
        }

        const json = await res.json();

        if (!json.ok) {
          if (!cancel)
            setError(
              json.error ||
                'Anthropic usage error',
            );
          return;
        }

        const list: AnthropicUsageRow[] =
          json.rows || [];

        if (!cancel) {
          setRows(list);
          setError(null);
        }
      } catch (e) {
        console.error(
          '[ANTHROPIC][UsagePage] Error:',
          e,
        );
        if (!cancel)
          setError(
            'Failed to fetch Anthropic usage',
          );
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    load();

    return () => {
      cancel = true;
    };
  }, []);

  return { rows, loading, error };
}

/* =========================
 * Component
 * ========================= */

export default function UsagePage() {
  const [client, setClient] = useState<string>('all');
  const [date, setDate] = useState<'live' | string>('live');
  const [billingMonth, setBillingMonth] = useState<string>(
    getDefaultBillingMonth(),
  );

  const availableDates = useUsageDates();
  const { data, loading, error } = useMetrics(date);
  const {
    series: historySeries,
    loading: historyLoading,
  } = useHistorySeries(availableDates, client);
  const {
    summary: awsSummary,
    loading: awsLoading,
    error: awsError,
  } = useAwsEc2Summary();
  const {
    data: billing,
    loading: billingLoading,
    error: billingError,
  } = useAwsBilling(billingMonth);

  const { rows: anthropicRows, loading: anthropicLoading, error: anthropicError } =
    useAnthropicUsage();

  const [anthropicTenant, setAnthropicTenant] =
    useState<string>('all');
  const [anthropicPage, setAnthropicPage] =
    useState<number>(1);
  const anthropicPageSize = 10;

  const monthOptions = useMemo(
    () => getRecentMonths(12),
    [],
  );

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

  const filteredHistory = useMemo(() => {
    if (date === 'live' || historySeries.length === 0) {
      return historySeries;
    }
    return historySeries.filter((x) => x.date <= date);
  }, [historySeries, date]);

  const anthropicTenants = useMemo(
    () => [
      'all',
      ...Array.from(
        new Set(
          (anthropicRows || [])
            .map((r) => r.tenant)
            .filter(Boolean),
        ),
      ).sort(),
    ],
    [anthropicRows],
  );

  const anthropicFiltered = useMemo(() => {
    const list = (anthropicRows || [])
      .filter(
        (r) =>
          anthropicTenant === 'all' ||
          r.tenant === anthropicTenant,
      )
      .slice()
      .sort((a, b) => {
        const da = new Date(a.date || '').getTime() || 0;
        const db = new Date(b.date || '').getTime() || 0;
        if (db !== da) return db - da;
        const ea = Number(a.executionId) || 0;
        const eb = Number(b.executionId) || 0;
        return eb - ea;
      });

    const totalPages = Math.max(
      1,
      Math.ceil(list.length / anthropicPageSize),
    );
    const current = Math.min(
      anthropicPage || 1,
      totalPages,
    );
    const start = (current - 1) * anthropicPageSize;
    const pageItems = list.slice(
      start,
      start + anthropicPageSize,
    );

    return {
      pageItems,
      totalPages,
      total: list.length,
      currentPage: current,
    };
  }, [
    anthropicRows,
    anthropicTenant,
    anthropicPage,
  ]);

  useEffect(() => {
    // reset a página 1 cuando cambie tenant o dataset
    setAnthropicPage(1);
  }, [anthropicTenant, anthropicRows.length]);

  const onClientChange = useCallback(
    (v: string) => setClient(v),
    [],
  );
  const onDateChange = useCallback(
    (v: string) => setDate(v as 'live' | string),
    [],
  );
  const onBillingMonthChange = useCallback(
    (v: string) => setBillingMonth(v),
    [],
  );
  const onAnthropicTenantChange = useCallback(
    (v: string) => setAnthropicTenant(v),
    [],
  );
  const goAnthropicPrev = useCallback(() => {
    setAnthropicPage((p) => Math.max(1, p - 1));
  }, []);
  const goAnthropicNext = useCallback(() => {
    setAnthropicPage((p) =>
      Math.min(
        p + 1,
        anthropicFiltered.totalPages,
      ),
    );
  }, [anthropicFiltered.totalPages]);

  return (
    <ProtectedComponent
      permissionKey="page:usage"
      fallback={<AccessDeniedFallback />}
    >
      {/* Layout principal en flex, evitando overflow horizontal */}
      <div className="flex min-h-screen flex-col overflow-hidden">
        <div className="px-2 pt-4 md:px-4">
          <PageHeader
            title="Usage Administration"
            description="Per-client Docker metrics, AWS usage, monthly billing, and Anthropic token usage."
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Client filter */}
              <Select
                value={client}
                onValueChange={onClientChange}
              >
                <SelectTrigger
                  className="w-[220px]"
                  aria-label="Filter by client"
                >
                  <SelectValue placeholder="Filter by client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem
                      key={c}
                      value={c}
                    >
                      {resolveClientName(
                        c,
                        data?.client_display,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date selector */}
              <Select
                value={date}
                onValueChange={onDateChange}
              >
                <SelectTrigger
                  className="w-[220px]"
                  aria-label="Select snapshot date"
                >
                  <SelectValue placeholder="Select date..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    key="live"
                    value="live"
                  >
                    Live (now)
                  </SelectItem>
                  {availableDates
                    .slice()
                    .reverse()
                    .map((d) => (
                      <SelectItem
                        key={d}
                        value={d}
                      >
                        {d}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Separator
                orientation="vertical"
                className="hidden h-6 md:block"
              />

              {/* Docker status */}
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

              {/* Latest snapshot date */}
              {availableDates.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Updated:{' '}
                  {
                    availableDates[
                      availableDates.length - 1
                    ]
                  }
                </span>
              )}

              {/* Loading / error */}
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
        </div>

        {/* Contenido scrollable, sin desbordar horizontal */}
        <div className="flex-1 overflow-auto px-2 pb-6 md:px-4">
          <Accordion
            type="multiple"
            defaultValue={['aws', 'anthropic', 'tenants']}
            className="flex flex-col gap-4 max-w-full"
          >
            {/* AWS USAGE & BILLING */}
            <AccordionItem value="aws">
              <AccordionTrigger className="text-lg font-semibold">
                AWS Usage & Billing
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pt-2">
                {/* EC2 Overview */}
                {awsSummary && (
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>
                        AWS EC2 Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-6 text-sm">
                      <div>
                        <div className="text-muted-foreground">
                          Total instances
                        </div>
                        <div className="font-semibold">
                          {awsSummary.total}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Running
                        </div>
                        <div className="font-semibold text-green-600">
                          {awsSummary.running}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Stopped
                        </div>
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

                {/* Billing mensual con month picker */}
                <Card className="w-full">
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>
                        AWS Monthly Billing
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Selecciona un mes para ver el total y los servicios que más consumen.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Month
                      </span>
                      <Select
                        value={billingMonth}
                        onValueChange={onBillingMonthChange}
                      >
                        <SelectTrigger
                          className="w-[130px]"
                          aria-label="Select billing month"
                        >
                          <SelectValue placeholder="YYYY-MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((m) => (
                            <SelectItem key={m} value={m}>
                              {formatMonthLabel(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {billingLoading && (
                      <div className="text-xs text-muted-foreground">
                        Loading billing…
                      </div>
                    )}

                    {billingError && (
                      <div className="text-xs text-destructive">
                        Billing error: {billingError}
                      </div>
                    )}

                    {billing && !billingLoading && !billingError && (
                      <>
                        <div className="flex flex-wrap items-baseline gap-4">
                          <div>
                            <div className="text-muted-foreground text-xs">
                              Period
                            </div>
                            <div className="font-medium">
                              {billing.start} → {billing.end}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">
                              Total billed
                            </div>
                            <div className="text-2xl font-semibold">
                              ${billing.totalUsd.toFixed(2)}{' '}
                              <span className="text-xs font-normal text-muted-foreground">
                                {billing.currency}
                              </span>
                            </div>
                          </div>
                        </div>

                        {billing.topServices?.length > 0 && (
                          <div className="mt-2">
                            <div className="mb-1 text-xs text-muted-foreground">
                              Top services by cost
                            </div>
                            <div className="w-full overflow-x-auto">
                              <Table className="min-w-[320px]">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Service</TableHead>
                                    <TableHead className="text-right">
                                      Amount ({billing.currency})
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {billing.topServices.map((s) => (
                                    <TableRow key={s.service}>
                                      <TableCell>{s.service}</TableCell>
                                      <TableCell className="text-right">
                                        ${fmtNum(s.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {!billing && !billingLoading && !billingError && (
                      <div className="text-xs text-muted-foreground">
                        No billing data for this month.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* ANTHROPIC TOKEN USAGE */}
            <AccordionItem value="anthropic">
              <AccordionTrigger className="text-lg font-semibold">
                Anthropic Token Usage
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pt-2">
                <Card className="w-full">
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>
                        Anthropic Token Usage by Tenant
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Datos obtenidos desde n8n. Filtra por tenant y revisa los tokens consumidos por ejecución.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Tenant
                      </span>
                      <Select
                        value={anthropicTenant}
                        onValueChange={onAnthropicTenantChange}
                      >
                        <SelectTrigger
                          className="w-[220px]"
                          aria-label="Filter Anthropic usage by tenant"
                        >
                          <SelectValue placeholder="All tenants" />
                        </SelectTrigger>
                        <SelectContent>
                          {anthropicTenants.map((t) => (
                            <SelectItem
                              key={t}
                              value={t}
                            >
                              {t === 'all' ? 'All tenants' : t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {anthropicLoading && (
                      <div className="text-xs text-muted-foreground">
                        Loading Anthropic usage…
                      </div>
                    )}

                    {anthropicError && (
                      <div className="text-xs text-destructive">
                        Error: {anthropicError}
                      </div>
                    )}

                    {!anthropicLoading &&
                      !anthropicError &&
                      anthropicFiltered.total === 0 && (
                        <div className="text-xs text-muted-foreground">
                          No Anthropic usage data found.
                        </div>
                      )}

                    {anthropicFiltered.total > 0 && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <div>
                            Total rows:{' '}
                            <span className="font-semibold">
                              {anthropicFiltered.total}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={goAnthropicPrev}
                              disabled={
                                anthropicFiltered.currentPage ===
                                1
                              }
                              className="rounded border px-2 py-1 text-[10px] disabled:opacity-40"
                            >
                              Prev
                            </button>
                            <span>
                              Page{' '}
                              <span className="font-semibold">
                                {anthropicFiltered.currentPage}
                              </span>{' '}
                              /{' '}
                              {anthropicFiltered.totalPages}
                            </span>
                            <button
                              type="button"
                              onClick={goAnthropicNext}
                              disabled={
                                anthropicFiltered.currentPage ===
                                anthropicFiltered.totalPages
                              }
                              className="rounded border px-2 py-1 text-[10px] disabled:opacity-40"
                            >
                              Next
                            </button>
                          </div>
                        </div>

                        <div className="w-full overflow-x-auto">
                          <Table className="min-w-[720px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>
                                  EXECUTION_ID
                                </TableHead>
                                <TableHead>
                                  TENANT
                                </TableHead>
                                <TableHead className="text-right">
                                  INPUT
                                </TableHead>
                                <TableHead className="text-right">
                                  OUTPUT
                                </TableHead>
                                <TableHead>
                                  DATE
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {anthropicFiltered.pageItems.map(
                                (row) => (
                                  <TableRow
                                    key={`${row.executionId}-${row.tenant}-${row.date}`}
                                  >
                                    <TableCell className="font-mono text-xs">
                                      {row.executionId}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">
                                        {row.tenant}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {fmtNum(
                                        row.inputTokens,
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {fmtNum(
                                        row.outputTokens,
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {row.date ||
                                        '—'}
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* TENANTS USAGE */}
            <AccordionItem value="tenants">
              <AccordionTrigger className="text-lg font-semibold">
                Tenants Usage
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pt-2">
                {/* Historical CPU/RAM */}
                {historySeries.length > 0 && (
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>
                        {resolveClientName(
                          client,
                          data?.client_display,
                        )}{' '}
                        – CPU% and RAM% (latest snapshots)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[320px] w-full overflow-x-auto">
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
                      </div>
                      {historyLoading && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Loading history…
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Client aggregates */}
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle>
                      Client Aggregates
                    </CardTitle>
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

                {/* Containers table */}
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle>
                      Containers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[900px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              Container
                            </TableHead>
                            <TableHead>
                              Client
                            </TableHead>
                            <TableHead>
                              Role
                            </TableHead>
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
                            <TableHead>
                              Ports
                            </TableHead>
                            <TableHead>
                              Status
                            </TableHead>
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
                                <TableCell>
                                  {c.role}
                                </TableCell>
                                <TableCell className="text-right">
                                  {fmtNum(
                                    c.stats
                                      .cpu_percent,
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
                                  {
                                    c
                                      .stats
                                      .pids
                                  }
                                </TableCell>
                                <TableCell
                                  className="max-w-[320px] truncate"
                                  title={pickPorts(
                                    c,
                                  )}
                                >
                                  {pickPorts(
                                    c,
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs">
                                    {pickStatus(
                                      c,
                                    )}
                                  </span>
                                  {c.tls
                                    .exposes_443 && (
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
                          {visibleContainers.length ===
                            0 && (
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
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </ProtectedComponent>
  );
}
