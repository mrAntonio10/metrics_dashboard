// src/lib/stripe.ts
import { loadStripe, type Stripe } from '@stripe/stripe-js';

declare global {
  // eslint-disable-next-line no-var
  var _stripePromise: Promise<Stripe | null> | undefined;
}

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

if (!pk && typeof window !== 'undefined') {
  console.error(
    'Stripe publishable key is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.'
  );
}

export const stripePromise =
  globalThis._stripePromise ??
  (globalThis._stripePromise = pk ? loadStripe(pk) : Promise.resolve(null));
