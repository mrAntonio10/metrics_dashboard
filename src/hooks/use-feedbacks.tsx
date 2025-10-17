// src/hooks/use-feedback.ts
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

export interface FeedbackItem {
  opinionDate: string | null;
  companyName: string | null;
  contactEmail: string | null;
  userType: string | null;
  opinion: string | null;
}

export interface Pagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Company { value: string; label: string; }

const DEFAULT_PAGINATION: Pagination = {
  currentPage: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export interface FeedbackFilters {
  company: string; // 'all' | nombre exacto
  month: string;   // 'all' | 'YYYY-MM'
  page: number;
  pageSize: number;
}

export const useFeedback = () => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FeedbackFilters>({
    company: 'all',
    month: 'all',
    page: 1,
    pageSize: 10,
  });

  // cargar compañías 1 vez
  const fetchedCompaniesRef = useRef(false);
  useEffect(() => {
    if (fetchedCompaniesRef.current) return;
    fetchedCompaniesRef.current = true;
    (async () => {
      try {
        const res = await fetch('/api/feedback/companies', { cache: 'no-store' });
        const data = await res.json();
        const list = Array.isArray(data?.data?.companies) ? data.data.companies : [];
        setCompanies([{ value: 'all', label: 'All Clients' }, ...list]);
      } catch (e) {
        console.error('companies error', e);
      }
    })();
  }, []);

  // QS desde filtros: company + month + paginación
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.company !== 'all') p.set('company', filters.company);
    if (filters.month !== 'all')   p.set('month', filters.month);
    p.set('page', String(filters.page));
    p.set('pageSize', String(filters.pageSize));
    return p.toString();
  }, [filters]);

  const lastQsRef = useRef('');
  const inFlightRef = useRef(false);

  // fetch feedback cuando cambia qs
  useEffect(() => {
    if (qs === lastQsRef.current && inFlightRef.current) return;
    const controller = new AbortController();

    const run = async () => {
      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/feedback?${qs}`, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!data?.success) throw new Error('Backend error');

        setItems(Array.isArray(data.data?.feedback) ? data.data.feedback : []);
        setPagination(data.data?.pagination ?? DEFAULT_PAGINATION);
        lastQsRef.current = qs;
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err);
          setError(err?.message ?? 'Network error');
          setItems([]);
          setPagination(DEFAULT_PAGINATION);
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [qs]);

  // helpers
  const updateFilters = useCallback((patch: Partial<FeedbackFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...patch };
      const baseChanged =
        (patch.company !== undefined && patch.company !== prev.company) ||
        (patch.month   !== undefined && patch.month   !== prev.month)   ||
        (patch.pageSize !== undefined && patch.pageSize !== prev.pageSize);
      if (baseChanged) next.page = 1;
      // evita set si nada cambió
      if (
        next.company === prev.company &&
        next.month   === prev.month &&
        next.page    === prev.page &&
        next.pageSize === prev.pageSize
      ) return prev;
      return next;
    });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters(prev => (prev.page === page ? prev : { ...prev, page }));
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setFilters(prev =>
      prev.pageSize === pageSize ? prev : { ...prev, pageSize, page: 1 },
    );
  }, []);

  return { items, companies, pagination, loading, error, filters, updateFilters, goToPage, changePageSize };
};
