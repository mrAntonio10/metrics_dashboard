// app/api/payments/create-ach-intent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// -------- Stripe helper (lazy init) --------
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    // No lo evaluamos en top-level, solo cuando alguien llama al endpoint
    throw new Error('STRIPE_SECRET_KEY is not set in environment');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: '2024-06-20',
    });
  }

  return stripeClient;
}

// -------- Handler POST --------
export async function POST(req: NextRequest) {
  try {
    const { amount, customerEmail, customerName, description } =
      await req.json();

    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 },
      );
    }

    const stripe = getStripe(); // ⬅️ aquí usamos el helper

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(n * 100), // a centavos
      currency: 'usd', // ACH solo USD
      payment_method_types: ['us_bank_account'],
      description: description || 'Bank transfer payment',
      receipt_email: customerEmail || undefined,
      metadata: {
        customer_name: customerName || '',
        type: 'ach_bank_payment',
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err: any) {
    console.error('Error creating ACH PaymentIntent', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Error creating ACH PaymentIntent on server',
      },
      { status: 500 },
    );
  }
}
