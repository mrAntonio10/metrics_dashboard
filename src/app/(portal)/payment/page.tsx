// app/payment/page.tsx
import React from 'react';
import ProtectedComponent from '@/components/ProtectedComponent';
import Payment from '@/components/Payment/Payment';

export default function PaymentPage() {
  return (
    <ProtectedComponent permissionKey="page:payment">
      <Payment />
    </ProtectedComponent>
  );
}

// Metadata para SEO (opcional)
export const metadata = {
  title: 'Portal de Pagos | Tu App',
  description: 'Proceso de pago seguro y confiable con Stripe',
  keywords: 'pagos, stripe, seguro, suscripción',
};