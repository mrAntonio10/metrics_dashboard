// src/app/api/payments/create-intent/route.ts
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured on the server.' }),
        { status: 500 }
      );
    }

    const { amount, description, customerEmail, customerName } = await req.json();

    if (!amount || !customerEmail || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields to process the payment.' }),
        { status: 400 }
      );
    }

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount.' }),
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      description: description || 'Subscription payment',
      receipt_email: customerEmail,
      metadata: { customerName },
      automatic_payment_methods: { enabled: true },
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while creating the payment in Stripe.' }),
      { status: 500 }
    );
  }
}
