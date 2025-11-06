import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY no está configurado en el entorno');
}

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

    const body = await req.json();
    const { amount, description, customerEmail, customerName } = body;

    if (!amount || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos para crear el pago' }),
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100), // de USD a cents
      currency: 'usd',
      description: description || 'Pago Vivace',
      receipt_email: customerEmail,
      metadata: {
        customerName: customerName || '',
      },
      automatic_payment_methods: { enabled: true },
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error creando PaymentIntent:', error);
    return new Response(
      JSON.stringify({ error: 'Error creando el pago en Stripe' }),
      { status: 500 }
    );
  }
}
