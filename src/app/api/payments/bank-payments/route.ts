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

    // Buscar PaymentIntents con us_bank_account y estado succeeded
    const searchResult = await stripe.paymentIntents.search({
      query: "status:'succeeded' AND payment_method_types:'us_bank_account'",
      limit,
      ...(page ? { page } : {}),
    });

    const items = await Promise.all(
      searchResult.data.map(async (pi) => {
        // Obtener detalles del payment method si existe
        let bankDetails = null;
        if (pi.payment_method) {
          try {
            const pm = await stripe.paymentMethods.retrieve(
              pi.payment_method as string,
            );
            if (pm.type === 'us_bank_account' && pm.us_bank_account) {
              bankDetails = {
                bankName: pm.us_bank_account.bank_name || null,
                accountHolderType: pm.us_bank_account.account_holder_type || null,
                accountType: pm.us_bank_account.account_type || null,
                last4: pm.us_bank_account.last4 || null,
                routingNumber: pm.us_bank_account.routing_number || null,
              };
            }
          } catch (err) {
            console.error('Error fetching payment method:', err);
          }
        }

        // Obtener información del charge asociado si existe
        let chargeInfo = null;
        if (pi.latest_charge) {
          try {
            const charge = await stripe.charges.retrieve(
              pi.latest_charge as string,
            );
            chargeInfo = {
              chargeId: charge.id,
              receiptUrl: charge.receipt_url || null,
              networkTransactionId:
                charge.payment_method_details?.us_bank_account
                  ?.network_transaction_id || null,
            };
          } catch (err) {
            console.error('Error fetching charge:', err);
          }
        }

        return {
          id: pi.id,
          object: pi.object,
          amount: pi.amount / 100,
          currency: pi.currency,
          description: pi.description || '',
          customerEmail: pi.receipt_email || '',
          customerName: pi.metadata?.customer_name || '',
          status: pi.status,
          paymentMethodType: 'us_bank_account',
          bankDetails,
          chargeInfo,
          created: pi.created,
          metadata: pi.metadata,
        };
      }),
    );

    return NextResponse.json({
      items,
      hasMore: searchResult.has_more,
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
