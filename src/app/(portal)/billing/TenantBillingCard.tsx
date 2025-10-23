// src/app/(portal)/billing/TenantBillingCard.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DollarSign, Users } from 'lucide-react';

type CountRow = {
  tenantId: string;
  tenantName: string;
  users: number;
  management?: { status: string; date: string };
};

type BillingConfig = {
  tenantId: string;
  userPrice: number;
  chatsEnabled: boolean;
  chatsPrice: number;
  managementDate?: string;
  invoiceEmail?: string; // NEW
};

type BillingConfigResponse = BillingConfig;

function formatUSD(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  } catch {
    // Fallback if Intl is unavailable for some reason
    return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
  }
}

export default function TenantBillingCard({
  tenant,
  onAdjust,
}: {
  tenant: CountRow;
  onAdjust?: (tenantId: string) => void;
}) {
  const [cfg, setCfg] = useState<BillingConfig | null>(null);
  const [open, setOpen] = useState(false);

  // Price (string for controlled input)
  const [price, setPrice] = useState<string>('');
  const numPrice = Number(price);
  const priceValid = Number.isFinite(numPrice) && numPrice >= 0;

  // Invoice email
  const [invoiceEmail, setInvoiceEmail] = useState<string>('');
  const emailValid =
    !invoiceEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail);

  const reloadConfig = useCallback(async () => {
    const res = await fetch('/api/billing/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.tenantId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: BillingConfigResponse = await res.json();
    setCfg(data);
    setPrice(String(data.userPrice ?? ''));
    setInvoiceEmail(String(data.invoiceEmail ?? ''));
  }, [tenant.tenantId]);

  useEffect(() => {
    reloadConfig().catch((e) => console.error('Failed to load billing config:', e));
  }, [reloadConfig]);

  const effectiveRate = useMemo(
    () => (cfg?.userPrice ?? 0) + (cfg?.chatsEnabled ? cfg?.chatsPrice ?? 0 : 0),
    [cfg],
  );

  const estimatedTotal = tenant.users * effectiveRate;

  const handleSave = useCallback(async () => {
    if (!priceValid || !emailValid) return;
    await fetch('/api/billing/update-config', {
      // NEW endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.tenantId,
        newUserPrice: numPrice, // upsert USER_PRICE
        invoiceEmail: invoiceEmail || null, // upsert EMAIL_FOR_INVOICE (or clear if null)
      }),
    });
    await reloadConfig();
    setOpen(false);
    onAdjust?.(tenant.tenantId);
  }, [emailValid, invoiceEmail, numPrice, onAdjust, priceValid, reloadConfig, tenant.tenantId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{tenant.tenantName}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">Active Users</span>
          </div>
          <div className="text-base font-semibold">{tenant.users}</div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">Rate per User</span>
          </div>
          <div className="text-base font-semibold">{formatUSD(effectiveRate)}</div>
        </div>

        {cfg?.chatsEnabled && (
          <div className="text-xs text-muted-foreground">
            (Includes <strong>Chats</strong> add-on per user: {formatUSD(Number(cfg.chatsPrice || 0))})
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <div className="text-sm font-medium">Estimated Monthly Total</div>
          <div className="text-lg font-bold">{formatUSD(estimatedTotal)}</div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full mt-2" aria-label="Adjust billing parameters">
              Adjust Billing Parameters
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Billing Parameters</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
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
                  placeholder="e.g., 15 or 14.99"
                />
                {!priceValid && (
                  <p className="text-xs text-destructive">Enter a valid non-negative number.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoice-email">EMAIL_FOR_INVOICE</Label>
                <Input
                  id="invoice-email"
                  type="email"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  placeholder="billing@company.com"
                />
                {!emailValid && (
                  <p className="text-xs text-destructive">Enter a valid email address.</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                <code>USER_PRICE</code> and <code>EMAIL_FOR_INVOICE</code> are persisted to the tenant&apos;s
                environment variables.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!priceValid || !emailValid}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
