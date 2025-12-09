// src/components/Payment/PaymentHistoryTabs.tsx
'use client';

import React, { useState } from 'react';
import { Building2, CreditCard } from 'lucide-react';
import BankPaymentsTable from './BankPaymentsTable';
import PaidChargesTable from './PaidChargesTable';

type PaymentMethodTab = 'bank_account' | 'card';

const PaymentHistoryTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PaymentMethodTab>('bank_account');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Payment History
          </h1>
          <p className="text-sm text-slate-600">
            View all successful payments processed through Stripe
          </p>
        </div>

        {/* Tabs Switcher */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <button
              onClick={() => setActiveTab('bank_account')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  activeTab === 'bank_account'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }
              `}
            >
              <Building2 className="w-4 h-4" />
              Bank Account Payments
            </button>

            <button
              onClick={() => setActiveTab('card')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  activeTab === 'card'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }
              `}
            >
              <CreditCard className="w-4 h-4" />
              Card Payments
            </button>
          </div>

          {/* Tab Content */}
          <div className="pt-2">
            {activeTab === 'bank_account' ? (
              <div>
                <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>
                    Showing payments made via <strong>Bank Account (ACH)</strong>
                  </span>
                </div>
                <BankPaymentsTable />
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>
                    Showing payments made via <strong>Credit/Debit Cards</strong>
                  </span>
                </div>
                <PaidChargesTable />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryTabs;
