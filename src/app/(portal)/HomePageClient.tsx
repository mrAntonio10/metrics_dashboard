'use client';

import { useMemo, useTransition, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { CreditCard, Users, AlertTriangle, CalendarClock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

/** Utilities */
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

  const handleSelectClient = (val: string) => {
    startTransition(() => {
      const params = new URLSearchParams(search.toString());
      if (!val || val === 'all') params.delete('client');
      else params.set('client', val);
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const filtered = useMemo(
    () => (selectedClient === 'all' ? counts : counts.filter((c) => c.tenantId === selectedClient)),
    [counts, selectedClient],
  );

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
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/tenants/status', { cache: 'no-store' });
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
    };
    load();
  }, []);

  const refreshStatuses = async () => {
    try {
      const res = await fetch('/api/tenants/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, TenantStatus> = {};
      for (const item of data.items || []) {
        map[item.tenantId] = item as TenantStatus;
      }
      setStatuses(map);
    } catch (e) {
      console.error('Failed to refresh tenant statuses', e);
    }
  };

  /** Cambiar status de trial/subscription (ya lo tenías) */
  async function handleStatusChange(tenantId: string, newStatus: ManagementStatus) {
    await fetch('/api/tenants/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, status: newStatus }),
    });
    startTransition(() => router.refresh());
  }

  /** Disparar deploy via n8n (API interna) */
  const handleDeployTenant = async (tenantId: string) => {
    try {
      setDeploying(tenantId);
      const res = await fetch('/api/tenants/deploy', {
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
  };

  return (
    <ProtectedComponent permissionKey="page:home" fallback={<AccessDeniedFallback />}>
      <PageHeader title="Executive Summary" description="De-identified ops metrics (direct DB).">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            onValueChange={handleSelectClient}
            value={selectedClient === 'all' ? undefined : selectedClient}
          >
            <SelectTrigger className="w-[220px]" aria-busy={isPending}>
              <SelectValue
                placeholder={
                  selectedClient === 'all'
                    ? 'All Clients'
                    : orgs.find((o) => o.id === selectedClient)?.name || 'All Clients'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

            const isExpired = status === 'TRIAL' && renewalDate && Date.now() >= renewalDate.getTime();

            let ctaLabel = '';
            let ctaNextStatus: ManagementStatus = undefined;

            if (!status) {
              ctaLabel = 'Start Trial';
              ctaNextStatus = 'TRIAL';
            } else if (status === 'TRIAL' && isExpired) {
              ctaLabel = 'Activate Subscription';
              ctaNextStatus = 'SUBSCRIBED';
            } else if (status === 'SUBSCRIBED') {
              ctaLabel = 'Renew';
              ctaNextStatus = 'SUBSCRIBED';
            }

            const cardTone =
              !status
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : isExpired
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : status === 'TRIAL'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-green-50 border-green-200 text-green-700';

            const statusText =
              !status
                ? '🆕 NEW CLIENT'
                : isExpired
                  ? '⚠️ TRIAL EXPIRED'
                  : status === 'TRIAL'
                    ? `⏳ TRIAL (until ${formatLocal(renewalDate) ?? 'N/A'})`
                    : `✅ SUBSCRIBED (renew by ${formatLocal(renewalDate) ?? 'N/A'})`;

            const docker = statuses[t.tenantId];
            const isRunning = docker?.overall === 'up';

            let dockerLabel = 'Unknown';
            let dockerClass = 'bg-slate-100 text-slate-600';

            if (docker) {
              if (docker.overall === 'up') {
                dockerLabel = 'Running';
                dockerClass = 'bg-emerald-50 text-emerald-700';
              } else if (docker.overall === 'down') {
                dockerLabel = 'Stopped / Partial';
                dockerClass = 'bg-rose-50 text-rose-700';
              } else {
                dockerLabel = 'Not deployed';
                dockerClass = 'bg-slate-100 text-slate-600';
              }
            }

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

                  {ctaLabel && ctaNextStatus && (
                    <button
                      onClick={() => handleStatusChange(t.tenantId, ctaNextStatus)}
                      className="mt-2 text-sm px-3 py-1 rounded-md bg-primary text-white w-fit hover:opacity-90"
                    >
                      {ctaLabel}
                    </button>
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
