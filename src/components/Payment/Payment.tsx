// src/components/Payment/Payment.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe'; // 👈 singleton
import {
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  DollarSign,
  User,
  Mail,
} from 'lucide-react';
import { ProtectedComponent } from '@/hooks/use-permission';

// Types
interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  features?: string[];
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

// Estilos para CardElement
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': { color: '#aab7c4' },
      fontFamily: '"Inter", "Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
    },
    invalid: { color: '#9e2146' },
  },
  hidePostalCode: true,
};

// --- Formulario Stripe ---
const PaymentForm: React.FC<PaymentFormProps> = ({ paymentData, onSuccess, onError, onBack }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/payments/create-intents', {
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
        if (response.ok && data?.clientSecret) setClientSecret(data.clientSecret);
        else setPaymentError(data?.error || 'Error creando el pago');
      } catch {
        setPaymentError('Error de conexión');
      }
    };

    if (paymentData.amount && paymentData.customerEmail) createPaymentIntent();
  }, [paymentData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setProcessing(true);
    setPaymentError('');

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setPaymentError('Error cargando el formulario de tarjeta');
      setProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: paymentData.customerName,
          email: paymentData.customerEmail,
        },
      },
    });

    if (error) {
      const msg = error.message || 'Error procesando el pago';
      setPaymentError(msg);
      onError(msg);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess({
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'success',
      });
    }

    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* ... (tu UI idéntica: resumen, CardElement, errores, botones) ... */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Información de la Tarjeta *</label>
          <div className="border border-gray-300 rounded-lg p-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
            <CardElement options={cardElementOptions} />
          </div>
        </div>
        {paymentError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-red-700 text-sm font-medium">{paymentError}</p>
            </div>
          </div>
        )}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Shield className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">Pago 100% Seguro</span>
          </div>
          <p className="text-xs text-gray-600">
            Procesado por Stripe con encriptación SSL de 256 bits. Tu información está completamente protegida.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button type="button" onClick={onBack} className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </button>
          <button
            type="submit"
            disabled={!stripe || processing || !clientSecret}
            className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {processing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando Pago...</>) : (<><CreditCard className="h-4 w-4 mr-2" />Pagar ${paymentData.amount}</>)}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Página principal (con permisos) ---
const Payment: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentData, setPaymentData] = useState<PaymentData>({ amount: '', description: '', customerEmail: '', customerName: '' });
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const pkMissing = !pk;

  const products: Product[] = [
    { id: 1, name: 'Plan Básico', price: 29.99, description: 'Perfecto para empezar', features: ['Acceso completo por 1 mes', 'Soporte por email', 'Funciones básicas'] },
    { id: 2, name: 'Plan Premium', price: 49.99, description: 'El más popular', features: ['Acceso premium por 1 mes', 'Soporte prioritario', 'Funciones avanzadas', 'Analytics'] },
    { id: 3, name: 'Plan Anual', price: 299.99, description: 'Mejor valor', features: ['Acceso premium por 12 meses', 'Soporte 24/7', 'Todas las funciones', 'API Access', '2 meses gratis'] },
  ];

  // ... (tus handlers/validaciones iguales: handleProductSelect, validateStep2, etc.)

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setPaymentData((d) => ({ ...d, amount: product.price.toString(), description: product.name }));
    setCurrentStep(2);
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!paymentData.customerName.trim()) newErrors.customerName = 'El nombre es requerido';
    if (!paymentData.customerEmail.trim()) newErrors.customerEmail = 'El email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentData.customerEmail)) newErrors.customerEmail = 'Email inválido';
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) newErrors.amount = 'Monto inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePaymentSuccess = (result: PaymentResult) => { setPaymentResult(result); setCurrentStep(4); };
  const handlePaymentError   = (error: string) => { setPaymentResult({ error, status: 'error' }); };
  const resetPayment = () => {
    setCurrentStep(1);
    setPaymentResult(null);
    setSelectedProduct(null);
    setPaymentData({ amount: '', description: '', customerEmail: '', customerName: '' });
    setErrors({});
  };

  return (
    
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          {/* ... */}

          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {/* Paso 1 y 2 (idénticos a tu código) */}
              {/* ... */}

              {/* Paso 3: Pago (bloqueado si falta PK) */}
              {currentStep === 3 && (
                <div className="max-w-2xl mx-auto">
                  {pkMissing ? (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-yellow-800">
                      Falta configurar <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>. Define la variable de entorno y vuelve a intentar.
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

              {/* Paso 4: Confirmación (idéntico) */}
              {/* ... tu bloque actual ... */}
              {currentStep === 4 && (
                <div className="max-w-2xl mx-auto text-center">
                  {paymentResult?.status === 'success' ? (
                    // success UI...
                    <div>{/* ... */}</div>
                  ) : (
                    // error UI...
                    <div>{/* ... */}</div>
                  )}
                  <button onClick={resetPayment} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all">
                    {paymentResult?.status === 'success' ? 'Realizar Nuevo Pago' : 'Intentar Nuevamente'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500">🔒 Powered by Stripe • Todos los pagos son seguros y están encriptados</p>
          </div>
        </div>
      </div>
  );
};

export default Payment;
