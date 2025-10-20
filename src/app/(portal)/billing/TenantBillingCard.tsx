// src/app/(portal)/billing/TenantBillingCard.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
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
  const [open, setOpen] = useState(false)

  // campos del diálogo
  const [price, setPrice] = useState<string>('') // permite entero o decimal como texto
  const numPrice = Number(price)
  const priceValid = !Number.isNaN(numPrice) && numPrice >= 0

  // cargar config
  const reloadConfig = async () => {
    const res = await fetch('/api/billing/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.tenantId }),
    })
    const data: BillingConfig = await res.json()
    setCfg(data)
    setPrice(String(data.userPrice ?? ''))
  }

  useEffect(() => { reloadConfig() }, [tenant.tenantId])

  const effectiveRate = useMemo(
    () => (cfg?.userPrice ?? 0) + ((cfg?.chatsEnabled ? (cfg?.chatsPrice ?? 0) : 0)),
    [cfg]
  )
  const estimatedTotal = tenant.users * effectiveRate

  const handleSave = async () => {
    if (!priceValid) return
    await fetch('/api/billing/update-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.tenantId,
        newUserPrice: numPrice,   // ⬅️ crea o actualiza USER_PRICE
      }),
    })
    await reloadConfig()
    setOpen(false)
    onAdjust?.(tenant.tenantId) // opcional: notifica al padre
  }

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

        {cfg?.chatsEnabled && (
          <div className="text-xs text-muted-foreground">
            (Incluye add-on <strong>Chats</strong> por usuario: ${Number(cfg.chatsPrice || 0).toFixed(2)})
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <div className="text-sm font-medium">Estimated Monthly Total</div>
          <div className="text-lg font-bold">${estimatedTotal.toFixed(2)}</div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full mt-2">Adjust Price Param</Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust USER_PRICE</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="user-price">USER_PRICE (USD)</Label>
                <Input
                  id="user-price"
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 15 or 14.99"
                />
                {!priceValid && (
                  <p className="text-xs text-destructive">Enter a valid non-negative number.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Se creará la clave <code>USER_PRICE</code> si no existe. El portal enviará la notificación sólo si el ambiente está activo.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!priceValid}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
