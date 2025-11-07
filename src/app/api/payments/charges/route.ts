// app/api/payments/charges/route.ts
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

    const searchResult = await stripe.charges.search({
      query: "status:'succeeded'",
      limit,
      ...(page ? { page } : {}),
    });

    const items = searchResult.data.map((ch) => {
      const billingCountry =
        ch.billing_details?.address?.country ||
        (ch.payment_method_details?.type === 'card'
          ? ch.payment_method_details.card?.country
          : undefined) ||
        '';

      const networkTransactionId =
        ch.payment_method_details?.type === 'card'
          ? ch.payment_method_details.card?.network_transaction_id || null
          : null;

      // 👇 Aquí el fallback:
      const email =
        ch.billing_details?.email || // primero: email en billing_details
        ch.receipt_email ||          // si no hay: usa receipt_email
        '';

      return {
        id: ch.id,
        object: ch.object,
        amount: ch.amount / 100,
        currency: ch.currency,
        description: ch.description || '',
        name: ch.billing_details?.name || '',
        email, // ya con el fallback aplicado
        country: billingCountry,
        networkTransactionId,
        created: ch.created,
        receiptUrl: ch.receipt_url || null,
        status: ch.status,
      };
    });

    return NextResponse.json({
      items,
      hasMore: searchResult.has_more,
      nextPage: searchResult.next_page || null,
    });
  } catch (error: any) {
    console.error('Error fetching Stripe charges', error);

    return NextResponse.json(
      {
        error: true,
        message:
          error?.message || 'Unable to fetch paid charges from Stripe',
      },
      { status: 500 },
    );
  }
}
