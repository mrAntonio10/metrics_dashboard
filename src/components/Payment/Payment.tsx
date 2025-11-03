// components/Payment/Payment.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { 
  CreditCard, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Loader2,
  ArrowLeft,
  DollarSign,
  User,
  Mail
} from 'lucide-react';

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

// Cargar Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Estilos para CardElement
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      fontFamily: '"Inter", "Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: true,
};

// Componente del formulario de pago
const PaymentForm: React.FC<PaymentFormProps> = ({ 
  paymentData, 
  onSuccess, 
  onError, 
  onBack 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Crear Payment Intent cuando el componente se monta
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parseFloat(paymentData.amount),
            customerEmail: paymentData.customerEmail,
            customerName: paymentData.customerName,
            description: paymentData.description,
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setClientSecret(data.clientSecret);
        } else {
          setPaymentError(data.error || 'Error creando el pago');
        }
      } catch (error) {
        setPaymentError('Error de conexión');
      }
    };

    if (paymentData.amount && paymentData.customerEmail) {
      createPaymentIntent();
    }
  }, [paymentData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

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
      setPaymentError(error.message || 'Error procesando el pago');
      onError(error.message || 'Error procesando el pago');
    } else if (paymentIntent.status === 'succeeded') {
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
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Información de Pago</h2>
        <p className="text-gray-600">Completa los datos de tu tarjeta para continuar</p>
      </div>
      
      {/* Resumen del pago */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Resumen del Pago
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-700">Producto:</span>
              <span className="font-medium text-blue-900">{paymentData.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Cliente:</span>
              <span className="font-medium text-blue-900">{paymentData.customerName}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-700">Email:</span>
              <span className="font-medium text-blue-900">{paymentData.customerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Monto:</span>
              <span className="text-xl font-bold text-blue-900">${paymentData.amount}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Información de la Tarjeta *
          </label>
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
          <button
            type="button"
            onClick={onBack}
            className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
            disabled={processing}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </button>
          <button
            type="submit"
            disabled={!stripe || processing || !clientSecret}
            className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando Pago...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar ${paymentData.amount}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// Componente principal
const Payment: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    amount: '',
    description: '',
    customerEmail: '',
    customerName: ''
  });
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Productos de ejemplo
  const products: Product[] = [
    { 
      id: 1, 
      name: 'Plan Básico', 
      price: 29.99, 
      description: 'Perfecto para empezar',
      features: ['Acceso completo por 1 mes', 'Soporte por email', 'Funciones básicas']
    },
    { 
      id: 2, 
      name: 'Plan Premium', 
      price: 49.99, 
      description: 'El más popular',
      features: ['Acceso premium por 1 mes', 'Soporte prioritario', 'Funciones avanzadas', 'Analytics']
    },
    { 
      id: 3, 
      name: 'Plan Anual', 
      price: 299.99, 
      description: 'Mejor valor',
      features: ['Acceso premium por 12 meses', 'Soporte 24/7', 'Todas las funciones', 'API Access', '2 meses gratis']
    }
  ];

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setPaymentData({
      ...paymentData,
      amount: product.price.toString(),
      description: product.name
    });
    setCurrentStep(2);
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!paymentData.customerName.trim()) {
      newErrors.customerName = 'El nombre es requerido';
    }
    
    if (!paymentData.customerEmail.trim()) {
      newErrors.customerEmail = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentData.customerEmail)) {
      newErrors.customerEmail = 'Email inválido';
    }
    
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      newErrors.amount = 'Monto inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePaymentSuccess = (result: PaymentResult) => {
    setPaymentResult(result);
    setCurrentStep(4);
  };

  const handlePaymentError = (error: string) => {
    setPaymentResult({ error, status: 'error' });
  };

  const resetPayment = () => {
    setCurrentStep(1);
    setPaymentResult(null);
    setSelectedProduct(null);
    setPaymentData({ amount: '', description: '', customerEmail: '', customerName: '' });
    setErrors({});
  };

  const steps = [
    { number: 1, title: 'Seleccionar' },
    { number: 2, title: 'Información' },
    { number: 3, title: 'Pago' },
    { number: 4, title: 'Confirmación' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Portal de Pagos</h1>
          <p className="text-xl text-gray-600">Proceso de pago seguro y confiable</p>
        </div>

        {/* Progress Steps */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    currentStep >= step.number 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > step.number ? '✓' : step.number}
                  </div>
                  <span className={`mt-2 text-sm font-medium ${
                    currentStep >= step.number ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 rounded-full transition-all ${
                    currentStep > step.number ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Paso 1: Selección de Producto */}
            {currentStep === 1 && (
              <div>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Selecciona tu Plan</h2>
                  <p className="text-gray-600">Elige el plan que mejor se adapte a tus necesidades</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="relative border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all group"
                    >
                      {product.id === 2 && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            Más Popular
                          </span>
                        </div>
                      )}
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                        <p className="text-gray-600 mb-4">{product.description}</p>
                        <div className="text-4xl font-bold text-blue-600 mb-4">
                          ${product.price}
                          <span className="text-sm text-gray-500 font-normal">/mes</span>
                        </div>
                        <ul className="space-y-2 text-sm text-gray-600 mb-6">
                          {product.features?.map((feature, idx) => (
                            <li key={idx} className="flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <div className="px-6 py-3 bg-gray-50 group-hover:bg-blue-50 rounded-lg font-medium text-gray-700 group-hover:text-blue-700 transition-colors">
                          Seleccionar Plan
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paso 2: Información del Cliente */}
            {currentStep === 2 && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Información del Cliente</h2>
                  <p className="text-gray-600">Completa tus datos para continuar con el pago</p>
                </div>
                
                {selectedProduct && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-blue-900">{selectedProduct.name}</h3>
                        <p className="text-blue-700 text-sm">{selectedProduct.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-blue-900">${selectedProduct.price}</span>
                        <p className="text-blue-700 text-sm">por mes</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="h-4 w-4 inline mr-2" />
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={paymentData.customerName}
                      onChange={(e) => setPaymentData({ ...paymentData, customerName: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        errors.customerName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Ingresa tu nombre completo"
                    />
                    {errors.customerName && (
                      <p className="text-red-600 text-sm mt-2 flex items-center">
                        <XCircle className="h-4 w-4 mr-1" />
                        {errors.customerName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="h-4 w-4 inline mr-2" />
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      value={paymentData.customerEmail}
                      onChange={(e) => setPaymentData({ ...paymentData, customerEmail: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        errors.customerEmail ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="tu@email.com"
                    />
                    {errors.customerEmail && (
                      <p className="text-red-600 text-sm mt-2 flex items-center">
                        <XCircle className="h-4 w-4 mr-1" />
                        {errors.customerEmail}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <DollarSign className="h-4 w-4 inline mr-2" />
                      Monto a Pagar *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-500 font-medium">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                          errors.amount ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.amount && (
                      <p className="text-red-600 text-sm mt-2 flex items-center">
                        <XCircle className="h-4 w-4 mr-1" />
                        {errors.amount}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Atrás
                  </button>
                  <button
                    onClick={() => {
                      if (validateStep2()) {
                        setCurrentStep(3);
                      }
                    }}
                    className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                  >
                    Continuar al Pago
                  </button>
                </div>
              </div>
            )}

            {/* Paso 3: Pago con Stripe */}
            {currentStep === 3 && (
              <div className="max-w-2xl mx-auto">
                <Elements stripe={stripePromise}>
                  <PaymentForm
                    paymentData={paymentData}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    onBack={() => setCurrentStep(2)}
                  />
                </Elements>
              </div>
            )}

            {/* Paso 4: Confirmación */}
            {currentStep === 4 && (
              <div className="max-w-2xl mx-auto text-center">
                {paymentResult?.status === 'success' ? (
                  <div>
                    <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">¡Pago Exitoso!</h2>
                    <p className="text-xl text-gray-600 mb-8">
                      Tu pago ha sido procesado correctamente. Te hemos enviado un recibo por email.
                    </p>
                    <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
                      <h3 className="font-semibold text-gray-900 mb-4 text-center">Detalles de la Transacción</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Producto:</span>
                            <span className="font-medium text-gray-900">{paymentData.description}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Cliente:</span>
                            <span className="font-medium text-gray-900">{paymentData.customerName}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium text-gray-900">{paymentData.customerEmail}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Monto:</span>
                            <span className="text-xl font-bold text-green-600">${paymentResult.amount}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ID de Transacción:</span>
                          <span className="font-mono text-sm text-gray-900">{paymentResult.paymentIntentId}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                      <XCircle className="h-12 w-12 text-red-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Error en el Pago</h2>
                    <p className="text-xl text-gray-600 mb-8">
                      {paymentResult?.error || 'Hubo un problema procesando tu pago. Por favor, intenta nuevamente.'}
                    </p>
                  </div>
                )}
                
                <button
                  onClick={resetPayment}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  {paymentResult?.status === 'success' ? 'Realizar Nuevo Pago' : 'Intentar Nuevamente'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            🔒 Powered by Stripe • Todos los pagos son seguros y están encriptados
          </p>
        </div>
      </div>
    </div>
  );
};

export default Payment;