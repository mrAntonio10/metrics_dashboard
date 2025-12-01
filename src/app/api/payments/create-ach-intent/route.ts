// app/api/payments/create-ach-intent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20', // o la que uses
});

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(n * 100), // a centavos
      currency: 'usd',             // ACH solo USD
      payment_method_types: ['us_bank_account'],
      description: description || 'Bank transfer payment',
      receipt_email: customerEmail || undefined,
      metadata: {
        customer_name: customerName || '',
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
