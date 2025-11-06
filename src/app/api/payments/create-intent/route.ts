import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return new Response(
        JSON.stringify({ error: 'Stripe no está configurado en el servidor' }),
        { status: 500 }
      );
    }

    const { amount, description, customerEmail, customerName } = await req.json();

    if (!amount || !customerEmail || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos para procesar el pago.' }),
        { status: 400 }
      );
    }

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Monto inválido.' }),
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      description: description || 'Pago de suscripción',
      receipt_email: customerEmail,
      metadata: { customerName },
      automatic_payment_methods: { enabled: true },
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creando PaymentIntent:', error);
    return new Response(
      JSON.stringify({ error: 'Error creando el pago en Stripe' }),
      { status: 500 }
    );
  }
}
