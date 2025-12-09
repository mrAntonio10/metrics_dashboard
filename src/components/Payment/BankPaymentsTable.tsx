// src/components/Payment/BankPaymentsTable.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  User,
  FileText,
  CheckCircle,
} from 'lucide-react';

interface BankPayment {
  id: string;
  object: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName: string;
  status: string;
  paymentMethodType: string;
  bankDetails: {
    bankName: string | null;
    accountHolderType: string | null;
    accountType: string | null;
    last4: string | null;
    routingNumber: string | null;
  } | null;
  chargeInfo: {
    chargeId: string;
    receiptUrl: string | null;
    networkTransactionId: string | null;
  } | null;
  created: number;
  metadata?: Record<string, string>;
}

interface BankPaymentsApiResponse {
  items: BankPayment[];
  hasMore: boolean;
  nextPage: string | null;
}

const pageSize = 10;

const BankPaymentsTable: React.FC = () => {
  const [data, setData] = useState<BankPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPageCursor, setCurrentPageCursor] = useState<string | null>(null);
  const [nextPageCursor, setNextPageCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);

  const fetchPage = async (cursor: string | null) => {
    try {
      setLoading(true);
      setError('');

      const url = new URL('/api/payments/bank-payments', window.location.origin);
      url.searchParams.set('limit', String(pageSize));
      if (cursor) url.searchParams.set('page', cursor);

      const res = await fetch(url.toString());
      const json: BankPaymentsApiResponse = await res.json();

      if (!res.ok) {
        throw new Error((json as any)?.message || 'Failed to load bank payments');
      }

      setData(json.items || []);
      setNextPageCursor(json.nextPage);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected error loading bank payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = async () => {
    if (!nextPageCursor) return;
    setPreviousCursors((prev) => [...prev, currentPageCursor]);
    setCurrentPageCursor(nextPageCursor);
    await fetchPage(nextPageCursor);
  };

  const handlePrevious = async () => {
    if (previousCursors.length === 0) return;
    const newHistory = [...previousCursors];
    const prevCursor = newHistory.pop() || null;
    setPreviousCursors(newHistory);
    setCurrentPageCursor(prevCursor);
    await fetchPage(prevCursor);
  };

  const formatAmount = (amount: number, currency: string) =>
    `${amount.toFixed(2)} ${currency.toUpperCase()}`;

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);

    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = String(hours).padStart(2, '0');

    return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs md:text-sm text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-600">
              <th className="px-3 py-2 font-medium">Payment Intent ID</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Bank Name</th>
              <th className="px-3 py-2 font-medium">Account Type</th>
              <th className="px-3 py-2 font-medium">Last 4</th>
              <th className="px-3 py-2 font-medium">Customer Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading bank payments...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-slate-400">
                  No bank payments found.
                </td>
              </tr>
            ) : (
              data.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-slate-50 hover:bg-slate-50/60 transition"
                >
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono text-[10px] text-slate-700">
                      {payment.id}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-900 font-semibold">
                    {formatAmount(payment.amount, payment.currency)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[120px]">
                        {payment.bankDetails?.bankName || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-600">
                    <span className="capitalize">
                      {payment.bankDetails?.accountType || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono text-slate-700">
                      {payment.bankDetails?.last4 ? `****${payment.bankDetails.last4}` : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[120px]">
                        {payment.customerName || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[160px]">
                        {payment.customerEmail || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-1.5 text-slate-700">
                      <FileText className="w-3 h-3 text-slate-400 mt-0.5" />
                      <p className="text-[10px] md:text-xs leading-snug whitespace-pre-wrap break-words">
                        {payment.description || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex items-center gap-1 text-emerald-600 text-[10px]">
                      <CheckCircle className="w-3 h-3" />
                      <span className="capitalize">{payment.status}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-[10px] text-slate-500">
                    {formatDate(payment.created)}
                  </td>
                  <td className="px-3 py-2 align-top text-[10px]">
                    {payment.chargeInfo?.receiptUrl ? (
                      <a
                        href={payment.chargeInfo.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between pt-3">
        <button
          onClick={handlePrevious}
          disabled={previousCursors.length === 0 || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs
                     border-slate-200 text-slate-600 hover:bg-slate-50
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-3 h-3" />
          Previous
        </button>

        <div className="text-[10px] text-slate-500">
          Page history: {previousCursors.length + 1}
        </div>

        <button
          onClick={handleNext}
          disabled={!nextPageCursor || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs
                     border-slate-200 text-slate-600 hover:bg-slate-50
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default BankPaymentsTable;
