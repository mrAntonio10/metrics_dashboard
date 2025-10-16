// src/app/(portal)/HomePageClient.tsx
'use client'

import { useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
// ⛔️ Eliminado: import { TimeRangeFilter } from '@/components/time-range-filter'
import { KpiCard } from '@/components/kpi-card'
import { CreditCard, Users, AlertTriangle } from 'lucide-react'
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

  // ⛔️ Eliminado: const timeRange = '30d' as const

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

          {/* ⛔️ Eliminado: <TimeRangeFilter value={timeRange} onChange={() => {}} /> */}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Users"
            value={String(totalUsers)}
            change={0}
            changePeriod="now"
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

        {/* ⛔️ Eliminado: banner "Direct DB Mode" */}
        {/* 
        <Alert className="bg-primary/10 border-primary/20">
          <AlertTriangle className="h-4 w-4 !text-primary/80" />
          <AlertTitle className="text-primary/90 font-bold">Direct DB Mode</AlertTitle>
          <AlertDescription className="text-primary/80">
            Los datos se cargan server-side leyendo .env.&#123;cliente&#125; y consultando MySQL/RDS sin APIs externas.
          </AlertDescription>
        </Alert>
        */}

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
