// src/hooks/use-tickets.ts
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

export interface Ticket { /* igual que tu interfaz */ 
  ticketId: string; companyName: string; contactEmail: string; userType: string;
  applicationModule: string; issueStarted: string; description: string;
  urgencyLevel: string; status: string; comments: string;
}
export interface Pagination {
  currentPage: number; pageSize: number; totalItems: number; totalPages: number;
  hasNextPage: boolean; hasPreviousPage: boolean;
}
export interface TicketsResponse {
  success: boolean;
  data: {
    tickets: Ticket[];
    pagination: Pagination;
    filters: {
      availableCompanies: string[];
      availableStatuses?: string[];
      availableUrgencies?: string[];
      appliedFilters: { month: string; company: string; status?: string; urgency?: string; };
    };
  };
}
export interface Company { value: string; label: string; }
export interface CompaniesResponse { success: boolean; data: { companies: Company[] } }

export interface TicketFilters {
  month: string;    // 'all' | 'YYYY-MM'
  company: string;  // 'all' | nombre cliente
  status: string;   // 'all' | 'Resolved' | ...
  urgency: string;  // 'all' | 'High' | ...
  page: number;
  pageSize: number;
}

const DEFAULT_PAGINATION: Pagination = {
  currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false,
};

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TicketFilters>({
    month: 'all', company: 'all', status: 'all', urgency: 'all', page: 1, pageSize: 10,
  });

  // catálogos opcionales (si los manda n8n). No forman parte de 'filters' para no disparar llamadas.
  const [availableStatuses, setAvailableStatuses]   = useState<string[] | undefined>(undefined);
  const [availableUrgencies, setAvailableUrgencies] = useState<string[] | undefined>(undefined);

  // Companies: solo una vez (si Strict Mode duplica, lo controlamos con ref)
  const fetchedCompaniesRef = useRef(false);
  useEffect(() => {
    if (fetchedCompaniesRef.current) return;
    fetchedCompaniesRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/tickets/companies', { cache: 'no-store' });
        const data: CompaniesResponse = await res.json();
        if (data.success) {
          setCompanies([{ value: 'all', label: 'All Clients' }, ...data.data.companies]);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    })();
  }, []);

  // Construye el QS a partir de filtros (solo incluye filtros != 'all')
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.month   !== 'all') params.set('month', filters.month);
    if (filters.company !== 'all') params.set('company', filters.company);
    if (filters.status  !== 'all') params.set('status', filters.status);
    if (filters.urgency !== 'all') params.set('urgency', filters.urgency);
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));
    return params.toString();
  }, [filters.month, filters.company, filters.status, filters.urgency, filters.page, filters.pageSize]);

  // Tickets: SOLO cuando cambia 'qs'
  const lastQsRef = useRef<string>('');
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    // Evita fetch duplicado si el QS no cambió o si ya hay uno en vuelo
    if (qs === lastQsRef.current && inFlightRef.current) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/tickets?${qs}`, { cache: 'no-store', signal: controller.signal });
        const data: TicketsResponse = await res.json();
        if (!data.success) throw new Error('Backend error');

        setTickets(data.data.tickets);
        setPagination(data.data.pagination);

        // catálogos (no tocan 'filters' → no disparan otra llamada)
        if (Array.isArray(data.data.filters?.availableStatuses)) {
          setAvailableStatuses(data.data.filters.availableStatuses!);
        }
        if (Array.isArray(data.data.filters?.availableUrgencies)) {
          setAvailableUrgencies(data.data.filters.availableUrgencies!);
        }

        lastQsRef.current = qs;
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Error fetching tickets:', err);
          setError(err?.message ?? 'Network error occurred');
          setTickets([]);
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

  // Helpers — no setean si no cambia el valor
  const updateFilters = useCallback((patch: Partial<TicketFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...patch };

      // Reset page si cambian filtros base
      if (
        (patch.month   !== undefined && patch.month   !== prev.month)   ||
        (patch.company !== undefined && patch.company !== prev.company) ||
        (patch.status  !== undefined && patch.status  !== prev.status)  ||
        (patch.urgency !== undefined && patch.urgency !== prev.urgency) ||
        (patch.pageSize !== undefined && patch.pageSize !== prev.pageSize)
      ) {
        next.page = 1;
      }

      const unchanged =
        prev.month   === next.month   &&
        prev.company === next.company &&
        prev.status  === next.status  &&
        prev.urgency === next.urgency &&
        prev.page    === next.page    &&
        prev.pageSize=== next.pageSize;

      return unchanged ? prev : next;
    });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters(prev => (prev.page === page ? prev : { ...prev, page }));
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setFilters(prev => (prev.pageSize === pageSize ? prev : { ...prev, pageSize, page: 1 }));
  }, []);

  return {
    tickets,
    companies,
    pagination,
    loading,
    error,
    filters,
    updateFilters,
    goToPage,
    changePageSize,
    catalogs: {
      availableStatuses,
      availableUrgencies,
    },
  };
};
