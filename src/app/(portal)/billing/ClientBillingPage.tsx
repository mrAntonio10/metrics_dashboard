// src/app/(portal)/billing/ClientBillingPage.tsx
'use client';

import { useMemo, useTransition, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import BillingHeader, { type Org } from './BillingHeader';
import TenantBillingCard from './TenantBillingCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BillingTable,
  type InvoiceLine,
  type BillingPagination,
} from '@/components/billing-table';

export type CountRow = {
  tenantId: string;
  tenantName: string;
  users: number;
  clients: number;
  admins: number;
  providers: number;
  management?: { status: string; date: string };
  error?: string;
};

const N8N_INVOICES_ENDPOINT =
  process.env.NEXT_PUBLIC_BILLING_API ||
  'https://n8n.uqminds.org/webhook/invoices/list';

/** API response typing (loose on purpose to tolerate shape changes) */
type InvoicesApiResponse = {
  data?: {
    invoices?: Array<Record<string, unknown>>;
    pagination?: Partial<BillingPagination> & {
      currentPage?: number | string;
      pageSize?: number | string;
      totalItems?: number | string;
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
  };
};

/** Guarded parser for a single invoice row */
function toInvoiceLine(r: Record<string, unknown>, idx: number): InvoiceLine {
  const getS = (k: string) =>
    typeof r[k] === 'string' ? (r[k] as string) : String(r[k] ?? '');
  const getN = (k: string) => {
    const v = Number(r[k]);
    return Number.isFinite(v) ? v : 0;
  };
  const description = getS('DESCRIPTION');
  return {
    id: `${description}-${idx}`,
    description,
    quantity: getN('QUANTITY'),
    rate: getN('RATE'),
    total: getN('TOTAL'),
    companyName: getS('COMPANY_NAME'),
    detail: getS('DETAIL'),
  };
}

/**
 * Intenta extraer la fecha de la fila:
 *  - Primero del campo DATE (si existe)
 *  - Si no, del inicio de DESCRIPTION: 'YYYY-MM-DD — ...'
 */
function extractInvoiceDate(r: Record<string, unknown>): string | null {
  const rawDate =
    typeof r['DATE'] === 'string' ? (r['DATE'] as string) : undefined;

  if (rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    return rawDate.slice(0, 10); // aseguramos 'YYYY-MM-DD'
  }

  const desc =
    typeof r['DESCRIPTION'] === 'string' ? (r['DESCRIPTION'] as string) : '';

  const m = desc.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Aplica filtro de fecha/rango en el FRONT:
 *  - ''                        -> no filtra
 *  - 'YYYY-MM-DD'             -> solo esa fecha
 *  - 'YYYY-MM-DD,YYYY-MM-DD'  -> rango [from, to] inclusivo
 */
function filterRowsBySelectedDate(
  rows: Array<Record<string, unknown>>,
  selectedDate: string,
): Array<Record<string, unknown>> {
  if (!selectedDate) return rows;

  const parts = selectedDate
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) return rows;

  const toTs = (d: string) => {
    const dt = new Date(`${d}T00:00:00Z`);
    return dt.getTime();
  };

  // Solo una fecha exacta
  if (parts.length === 1) {
    const target = parts[0];
    return rows.filter((r) => extractInvoiceDate(r) === target);
  }

  // Rango [from, to] inclusivo
  const fromStr = parts[0];
  const toStr = parts[1];

  const fromTs = toTs(fromStr);
  const toTsVal = toTs(toStr);

  if (!Number.isFinite(fromTs) || !Number.isFinite(toTsVal)) return rows;

  const min = Math.min(fromTs, toTsVal);
  const max = Math.max(fromTs, toTsVal);

  return rows.filter((r) => {
    const d = extractInvoiceDate(r);
    if (!d) return false;
    const ts = toTs(d);
    return ts >= min && ts <= max;
  });
}

export default function ClientBillingPage({
  orgs,
  counts,
  selectedClient,
}: {
  orgs: Org[];
  counts: CountRow[];
  selectedClient: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  /** Querystring: ?client= */
  const handleSelectClient = useCallback(
    (val: string) => {
      startTransition(() => {
        const params = new URLSearchParams(search.toString());
        if (!val || val === 'all') params.delete('client');
        else params.set('client', val);
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, search],
  );

  /** Human-readable company for API filter */
  const selectedCompanyName = useMemo(() => {
    if (selectedClient === 'all') return '';
    return (
      counts.find((c) => c.tenantId === selectedClient)?.tenantName || ''
    );
  }, [counts, selectedClient]);

  /** Per-tenant cards filter */
  const filtered = useMemo(
    () =>
      selectedClient === 'all'
        ? counts
        : counts.filter((c) => c.tenantId === selectedClient),
    [counts, selectedClient],
  );

  // ================= Date / range filter =================
  // '' => no filter
  // 'YYYY-MM-DD' => solo ese día
  // 'YYYY-MM-DD,YYYY-MM-DD' => rango inclusivo
  const [selectedDate, setSelectedDate] = useState<string>('');

  // ================= Invoices table state =================
  const [invoiceItems, setInvoiceItems] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pagination, setPagination] = useState<BillingPagination>({
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  /** Fetch invoices whenever filters or pagination change */
  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (selectedCompanyName) {
          params.set('company', selectedCompanyName);
        }

        // Mandamos la fecha/rango al backend por si en el futuro filtra,
        // pero de momento N8N no lo usa; el filtro real se hace en el front.
        if (selectedDate) {
          params.set('date', selectedDate);
        }

        params.set('page', String(pagination.currentPage));
        params.set('pageSize', String(pagination.pageSize));

        const url = `${N8N_INVOICES_ENDPOINT}?${params.toString()}`;
        const res = await fetch(url, {
          signal: abort.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as InvoicesApiResponse;

        const rows = Array.isArray(json?.data?.invoices)
          ? (json!.data!.invoices! as Array<Record<string, unknown>>)
          : [];

        // ⬇️ FILTRO POR FECHA / RANGO EN EL FRONT
        const filteredRows = filterRowsBySelectedDate(rows, selectedDate);

        const mapped = filteredRows.map((r, idx) =>
          toInvoiceLine(r as Record<string, unknown>, idx),
        );
        setInvoiceItems(mapped);

        const p = json?.data?.pagination ?? {};

        // OJO: aquí mantenemos la paginación base del backend.
        // Si quieres que el total cambie según el filtro, habría que
        // reconstruir paginación basada en `filteredRows` solamente.
        const totalPages = Math.max(1, Number(p.totalPages ?? 1));
        const currentPage = Math.min(
          totalPages,
          Math.max(1, Number(p.currentPage ?? pagination.currentPage)),
        );

        setPagination({
          currentPage,
          pageSize: Number(p.pageSize ?? pagination.pageSize),
          totalItems: Number(p.totalItems ?? mapped.length),
          totalPages,
          hasNextPage: Boolean(p.hasNextPage ?? currentPage < totalPages),
          hasPreviousPage: Boolean(
            p.hasPreviousPage ?? currentPage > 1,
          ),
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setErrorMsg(err?.message || 'Error loading invoices');
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyName, selectedDate, pagination.currentPage, pagination.pageSize]);

  const onPageChange = useCallback((p: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: p,
      hasPreviousPage: p > 1,
      hasNextPage: p < prev.totalPages,
    }));
  }, []);

  const onPageSizeChange = useCallback((size: number) => {
    setPagination((prev) => ({
      ...prev,
      pageSize: size,
      currentPage: 1,
      hasPreviousPage: false,
      hasNextPage: prev.totalPages > 1,
    }));
  }, []);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Active-user billing plus the Chats add-on."
      >
        <BillingHeader
          orgs={orgs}
          selectedClient={selectedClient}
          onSelect={handleSelectClient}
          selectedDate={selectedDate}
          onDateChange={(d) => {
            setSelectedDate(d);
            setPagination((s) => ({ ...s, currentPage: 1 }));
          }}
          onClearFilters={() => {
            setSelectedDate('');
            setPagination((s) => ({ ...s, currentPage: 1 }));
          }}
        />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <TenantBillingCard
            key={t.tenantId}
            tenant={t}
            onAdjust={(id) => console.log('adjust', id)}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            Invoice Lines ({pagination.totalItems})
            {errorMsg ? (
              <span className="ml-2 text-red-600 text-sm">
                · {errorMsg}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BillingTable
            items={invoiceItems}
            loading={loading}
            pagination={pagination}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </>
  );
}
