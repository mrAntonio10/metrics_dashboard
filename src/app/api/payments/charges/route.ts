// app/api/payments/charges/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-10-29.clover', // o la versión que tengas configurada en tu cuenta
});

export async function GET(request: Request) {
  try {
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
      // country preferimos billing_details.address.country; si no, país de la tarjeta
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

      return {
        id: ch.id,
        object: ch.object, // normalmente "charge"
        amount: ch.amount / 100, // a unidades decimales
        currency: ch.currency,
        description: ch.description || '',
        name: ch.billing_details?.name || '',
        email: ch.billing_details?.email || '',
        country: billingCountry,
        networkTransactionId,
        created: ch.created, // unix ts
        receiptUrl: ch.receipt_url || null,
        status: ch.status, // "succeeded"
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
        message: error?.message || 'Unable to fetch paid charges from Stripe',
      },
      { status: 500 },
    );
  }
}
