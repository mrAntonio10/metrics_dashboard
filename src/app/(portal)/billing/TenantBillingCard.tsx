// src/app/(portal)/billing/TenantBillingCard.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, Users } from 'lucide-react'

type CountRow = {
  tenantId: string; tenantName: string; users: number
  management?: { status: string; date: string }
}

type BillingConfig = {
  tenantId: string
  userPrice: number
  chatsEnabled: boolean
  chatsPrice: number
  managementDate?: string
}

export default function TenantBillingCard({
  tenant, onAdjust,
}: {
  tenant: CountRow
  onAdjust?: (tenantId: string) => void
}) {
  const [cfg, setCfg] = useState<BillingConfig | null>(null)

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/billing/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.tenantId }),
      })
      const data: BillingConfig = await res.json()
      setCfg(data)
    })()
  }, [tenant.tenantId])

  const effectiveRate = useMemo(
    () => (cfg?.userPrice ?? 0) + ((cfg?.chatsEnabled ? (cfg?.chatsPrice ?? 0) : 0)),
    [cfg]
  )
  const estimatedTotal = tenant.users * effectiveRate

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{tenant.tenantName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" /><span className="text-sm">Active Users</span>
          </div>
          <div className="text-base font-semibold">{tenant.users}</div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" /><span className="text-sm">Rate per user</span>
          </div>
          <div className="text-base font-semibold">${effectiveRate.toFixed(2)}</div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="text-sm font-medium">Estimated Monthly Total</div>
          <div className="text-lg font-bold">${estimatedTotal.toFixed(2)}</div>
        </div>

        <Button size="sm" className="w-full mt-2" onClick={() => onAdjust?.(tenant.tenantId)}>
          Adjust Param
        </Button>
      </CardContent>
    </Card>
  )
}
