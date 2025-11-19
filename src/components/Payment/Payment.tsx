'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import {
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  User,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

/* Types */

interface Product {
  id: number;
  name: string;
  price?: number;
  description: string;
  features?: string[];
  highlight?: boolean;
  allowCustomAmount?: boolean;
}

interface TenantSummary {
  tenantId: string;
  companyName: string;
}

interface PaymentData {
  amount: string;
  description: string;
  customerEmail: string; // usado solo en suscripciones
  customerName: string;
  tenantId?: string;
}

interface PaymentResult {
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  status: 'success' | 'error';
  error?: string;
}

interface PaymentFormProps {
  paymentData: PaymentData;
  onSuccess: (result: PaymentResult) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

/* Stripe CardElement config */

const cardElementOptions: any = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      '::placeholder': { color: '#9CA3AF' },
      fontFamily:
        '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSmoothing: 'antialiased',
    },
    invalid: {
      color: '#DC2626',
    },
  },
  hidePostalCode: true,
};

/* Step 3: Card payment form (solo suscripciones) */

const PaymentForm: React.FC<PaymentFormProps> = ({
  paymentData,
  onSuccess,
  onError,
  onBack,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [clientSecret, setClientSecret] = useState('');
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const getNormalizedAmount = (): number => {
    const raw = String(paymentData.amount).trim().replace(',', '.');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

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

        const response = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: normalized,
            customerEmail: paymentData.customerEmail,
            customerName: paymentData.customerName,
            description:
              paymentData.description || 'Subscription payment',
          }),
        });

        const data = await response.json();

        if (response.ok && data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setPaymentError(
            data?.error ||
              'Unable to initialize the payment. Please try again.',
          );
        }
      } catch (err) {
        console.error('Error initializing payment intent', err);
        setPaymentError(
          'Network error while initializing the payment. Please try again.',
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
    if (!stripe || !elements || !clientSecret) return;

    setProcessing(true);
    setPaymentError('');

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setPaymentError(
        'Could not load the card form. Please refresh and try again.',
      );
      setProcessing(false);
      return;
    }

    const { error, paymentIntent } =
      await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: paymentData.customerName,
            email: paymentData.customerEmail,
          },
        },
      });

    if (error) {
      const msg =
        error.message || 'An error occurred while processing your payment.';
      setPaymentError(msg);
      onError(msg);
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess({
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'success',
      });
    } else {
      const msg =
        'We could not complete your payment. No charges have been made. Please try again.';
      setPaymentError(msg);
      onError(msg);
    }

    setProcessing(false);
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
          Card details
        </label>
        <div className="border border-slate-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
          <CardElement options={cardElementOptions} />
        </div>
        <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
          <Shield className="w-3 h-3 text-emerald-500" />
          Your card details are processed securely by Stripe and never
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
              Processing payment...
            </>
          ) : loadingIntent ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparing payment...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Confirm &amp; pay ${displayAmount}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

/* Main Payment component */

const Payment: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    amount: '',
    description: '',
    customerEmail: '',
    customerName: '',
    tenantId: undefined,
  });
  const [paymentResult, setPaymentResult] =
    useState<PaymentResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  const [tenantSearch, setTenantSearch] = useState<string>('');
  const [tenantDropdownOpen, setTenantDropdownOpen] =
    useState<boolean>(false);
  const tenantBoxRef = useRef<HTMLDivElement | null>(null);

  const [sendingCustom, setSendingCustom] = useState(false);

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const pkMissing = !pk;

  const products: Product[] = [
    {
      id: 4,
      name: 'Custom',
      description:
        'Send a one-time payment request with a custom amount.',
      features: [
        'Ideal for custom contracts',
        'Manual billing alignment',
        'Flexible pricing',
      ],
      allowCustomAmount: true,
    },
  ];

  const isCustom = !!selectedProduct?.allowCustomAmount;

  // Cerrar dropdown de tenants al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        tenantBoxRef.current &&
        !tenantBoxRef.current.contains(target)
      ) {
        setTenantDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cargar tenants
  useEffect(() => {
    const loadTenants = async () => {
      try {
        setLoadingTenants(true);
        const res = await fetch('/api/billing/tenants');
        if (!res.ok) return;
        const data = await res.json();
        setTenants(data.items || []);
      } catch (err) {
        console.error('Error loading tenants', err);
      } finally {
        setLoadingTenants(false);
      }
    };
    loadTenants();
  }, []);

  const filteredTenants = useMemo(() => {
    if (!tenants?.length) return [];
    if (!tenantSearch.trim()) return tenants;
    const q = tenantSearch.toLowerCase();
    return tenants.filter(
      (t) =>
        t.companyName.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q),
    );
  }, [tenants, tenantSearch]);

  // Mantener input sincronizado con tenant seleccionado
  useEffect(() => {
    if (!paymentData.tenantId) {
      setTenantSearch('');
      return;
    }
    const match = tenants.find(
      (t) => t.tenantId === paymentData.tenantId,
    );
    if (match) {
      setTenantSearch(match.companyName);
    }
  }, [paymentData.tenantId, tenants]);

  const goToStep = (step: number) => setCurrentStep(step);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setPaymentData((prev) => ({
      ...prev,
      amount: product.allowCustomAmount
        ? ''
        : (product.price ?? 0).toFixed(2),
      description: product.allowCustomAmount ? '' : product.name,
      tenantId: undefined,
    }));
    setErrors({});
    setCurrentStep(2);
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!paymentData.customerName.trim()) {
      newErrors.customerName = 'Full name is required.';
    }

    // Email solo requerido para suscripciones (no Custom)
    if (!isCustom) {
      if (!paymentData.customerEmail.trim()) {
        newErrors.customerEmail = 'Email is required.';
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          paymentData.customerEmail,
        )
      ) {
        newErrors.customerEmail =
          'Enter a valid email address.';
      }
    }

    const rawAmount = String(paymentData.amount)
      .trim()
      .replace(',', '.');
    const parsedAmount = Number(rawAmount);

    if (!rawAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Enter a valid amount (e.g. 149.00).';
    }

    if (isCustom) {
      if (!paymentData.description.trim()) {
        newErrors.description =
          'Description is required for custom payments.';
      }
      if (!paymentData.tenantId) {
        newErrors.tenantId =
          'Please select a tenant for this custom payment.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendCustomPaymentRequest = async () => {
    const amountNum = Number(
      String(paymentData.amount).trim().replace(',', '.'),
    );
    setSendingCustom(true);

    try {
      const res = await fetch('/api/billing/custom-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: paymentData.tenantId,
          amount: amountNum,
          currency: 'USD',
          description: paymentData.description,
          customerName: paymentData.customerName,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || data.error) {
        throw new Error(
          data.message ||
            data.error ||
            'Unable to send the payment request. Please try again.',
        );
      }

      setPaymentResult({
        status: 'success',
        amount: amountNum,
        currency: 'USD',
      });
      setCurrentStep(4);
    } catch (err: any) {
      console.error('Error sending custom payment request', err);
      setPaymentResult({
        status: 'error',
        error:
          err?.message ||
          'Unable to send the payment request. Please try again.',
      });
      setCurrentStep(4);
    } finally {
      setSendingCustom(false);
    }
  };

  const handlePaymentSuccess = (result: PaymentResult) => {
    setPaymentResult(result);
    setCurrentStep(4);
  };

  const handlePaymentError = (error: string) => {
    setPaymentResult({ status: 'error', error });
    setCurrentStep(4);
  };

  const resetPayment = () => {
    setCurrentStep(1);
    setPaymentResult(null);
    setSelectedProduct(null);
    setPaymentData({
      amount: '',
      description: '',
      customerEmail: '',
      customerName: '',
      tenantId: undefined,
    });
    setErrors({});
    setTenantSearch('');
    setTenantDropdownOpen(false);
  };

  const getSidebarAmountLabel = () => {
    if (!selectedProduct) return null;

    if (isCustom) {
      const normalized = Number(
        String(paymentData.amount).trim().replace(',', '.'),
      );
      if (normalized > 0) return `$${normalized.toFixed(2)}`;
      return '--';
    }

    const price = selectedProduct.price ?? 0;
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Secure Payments Portal
            </h1>
            <p className="text-sm text-slate-600">
              Manage your subscriptions or send custom payment
              requests.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>
              PCI-DSS compliant • End-to-end encrypted
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6 items-start">
          {/* Left: wizard */}
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-7 space-y-6 border border-slate-100">
            {/* Stepper */}
            <div className="flex items-center gap-3 text-xs font-medium text-slate-600 mb-1">
              {[
                { id: 1, label: 'Plan' },
                {
                  id: 2,
                  label: isCustom
                    ? 'Details & send'
                    : 'Details',
                },
                { id: 3, label: 'Payment' },
                { id: 4, label: 'Confirmation' },
              ].map((step, index) => {
                const active = currentStep === step.id;
                const completed = currentStep > step.id;
                return (
                  <React.Fragment key={step.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                          completed
                            ? 'bg-emerald-500 text-white'
                            : active
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500',
                        ].join(' ')}
                      >
                        {completed ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          step.id
                        )}
                      </div>
                      <span
                        className={
                          active
                            ? 'text-blue-700'
                            : completed
                            ? 'text-slate-500'
                            : 'text-slate-400'
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                    {index < 3 && (
                      <div className="flex-1 h-px bg-slate-200" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step 1: select plan */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Choose how you want to charge
                </h2>
                <p className="text-sm text-slate-600">
                  Select a subscription plan to charge now, or use{' '}
                  <strong>Custom</strong> to send a one-time payment
                  request via email to the tenant&apos;s billing
                  contacts.
                </p>
                <div className="grid gap-4 sm:grid-cols-4">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProductSelect(p)}
                      className={[
                        'relative rounded-2xl border px-4 py-4 text-left space-y-2 transition-all hover:shadow-md',
                        p.highlight
                          ? 'border-blue-500/70 bg-blue-50/40'
                          : 'border-slate-200 bg-slate-50/40 hover:border-blue-300',
                      ].join(' ')}
                    >
                      {p.highlight && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 bg-blue-600 text-[9px] text-white rounded-full">
                          Most popular
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-2xl font-semibold text-slate-900">
                        {p.allowCustomAmount
                          ? 'Custom amount'
                          : `$${(p.price ?? 0).toFixed(2)}`}
                        {!p.allowCustomAmount && (
                          <span className="text-xs font-normal text-slate-500">
                            /month
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {p.description}
                      </p>
                      <ul className="space-y-1 text-[10px] text-slate-500">
                        {p.features?.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: billing details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Billing details
                </h2>
                <p className="text-sm text-slate-600">
                  {isCustom
                    ? 'Fill in the details to send a secure payment request to the selected tenant.'
                    : 'We’ll use this information for your receipt and payment notifications.'}
                </p>
                <form
                  className="space-y-4 max-w-lg"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!validateStep2()) return;

                    if (isCustom) {
                      await sendCustomPaymentRequest();
                    } else {
                      setCurrentStep(3);
                    }
                  }}
                >
                  {/* Full name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={paymentData.customerName}
                        onChange={(e) =>
                          setPaymentData({
                            ...paymentData,
                            customerName: e.target.value,
                          })
                        }
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. Jane Doe"
                      />
                    </div>
                    {errors.customerName && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.customerName}
                      </p>
                    )}
                  </div>

                  {/* Email - SOLO para suscripciones */}
                  {!isCustom && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Work email *
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={paymentData.customerEmail}
                          onChange={(e) =>
                            setPaymentData({
                              ...paymentData,
                              customerEmail:
                                e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="you@company.com"
                        />
                      </div>
                      {errors.customerEmail && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.customerEmail}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Custom-specific fields */}
                  {isCustom && (
                    <>
                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Amount (USD) *
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={paymentData.amount}
                            onChange={(e) =>
                              setPaymentData({
                                ...paymentData,
                                amount: e.target.value,
                              })
                            }
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. 149.00"
                          />
                        </div>
                        {errors.amount && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.amount}
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Description *
                        </label>
                        <input
                          type="text"
                          value={paymentData.description}
                          onChange={(e) =>
                            setPaymentData({
                              ...paymentData,
                              description:
                                e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g. One-time setup fee for Client X"
                        />
                        {errors.description && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.description}
                          </p>
                        )}
                      </div>

                      {/* Tenant selector (searchable input + dropdown) */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Tenant *
                        </label>
                        <div
                          ref={tenantBoxRef}
                          className="relative"
                        >
                          <Input
                            placeholder="Select tenant..."
                            aria-label="Tenant"
                            value={tenantSearch}
                            onFocus={() =>
                              setTenantDropdownOpen(true)
                            }
                            onChange={(e) => {
                              const value =
                                e.target.value;
                              setTenantSearch(value);
                              setTenantDropdownOpen(
                                true,
                              );
                              if (!value) {
                                setPaymentData({
                                  ...paymentData,
                                  tenantId: undefined,
                                });
                              }
                            }}
                          />
                          {tenantDropdownOpen &&
                            filteredTenants.length >
                              0 && (
                              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md">
                                {filteredTenants.map(
                                  (t) => (
                                    <button
                                      key={
                                        t.tenantId
                                      }
                                      type="button"
                                      className="block w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                                      onMouseDown={(
                                        e,
                                      ) =>
                                        e.preventDefault()
                                      }
                                      onClick={() => {
                                        setTenantSearch(
                                          t.companyName,
                                        );
                                        setPaymentData(
                                          {
                                            ...paymentData,
                                            tenantId:
                                              t.tenantId,
                                          },
                                        );
                                        setTenantDropdownOpen(
                                          false,
                                        );
                                      }}
                                    >
                                      {t.companyName}{' '}
                                      (
                                      {
                                        t.tenantId
                                      }
                                      )
                                    </button>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                        {loadingTenants && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Loading tenants...
                          </p>
                        )}
                        {errors.tenantId && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.tenantId}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Fixed plans: readonly amount */}
                  {!isCustom && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Amount (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={paymentData.amount}
                          readOnly
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-500"
                        />
                      </div>
                      {errors.amount && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.amount}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="inline-flex items-center text-xs text-slate-500 hover:text-slate-700"
                      disabled={sendingCustom}
                    >
                      <ArrowLeft className="w-3 h-3 mr-1" />
                      Change plan
                    </button>

                    <button
                      type="submit"
                      disabled={sendingCustom}
                      className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isCustom ? (
                        sendingCustom ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending payment...
                          </>
                        ) : (
                          <>
                            Send payment
                            <ArrowRight className="w-4 h-4 ml-1.5" />
                          </>
                        )
                      ) : (
                        <>
                          Continue to payment
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: card payment (solo si no es custom) */}
            {currentStep === 3 && !isCustom && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Complete your payment
                </h2>
                <p className="text-sm text-slate-600">
                  Enter your card details. We do not store this
                  information.
                </p>

                {pkMissing ? (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-3 py-2">
                    <code>
                      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                    </code>{' '}
                    is not configured. Add your Stripe publishable key
                    to enable payments.
                  </div>
                ) : (
                  <Elements stripe={stripePromise}>
                    <PaymentForm
                      paymentData={paymentData}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onBack={() => setCurrentStep(2)}
                    />
                  </Elements>
                )}
              </div>
            )}

            {/* Step 4: confirmation */}
            {currentStep === 4 && (
              <div className="space-y-5 text-center">
                {paymentResult?.status === 'success' ? (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto">
                      <CheckCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {isCustom
                        ? 'Payment request sent'
                        : 'Payment successful'}
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      {isCustom ? (
                        <>
                          We&apos;ve sent a secure payment request for{' '}
                          <span className="font-semibold">
                            $
                            {paymentResult.amount?.toFixed(
                              2,
                            )}{' '}
                            USD
                          </span>{' '}
                          to the billing contacts configured for this
                          tenant.
                        </>
                      ) : (
                        <>
                          We&apos;ve processed your payment of{' '}
                          <span className="font-semibold">
                            $
                            {paymentResult.amount?.toFixed(2)}{' '}
                            {paymentResult.currency?.toUpperCase()}
                          </span>
                          . A receipt will be sent to your email.
                        </>
                      )}
                    </p>
                    {!isCustom &&
                      paymentResult.paymentIntentId && (
                        <p className="text-[10px] text-slate-400">
                          Transaction ID:{' '}
                          {paymentResult.paymentIntentId}
                        </p>
                      )}
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto">
                      <XCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {isCustom
                        ? 'Payment request could not be sent'
                        : 'Payment could not be completed'}
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      {paymentResult?.error ||
                        (isCustom
                          ? 'Something went wrong while sending the payment request.'
                          : 'Something went wrong while processing your payment. No charges were made.')}
                    </p>
                  </>
                )}

                <button
                  onClick={resetPayment}
                  className="mt-3 inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition"
                >
                  {paymentResult?.status === 'success'
                    ? isCustom
                      ? 'Send another payment request'
                      : 'Make another payment'
                    : 'Try again'}
                </button>
              </div>
            )}
          </div>

          {/* Right: summary sidebar */}
          <aside className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow-md p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {isCustom
                ? 'Custom payment summary'
                : 'Subscription summary'}
            </h3>
            {selectedProduct ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs text-slate-500">
                      Selected option
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedProduct.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-slate-900">
                      {getSidebarAmountLabel()}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {isCustom
                        ? 'USD (one-time)'
                        : 'USD / month'}
                    </p>
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5 text-[10px] text-slate-600">
                  {selectedProduct.features?.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCustom && paymentData.tenantId && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tenant:{' '}
                    {
                      tenants.find(
                        (t) =>
                          t.tenantId ===
                          paymentData.tenantId,
                      )?.companyName
                    }{' '}
                    ({paymentData.tenantId})
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Select a plan or a custom option to see a breakdown.
              </p>
            )}

            <div className="border-t border-slate-100 pt-3 space-y-1">
              <p className="flex items-center gap-2 text-[10px] text-slate-500">
                <Shield className="w-3 h-3 text-emerald-500" />
                Payments and payment links are powered by Stripe.
                Card details are never stored on our servers.
              </p>
              <p className="text-[10px] text-slate-400">
                By continuing, you agree to the platform’s Terms of
                Service and Privacy Policy.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Payment;
