'use client'

import { useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { CreditCard, Users, AlertTriangle, CalendarClock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Org = { id: string; name: string }
export type CountRow = {
  tenantId: string
  tenantName: string
  users: number
  clients: number
  admins: number
  providers: number
  management?: { status: string; date: string }
  error?: string
}

export default function HomePageClient({
  orgs,
  counts,
  selectedClient,
}: {
  orgs: Org[]
  counts: CountRow[]
  selectedClient: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleSelectClient = (val: string) => {
    startTransition(() => {
      const params = new URLSearchParams(search.toString())
      if (!val || val === 'all') params.delete('client')
      else params.set('client', val)
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  const filtered = useMemo(
    () => (selectedClient === 'all' ? counts : counts.filter((c) => c.tenantId === selectedClient)),
    [counts, selectedClient],
  )

  const totalUsers = filtered.reduce((a, b) => a + b.users, 0)
  const totalClients = filtered.reduce((a, b) => a + b.clients, 0)
  const totalAdmins = filtered.reduce((a, b) => a + b.admins, 0)
  const totalProviders = filtered.reduce((a, b) => a + b.providers, 0)

  const barData = filtered.map((row) => ({
    name: row.tenantName,
    Users: row.users,
    Clients: row.clients,
    Admins: row.admins,
    Providers: row.providers,
  }))

  const errored = filtered.filter((r) => r.error)

  async function handleStatusChange(tenantId: string, newStatus: string) {
    await fetch('/api/tenants/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, status: newStatus }),
    })
    router.refresh()
  }

  return (
    <ProtectedComponent permissionKey="page:home" fallback={<AccessDeniedFallback />}>
      <PageHeader title="Executive Summary" description="De-identified ops metrics (direct DB).">
        <div className="flex flex-wrap items-center gap-2">
          <Select onValueChange={handleSelectClient} value={selectedClient === 'all' ? undefined : selectedClient}>
            <SelectTrigger className="w-[220px]">
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
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-700 font-bold">Tenants con error</AlertTitle>
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
        {/* KPIs globales */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Users"
            value={String(totalUsers)}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            tooltip="Suma de usuarios por ambiente (consulta directa a BD)."
          />
          <KpiCard
            title="Total Clients"
            value={String(totalClients)}
            change={0}
            changePeriod="now"
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            tooltip="Suma de clientes por ambiente (consulta directa a BD)."
          />
          <KpiCard
            title="Total Admins"
            value={String(totalAdmins)}
            change={0}
            changePeriod="now"
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
            tooltip="Usuarios con type='admin' en providers."
          />
          <KpiCard
            title="Total Providers"
            value={String(totalProviders)}
            change={0}
            changePeriod="now"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            tooltip="Usuarios con type='provider' en providers."
          />
        </div>

        {/* Cards por cliente */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {filtered.map((t) => {
            const status = t.management?.status || ''
            const date = t.management?.date
              ? new Date(`${t.management.date}T00:00:00`) // fuerza interpretación local
              : null
            // 📅 Calcular fecha límite = mismo día del siguiente mes
            const limitDate = date ? new Date(date) : null
            if (limitDate) limitDate.setMonth(limitDate.getMonth() + 1)

            // ⚠️ Determinar expiración
            const expired = status === 'TRIAL' && limitDate && Date.now() >= limitDate.getTime()

            let nextLabel = ''
            let nextStatus = ''
            if (!status) {
              nextLabel = 'Start Trial'
              nextStatus = 'TRIAL'
            } else if (status === 'TRIAL' && expired) {
              nextLabel = 'Activate Subscription'
              nextStatus = 'SUBSCRIBED'
            } else if (status === 'SUBSCRIBED') {
              nextLabel = 'Renew'
              nextStatus = 'SUBSCRIBED'
            }

            const color =
              !status
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : expired
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : status === 'TRIAL'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-green-50 border-green-200 text-green-700'

            const statusText =
              !status
                ? '🆕 NEW CLIENT'
                : expired
                  ? '⚠️ TRIAL EXPIRED'
                  : status === 'TRIAL'
                    ? `⏳ TRIAL (until ${limitDate?.toLocaleDateString()})`
                    : `✅ SUBSCRIBED (renew by ${limitDate?.toLocaleDateString()})`

            return (
              <Card key={t.tenantId} className={`${color}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {t.tenantName}
                    {limitDate && (
                      <span className="flex items-center text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3 mr-1" />
                        {limitDate.toLocaleDateString()}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="text-sm font-semibold">{statusText}</div>
                  {date && (
                    <div className="text-xs text-muted-foreground">
                      Since: {date.toLocaleDateString()}
                    </div>
                  )}
                  {nextLabel && (
                    <button
                      onClick={() => handleStatusChange(t.tenantId, nextStatus)}
                      className="text-sm px-3 py-1 rounded-md bg-primary text-white w-fit hover:opacity-90"
                    >
                      {nextLabel}
                    </button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Chart comparativo */}
        <div className="grid gap-4 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Comparación por Ambiente (Usuarios vs Clientes vs Providers)</CardTitle>
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
  )
}
