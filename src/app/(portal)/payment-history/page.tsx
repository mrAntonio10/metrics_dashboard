// app/payment/history/page.tsx
import React from 'react';
import PaymentHistoryTabs from '@/components/Payment/PaymentHistoryTabs';
import { AccessDeniedFallback, ProtectedComponent } from '@/hooks/use-permission';

export default function PaymentHistoryPage() {
  return (
    <ProtectedComponent
      permissionKey="page:payment-history"
      fallback={<AccessDeniedFallback />}
    >
      <PaymentHistoryTabs />
    </ProtectedComponent>
  );
}

export const metadata = {
  title: 'Payments History | Tu App',
  description: 'Listado de todos los pagos exitosos procesados con Stripe.',
};
