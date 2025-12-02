'use client';

import {
  useMemo,
  useTransition,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { CreditCard, Users, AlertTriangle, CalendarClock, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { getAmplifyInfoForTenant } from '../../lib/tenantAmplifyWhiteList';

export type Org = { id: string; name: string };

export type CountRow = {
  tenantId: string;
  tenantName: string;
  users: number;
  clients: number;
  admins: number;
  providers: number;
  management?: { status: string; date: string }; // date expected as YYYY-MM-DD (local)
  error?: string;
};

type ManagementStatus = 'TRIAL' | 'SUBSCRIBED' | '' | undefined;

/** Docker status types (respuesta esperada de /api/tenants/status) */
type TenantStatusOverall = 'up' | 'down' | 'missing';
type TenantContainerStatus = {
  name: string;
  rawStatus: string;
  isUp: boolean;
};
type TenantStatus = {
  tenantId: string;
  tenantName: string;
  overall: TenantStatusOverall;
  containers: TenantContainerStatus[];
};

/** Utilities de fechas */
function parseLocalDateFromYMD(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addOneMonth(date: Date | null): Date | null {
  if (!date) return null;
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function formatLocal(d: Date | null): string | undefined {
  if (!d) return undefined;
  try {
    return d.toLocaleDateString();
  } catch {
    return undefined;
  }
}

/** Helpers para UI de cada tenant card */
type CardTone =
  | 'bg-yellow-50 border-yellow-200 text-yellow-700'
  | 'bg-red-50 border-red-200 text-red-700'
  | 'bg-green-50 border-green-200 text-green-700'
  | 'bg-blue-50 border-blue-200 text-blue-700';

type CtaInfo = {
  label: string;
  nextStatus: ManagementStatus;
};

function getCardTone(
  sinceDate: Date | null,
  isExpired: boolean,
  status: ManagementStatus,
): CardTone {
  if (!sinceDate) return 'bg-yellow-50 border-yellow-200 text-yellow-700';
  if (isExpired) return 'bg-red-50 border-red-200 text-red-700';
  if (status === 'SUBSCRIBED') {
    return 'bg-green-50 border-green-200 text-green-700';
  }
  return 'bg-blue-50 border-blue-200 text-blue-700';
}

function getStatusText(
  sinceDate: Date | null,
  renewalDate: Date | null,
  isExpired: boolean,
  status: ManagementStatus,
): string {
  if (!sinceDate) return '🆕 NEW CLIENT';

  if (isExpired && status === 'SUBSCRIBED') {
    return '⚠️ SUBSCRIPTION EXPIRED (renew now)';
  }
  if (isExpired) {
    return '⚠️ TRIAL EXPIRED';
  }
  if (status === 'SUBSCRIBED') {
    return `✅ SUBSCRIBED (renew by ${formatLocal(renewalDate) ?? 'N/A'})`;
  }
  return `⏳ TRIAL (until ${formatLocal(renewalDate) ?? 'N/A'})`;
}

function getCtaInfo(
  sinceDate: Date | null,
  isExpired: boolean,
  status: ManagementStatus,
): CtaInfo | null {
  // 1) Nunca configurado -> cliente nuevo
  if (!sinceDate) {
    return { label: 'Start Trial', nextStatus: 'TRIAL' };
  }

  // 2) Expirado (trial o sub)
  if (isExpired) {
    if (status === 'SUBSCRIBED') {
      return { label: 'Renew', nextStatus: 'SUBSCRIBED' };
    }
    return { label: 'Activate Subscription', nextStatus: 'SUBSCRIBED' };
  }

  // 3) Activo (no expirado)
  if (status === 'SUBSCRIBED') {
    return { label: 'Renew', nextStatus: 'SUBSCRIBED' };
  }
  return { label: 'Activate Subscription', nextStatus: 'SUBSCRIBED' };
}

function getDockerUiState(docker?: TenantStatus) {
  if (!docker) {
    return {
      label: 'Unknown',
      className: 'bg-slate-100 text-slate-600',
      isRunning: false,
    };
  }

  if (docker.overall === 'up') {
    return {
      label: 'Running',
      className: 'bg-emerald-50 text-emerald-700',
      isRunning: true,
    };
  }

  if (docker.overall === 'down') {
    return {
      label: 'Stopped / Partial',
      className: 'bg-rose-50 text-rose-700',
      isRunning: false,
    };
  }

  return {
    label: 'Not deployed',
    className: 'bg-slate-100 text-slate-600',
    isRunning: false,
  };
}

/** APIs internas */
const TENANT_STATUS_API = '/api/tenants/status';
const TENANT_UPDATE_API = '/api/tenants/update';
const TENANT_DEPLOY_API = '/api/tenants/deploy';

export default function HomePageClient({
  orgs,
  counts,
  selectedClient,
}: {
  orgs: Org[];
  counts: CountRow[];
  selectedClient: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  /** Estado docker por tenant */
  const [statuses, setStatuses] = useState<Record<string, TenantStatus>>({});
  const [deploying, setDeploying] = useState<string | null>(null);

  // 🔍 Texto de búsqueda para CLIENTS
  const [clientSearch, setClientSearch] = useState(
    selectedClient === 'all'
      ? ''
      : orgs.find((o) => o.id === selectedClient)?.name ?? '',
  );

  // Estado de apertura del dropdown + ref para click outside
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement | null>(null);

  /** Sincronizar input con selectedClient */
  useEffect(() => {
    if (selectedClient === 'all') {
      setClientSearch('');
    } else {
      const org = orgs.find((o) => o.id === selectedClient);
      setClientSearch(org?.name ?? '');
    }
  }, [selectedClient, orgs]);

  /** Cerrar dropdown al hacer click fuera */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientBoxRef.current && !clientBoxRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectClient = useCallback(
    (val: string) => {
      startTransition(() => {
        const params = new URLSearchParams(search.toString());
        if (!val || val === 'all') params.delete('client');
        else params.set('client', val);
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, search],
  );

  /** Orgs filtrados por el texto de búsqueda */
  const filteredOrgsBySearch = useMemo(() => {
    if (!clientSearch.trim()) return orgs;
    const q = clientSearch.toLowerCase();
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, clientSearch]);

  /** Tenants filtrados por selectedClient */
  const filtered = useMemo(
    () =>
      selectedClient === 'all'
        ? counts
        : counts.filter((c) => c.tenantId === selectedClient),
    [counts, selectedClient],
  );

  /** KPIs globales */
  const totalUsers = filtered.reduce((a, b) => a + b.users, 0);
  const totalClients = filtered.reduce((a, b) => a + b.clients, 0);
  const totalAdmins = filtered.reduce((a, b) => a + b.admins, 0);
  const totalProviders = filtered.reduce((a, b) => a + b.providers, 0);

  const barData = filtered.map((row) => ({
    name: row.tenantName,
    Users: row.users,
    Clients: row.clients,
    Admins: row.admins,
    Providers: row.providers,
  }));

  const errored = filtered.filter((r) => r.error);

  /** Cargar estado docker una vez al montar */
  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch(TENANT_STATUS_API, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, TenantStatus> = {};
      for (const item of data.items || []) {
        map[item.tenantId] = item as TenantStatus;
      }
      setStatuses(map);
    } catch (e) {
      console.error('Failed to load tenant statuses', e);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const refreshStatuses = useCallback(async () => {
    await loadStatuses();
  }, [loadStatuses]);

  /** Cambiar status de trial/subscription */
  const handleStatusChange = useCallback(
    async (tenantId: string, newStatus: ManagementStatus) => {
      await fetch(TENANT_UPDATE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: newStatus }),
      });
      startTransition(() => router.refresh());
    },
    [router],
  );

  /** Disparar deploy via n8n (API interna) */
  const handleDeployTenant = useCallback(
    async (tenantId: string) => {
      try {
        setDeploying(tenantId);
        const res = await fetch(TENANT_DEPLOY_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        });
        const json = await res.json().catch(() => ({}));
        console.log('Deploy response', json);
        await refreshStatuses();
      } catch (e) {
        console.error('Failed to trigger deploy', e);
      } finally {
        setDeploying(null);
      }
    },
    [refreshStatuses],
  );

  return (
    <ProtectedComponent permissionKey="page:home" fallback={<AccessDeniedFallback />}>
      <PageHeader title="Executive Summary" description="De-identified ops metrics (direct DB).">
        <div className="flex flex-wrap items-center gap-2">
          {/* 🔍 INPUT TEXT SEARCH */}
          <div ref={clientBoxRef} className="relative w-[260px]">
            <Input
              aria-busy={isPending}
              placeholder="Search client…"
              value={clientSearch}
              onFocus={() => setClientDropdownOpen(true)}
              onChange={(e) => {
                const value = e.target.value;
                setClientSearch(value);
                setClientDropdownOpen(true);
                if (!value) {
                  handleSelectClient('all');
                }
              }}
            />
            {clientDropdownOpen && filteredOrgsBySearch.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md">
                <button
                  type="button"
                  className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setClientSearch('');
                    handleSelectClient('all');
                    setClientDropdownOpen(false);
                  }}
                >
                  All Clients
                </button>
                {filteredOrgsBySearch.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setClientSearch(org.name);
                      handleSelectClient(org.id);
                      setClientDropdownOpen(false);
                    }}
                  >
                    {org.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {errored.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
          <AlertTitle className="text-red-700 font-bold">Tenants with errors</AlertTitle>
          <AlertDescription className="text-red-700">
            {errored.map((e) => (
              <div key={e.tenantId}>
                <strong>{e.tenantName}:</strong> {e.error}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Global KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Users"
            value={String(totalUsers)}
            icon={<Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            tooltip="Sum of users per tenant (direct DB query)."
          />
          <KpiCard
            title="Total Clients"
            value={String(totalClients)}
            change={0}
            changePeriod="now"
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            tooltip="Sum of clients per tenant (direct DB query)."
          />
          <KpiCard
            title="Total Admins"
            value={String(totalAdmins)}
            change={0}
            changePeriod="now"
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            tooltip="Users with type='admin' in providers."
          />
          <KpiCard
            title="Total Providers"
            value={String(totalProviders)}
            change={0}
            changePeriod="now"
            icon={<Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            tooltip="Users with type='provider' in providers."
          />
        </div>

        {/* Per-tenant cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {filtered.map((t) => {
            const status = (t.management?.status as ManagementStatus) || '';
            const sinceDate = parseLocalDateFromYMD(t.management?.date || null);
            const renewalDate = addOneMonth(sinceDate);
            const now = Date.now();
            const isExpired = !!renewalDate && now >= renewalDate.getTime();

            const cardTone = getCardTone(sinceDate, isExpired, status);
            const statusText = getStatusText(sinceDate, renewalDate, isExpired, status);
            const cta = getCtaInfo(sinceDate, isExpired, status);

            const docker = statuses[t.tenantId];
            const { label: dockerLabel, className: dockerClass, isRunning } = getDockerUiState(docker);

            const amplifyInfo = getAmplifyInfoForTenant(t.tenantId, t.tenantName);


            return (
              <Card key={t.tenantId} className={cardTone}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {t.tenantName}
                    {renewalDate && (
                      <span className="flex items-center text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3 mr-1" aria-hidden="true" />
                        {formatLocal(renewalDate)}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="text-sm font-semibold">{statusText}</div>
                  {sinceDate && (
                    <div className="text-xs text-muted-foreground">
                      Since: {formatLocal(sinceDate)}
                    </div>
                  )}

                  {/* Docker status + Deploy */}
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${dockerClass}`}>
                      Docker: {dockerLabel}
                    </span>
                    {!isRunning && (
                      <button
                        onClick={() => handleDeployTenant(t.tenantId)}
                        disabled={deploying === t.tenantId}
                        className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-[10px] hover:bg-blue-700 disabled:opacity-60"
                      >
                        {deploying === t.tenantId ? 'Deploying…' : 'Deploy Tenant'}
                      </button>
                    )}
                  </div>

                  {/* CTA de trial/subscription */}
                  {cta && (
                    <button
                      onClick={() => handleStatusChange(t.tenantId, cta.nextStatus)}
                      className="mt-2 text-sm px-3 py-1 rounded-md bg-primary text-white w-fit hover:opacity-90"
                    >
                      {cta.label}
                    </button>
                  )}

                  {/* Botón para abrir app de Amplify si está whitelisteado */}
                  {amplifyInfo && (
                    <a
                      href={amplifyInfo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-slate-900 text-white w-fit hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      {amplifyInfo.label}
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparison chart */}
        <div className="grid gap-4 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Comparison (Users · Clients · Providers)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-64">
                <BarChart data={barData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="Users" radius={4} fill="var(--color-chart-1)" />
                  <Bar dataKey="Clients" radius={4} fill="var(--color-chart-2)" />
                  <Bar dataKey="Admins" radius={4} fill="var(--color-chart-4)" />
                  <Bar dataKey="Providers" radius={4} fill="var(--color-chart-3)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedComponent>
  );
}
