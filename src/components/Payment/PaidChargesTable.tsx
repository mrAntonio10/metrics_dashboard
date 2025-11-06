// src/components/Payment/PaidChargesTable.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Mail,
  User,
  Globe2,
  FileText,
  CheckCircle,
} from 'lucide-react';

interface PaidCharge {
  id: string;
  object: string;
  amount: number; // ya en decimales
  currency: string;
  description: string;
  name: string;
  email: string;
  country: string;
  networkTransactionId: string | null;
  created: number;
  receiptUrl: string | null;
  status: string;
}

interface PaidChargesApiResponse {
  items: PaidCharge[];
  hasMore: boolean;
  nextPage: string | null;
}

const pageSize = 10;

const PaidChargesTable: React.FC = () => {
  const [data, setData] = useState<PaidCharge[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentPageCursor, setCurrentPageCursor] = useState<string | null>(null);
  const [nextPageCursor, setNextPageCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);

  const fetchPage = async (cursor: string | null) => {
    try {
      setLoading(true);
      setError('');

      const url = new URL('/api/payments/charges', window.location.origin);
      url.searchParams.set('limit', String(pageSize));
      if (cursor) {
        url.searchParams.set('page', cursor);
      }

      const res = await fetch(url.toString());
      const json: PaidChargesApiResponse = await res.json();

      if (!res.ok) {
        throw new Error((json as any)?.message || 'Failed to load payments');
      }

      setData(json.items || []);
      setNextPageCursor(json.nextPage);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected error loading payments');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
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
    return d.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Paid Payments History
            </h1>
            <p className="text-sm text-slate-600">
              List of all successful Stripe charges (status:&nbsp;
              <span className="font-semibold text-emerald-600">succeeded</span>).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>Data fetched securely from your backend API.</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 md:p-5 space-y-4">
          {/* Status / error */}
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
                  <th className="px-3 py-2 font-medium">Txn ID (Network)</th>
                  <th className="px-3 py-2 font-medium">Charge ID</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Currency</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Object</th>
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
                        <span>Loading paid payments...</span>
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-4 text-center text-slate-400">
                      No paid charges found.
                    </td>
                  </tr>
                ) : (
                  data.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition"
                    >
                      <td className="px-3 py-2 align-top">
                        {c.networkTransactionId ? (
                          <span className="font-mono text-[10px] text-slate-800">
                            {c.networkTransactionId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="font-mono text-[10px] text-slate-700">
                          {c.id}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-900 font-semibold">
                        {formatAmount(c.amount, c.currency)}
                      </td>
                      <td className="px-3 py-2 align-top uppercase text-slate-600">
                        {c.currency}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">
                            {c.name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[160px]">
                            {c.email || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Globe2 className="w-3 h-3 text-slate-400" />
                          <span>{c.country || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[180px]">
                            {c.description || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="inline-flex items-center gap-1 text-emerald-600 text-[10px]">
                          <CheckCircle className="w-3 h-3" />
                          <span>{c.object}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[10px] text-slate-500">
                        {formatDate(c.created)}
                      </td>
                      <td className="px-3 py-2 align-top text-[10px]">
                        {c.receiptUrl ? (
                          <a
                            href={c.receiptUrl}
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
      </div>
    </div>
  );
};

export default PaidChargesTable;
