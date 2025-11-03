// src/lib/stripe.ts
import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Evita crear múltiples instancias en dev/hot-reload
declare global {
  // eslint-disable-next-line no-var
  var _stripePromise: Promise<Stripe | null> | undefined;
}

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export const stripePromise =
  globalThis._stripePromise ?? (globalThis._stripePromise = loadStripe(pk));
