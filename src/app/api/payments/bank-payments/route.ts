// app/api/payments/bank-payments/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2024-06-20';

export async function GET(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error: true,
          message:
            'Server misconfiguration: STRIPE_SECRET_KEY is not set. Please configure it in your runtime environment.',
        },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    const { searchParams } = new URL(request.url);

    const page = searchParams.get('page') || undefined;
    const limitParam = searchParams.get('limit');
    let limit = 10;

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.max(1, Math.min(parsed, 100));
      }
    }

    // Buscar charges exitosos y filtrar por tipo de pago bancario
    // Nota: Stripe Search no permite filtrar directamente por payment_method_details.type
    // así que filtramos en el código después de obtener los resultados
    const searchResult = await stripe.charges.search({
      query: "status:'succeeded'",
      limit: limit * 3, // Pedimos más porque filtraremos después
      ...(page ? { page } : {}),
    });

    // Filtrar solo pagos con bank account
    const bankCharges = searchResult.data.filter((ch) =>
      ch.payment_method_details?.type === 'us_bank_account' ||
      ch.payment_method_details?.type === 'ach_debit' ||
      ch.payment_method_details?.type === 'ach_credit_transfer'
    );

    // Limitar al tamaño de página solicitado
    const paginatedCharges = bankCharges.slice(0, limit);

    const items = paginatedCharges.map((ch) => {
      const paymentMethodType = ch.payment_method_details?.type || 'unknown';

      // Extraer detalles de bank account del charge
      let bankDetails = null;
      if (
        paymentMethodType === 'us_bank_account' ||
        paymentMethodType === 'ach_debit' ||
        paymentMethodType === 'ach_credit_transfer'
      ) {
        const usBankAccount = (ch.payment_method_details as any).us_bank_account;
        if (usBankAccount) {
          bankDetails = {
            bankName: usBankAccount.bank_name || null,
            accountHolderType: usBankAccount.account_holder_type || null,
            accountType: usBankAccount.account_type || null,
            last4: usBankAccount.last4 || null,
            routingNumber: usBankAccount.routing_number || null,
          };
        }
      }

      const networkTransactionId =
        paymentMethodType === 'us_bank_account'
          ? (ch.payment_method_details as any).us_bank_account?.network_transaction_id || null
          : null;

      const email =
        ch.billing_details?.email ||
        ch.receipt_email ||
        '';

      return {
        id: ch.id,
        object: ch.object,
        amount: ch.amount / 100,
        currency: ch.currency,
        description: ch.description || '',
        customerEmail: email,
        customerName: ch.billing_details?.name || '',
        status: ch.status,
        paymentMethodType,
        bankDetails,
        chargeInfo: {
          chargeId: ch.id,
          receiptUrl: ch.receipt_url || null,
          networkTransactionId,
        },
        created: ch.created,
        metadata: ch.metadata,
      };
    });

    return NextResponse.json({
      items,
      hasMore: bankCharges.length > limit || searchResult.has_more,
      nextPage: searchResult.next_page || null,
    });
  } catch (error: any) {
    console.error('Error fetching Stripe bank payments', error);

    return NextResponse.json(
      {
        error: true,
        message:
          error?.message || 'Unable to fetch bank payments from Stripe',
      },
      { status: 500 },
    );
  }
}
