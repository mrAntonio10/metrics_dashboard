// BankAccountPaymentForm.tsx
import React, { useEffect, useState } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import { Shield, XCircle, Loader2, ArrowLeft, CreditCard } from 'lucide-react';
import { PaymentFormProps, PaymentResult } from './Payment';

const BankAccountPaymentForm: React.FC<PaymentFormProps> = ({
  paymentData,
  onSuccess,
  onError,
  onBack,
}) => {
  const stripe = useStripe();
  const elements = useElements(); // no lo usamos, pero necesita el contexto de <Elements>

  const [clientSecret, setClientSecret] = useState('');
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const getNormalizedAmount = (): number => {
    const raw = String(paymentData.amount).trim().replace(',', '.');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  // Crea el PaymentIntent ACH cuando hay datos suficientes
  useEffect(() => {
    const normalized = getNormalizedAmount();
    const canCreate =
      !!paymentData.customerEmail &&
      !!paymentData.customerName &&
      normalized > 0;

    if (!canCreate) return;

    const createIntent = async () => {
      try {
        setLoadingIntent(true);
        setPaymentError('');

        const response = await fetch(
          '/api/payments/create-ach-intent',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: normalized,
              customerEmail: paymentData.customerEmail,
              customerName: paymentData.customerName,
              description:
                paymentData.description ||
                'Bank account payment',
            }),
          },
        );

        const data = await response.json();

        if (response.ok && data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setPaymentError(
            data?.error ||
              'Unable to initialize the bank payment. Please try again.',
          );
        }
      } catch (err) {
        console.error('Error initializing ACH intent', err);
        setPaymentError(
          'Network error while initializing the bank payment. Please try again.',
        );
      } finally {
        setLoadingIntent(false);
      }
    };

    createIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paymentData.amount,
    paymentData.customerEmail,
    paymentData.customerName,
    paymentData.description,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !clientSecret) return;

    if (!routingNumber.trim() || !accountNumber.trim()) {
      setPaymentError('Routing and account number are required.');
      return;
    }

    setProcessing(true);
    setPaymentError('');

    try {
      const { error, paymentIntent } =
        await stripe.confirmUsBankAccountPayment(
          clientSecret,
          {
            payment_method: {
              us_bank_account: {
                routing_number: routingNumber.trim(),
                account_number: accountNumber.trim(),
                account_holder_type: 'company', // o 'individual'
              },
              billing_details: {
                name: paymentData.customerName,
                email: paymentData.customerEmail,
              },
            },
          },
        );

      if (error) {
        const msg =
          error.message ||
          'An error occurred while processing your bank payment.';
        setPaymentError(msg);
        onError(msg);
        setProcessing(false);
        return;
      }

      if (paymentIntent) {
        const result: PaymentResult = {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: 'success',
        };
        onSuccess(result);
      } else {
        const msg =
          'We could not complete your bank payment. Please try again.';
        setPaymentError(msg);
        onError(msg);
      }
    } catch (err: any) {
      console.error('Unexpected error confirming bank payment', err);
      const msg =
        err?.message ||
        'Unexpected error. Please try again.';
      setPaymentError(msg);
      onError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const displayAmount = (() => {
    const n = getNormalizedAmount();
    if (n > 0) return n.toFixed(2);
    return paymentData.amount || '--';
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Bank account details
        </label>
        <div className="space-y-3">
          <div>
            <input
              type="text"
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Routing number (e.g. 110000000)"
            />
          </div>
          <div>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Account number (e.g. 000123456789)"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
          <Shield className="w-3 h-3 text-emerald-500" />
          Bank details are processed securely by Stripe and never
          stored on our servers.
        </p>
      </div>

      {paymentError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5" />
          <span>{paymentError}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
          disabled={processing}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </button>

        <button
          type="submit"
          disabled={!stripe || !clientSecret || processing || loadingIntent}
          className="flex-1 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing bank payment...
            </>
          ) : loadingIntent ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparing bank payment...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay from bank • ${displayAmount}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default BankAccountPaymentForm;
