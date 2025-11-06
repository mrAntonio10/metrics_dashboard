// src/components/Payment/Payment.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
  Mail,
} from 'lucide-react';
import { ProtectedComponent } from '@/hooks/use-permission';

// ==== Types ====

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  features?: string[];
  highlight?: boolean;
}

interface PaymentData {
  amount: string;
  description: string;
  customerEmail: string;
  customerName: string;
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

// ==== Stripe CardElement config ====

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      '::placeholder': { color: '#9CA3AF' },
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSmoothing: 'antialiased',
    },
    invalid: {
      color: '#DC2626',
    },
  },
  hidePostalCode: true,
};

// ==== PaymentForm: Step 3 (Stripe) ====

const PaymentForm: React.FC<PaymentFormProps> = ({
  paymentData,
  onSuccess,
  onError,
  onBack,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [clientSecret, setClientSecret] = useState<string>('');
  const [loadingIntent, setLoadingIntent] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string>('');

  // Crea PaymentIntent cuando hay datos completos
  useEffect(() => {
    const canCreate =
      paymentData.amount &&
      paymentData.customerEmail &&
      paymentData.customerName;

    if (!canCreate) return;

    const createIntent = async () => {
      try {
        setLoadingIntent(true);
        setPaymentError('');

        const response = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(paymentData.amount),
            customerEmail: paymentData.customerEmail,
            customerName: paymentData.customerName,
            description: paymentData.description,
          }),
        });

        const data = await response.json();

        if (response.ok && data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setPaymentError(data?.error || 'No se pudo iniciar el pago.');
        }
      } catch (err) {
        setPaymentError('Error de conexión al iniciar el pago.');
      } finally {
        setLoadingIntent(false);
      }
    };

    createIntent();
  }, [paymentData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setProcessing(true);
    setPaymentError('');

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setPaymentError('No se pudo cargar el formulario de tarjeta.');
      setProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: paymentData.customerName,
            email: paymentData.customerEmail,
          },
        },
      }
    );

    if (error) {
      const msg = error.message || 'Error procesando el pago.';
      setPaymentError(msg);
      onError(msg);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess({
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'success',
      });
    } else {
      const msg = 'No se pudo completar el pago.';
      setPaymentError(msg);
      onError(msg);
    }

    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Información de la tarjeta
        </label>
        <div className="border border-slate-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
          <CardElement options={cardElementOptions} />
        </div>
        <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
          <Shield className="w-3 h-3 text-emerald-500" />
          Tus datos se procesan de forma segura por Stripe. No se almacenan en nuestros servidores.
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
          Volver
        </button>

        <button
          type="submit"
          disabled={
            !stripe ||
            !clientSecret ||
            processing ||
            loadingIntent
          }
          className="flex-1 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Procesando pago...
            </>
          ) : loadingIntent ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparando pago...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Confirmar y pagar ${paymentData.amount}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

// ==== Main Payment Component ====

const Payment: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    amount: '',
    description: '',
    customerEmail: '',
    customerName: '',
  });
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const pkMissing = !pk;

  const products: Product[] = [
    {
      id: 1,
      name: 'Starter',
      price: 19,
      description: 'Para proyectos personales o pruebas.',
      features: ['Hasta 3 organizaciones', 'Reportes básicos', 'Soporte por email'],
    },
    {
      id: 2,
      name: 'Growth',
      price: 49,
      description: 'Ideal para equipos en crecimiento.',
      features: ['Organizaciones ilimitadas', 'Métricas avanzadas', 'Prioridad en soporte'],
      highlight: true,
    },
    {
      id: 3,
      name: 'Enterprise',
      price: 99,
      description: 'Para operaciones críticas y multi-tenant.',
      features: ['SLA dedicado', 'Onboarding guiado', 'Integraciones avanzadas'],
    },
  ];

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setPaymentData((prev) => ({
      ...prev,
      amount: product.price.toString(),
      description: product.name,
    }));
    setCurrentStep(2);
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!paymentData.customerName.trim()) {
      newErrors.customerName = 'El nombre es requerido.';
    }

    if (!paymentData.customerEmail.trim()) {
      newErrors.customerEmail = 'El email es requerido.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentData.customerEmail)) {
      newErrors.customerEmail = 'Ingresa un email válido.';
    }

    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      newErrors.amount = 'Selecciona un plan antes de continuar.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    });
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Portal de Pagos Seguros
            </h1>
            <p className="text-sm text-slate-600">
              Gestiona tu suscripción de Aggregate Insights con pagos protegidos por Stripe.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>PCI-DSS compliant • Datos encriptados end-to-end</span>
          </div>
        </div>

        {/* Layout principal */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6 items-start">
          {/* Card principal izquierda */}
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-7 space-y-6 border border-slate-100">
            {/* Stepper */}
            <div className="flex items-center gap-3 text-xs font-medium text-slate-600 mb-1">
              {[
                { id: 1, label: 'Plan' },
                { id: 2, label: 'Datos' },
                { id: 3, label: 'Pago' },
                { id: 4, label: 'Confirmación' },
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
                        {completed ? <CheckCircle className="w-3 h-3" /> : step.id}
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

            {/* Step 1: seleccionar plan */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Elige el plan que se ajusta a tu operación
                </h2>
                <p className="text-sm text-slate-600">
                  Puedes cambiar o cancelar tu plan en cualquier momento.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
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
                          Más elegido
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-2xl font-semibold text-slate-900">
                        ${p.price}
                        <span className="text-xs font-normal text-slate-500">
                          /mes
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {p.description}
                      </p>
                      <ul className="space-y-1 text-[10px] text-slate-500">
                        {p.features?.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
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

            {/* Step 2: datos del cliente */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Datos de facturación
                </h2>
                <p className="text-sm text-slate-600">
                  Usaremos esta información para tu recibo y notificaciones del pago.
                </p>
                <form
                  className="space-y-4 max-w-lg"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (validateStep2()) setCurrentStep(3);
                  }}
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre completo *
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
                        placeholder="Ej: Marco Roca"
                      />
                    </div>
                    {errors.customerName && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.customerName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Correo electrónico *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={paymentData.customerEmail}
                        onChange={(e) =>
                          setPaymentData({
                            ...paymentData,
                            customerEmail: e.target.value,
                          })
                        }
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="tucorreo@empresa.com"
                      />
                    </div>
                    {errors.customerEmail && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.customerEmail}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="inline-flex items-center text-xs text-slate-500 hover:text-slate-700"
                    >
                      <ArrowLeft className="w-3 h-3 mr-1" />
                      Cambiar plan
                    </button>

                    <button
                      type="submit"
                      className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                    >
                      Continuar al pago
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: pago con Stripe */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Completar pago
                </h2>
                <p className="text-sm text-slate-600">
                  Ingresa los datos de tu tarjeta. No almacenamos esta información.
                </p>

                {pkMissing ? (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-3 py-2">
                    Falta configurar <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
                    Agrega tu clave pública de Stripe antes de habilitar pagos.
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

            {/* Step 4: confirmación */}
            {currentStep === 4 && (
              <div className="space-y-5 text-center">
                {paymentResult?.status === 'success' ? (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto">
                      <CheckCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Pago realizado con éxito
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      Hemos procesado tu pago de{' '}
                      <span className="font-semibold">
                        ${paymentResult.amount} {paymentResult.currency?.toUpperCase()}
                      </span>. Recibirás un comprobante en tu correo.
                    </p>
                    {paymentResult.paymentIntentId && (
                      <p className="text-[10px] text-slate-400">
                        ID de transacción: {paymentResult.paymentIntentId}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto">
                      <XCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      No se pudo completar el pago
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      {paymentResult?.error ||
                        'Ocurrió un problema al procesar tu pago. Puedes intentar nuevamente.'}
                    </p>
                  </>
                )}

                <button
                  onClick={resetPayment}
                  className="mt-3 inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition"
                >
                  {paymentResult?.status === 'success'
                    ? 'Realizar otro pago'
                    : 'Intentar nuevamente'}
                </button>
              </div>
            )}
          </div>

          {/* Sidebar / Resumen derecha */}
          <aside className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow-md p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Resumen de tu suscripción
            </h3>
            {selectedProduct ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Plan seleccionado</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedProduct.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-slate-900">
                      ${selectedProduct.price}
                    </p>
                    <p className="text-[10px] text-slate-500">USD / mes</p>
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5 text-[10px] text-slate-600">
                  {selectedProduct.features?.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Selecciona un plan para ver el detalle de tu suscripción.
              </p>
            )}

            <div className="border-t border-slate-100 pt-3 space-y-1">
              <p className="flex items-center gap-2 text-[10px] text-slate-500">
                <Shield className="w-3 h-3 text-emerald-500" />
                Procesado con Stripe. No almacenamos los datos de tu tarjeta.
              </p>
              <p className="text-[10px] text-slate-400">
                Al continuar aceptas los Términos de servicio y la Política de privacidad de la
                plataforma.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Payment;
