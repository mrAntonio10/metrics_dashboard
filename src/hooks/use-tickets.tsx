// src/hooks/use-tickets.ts
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

export interface Ticket {
  ticketId: string;
  companyName: string;
  contactEmail: string;
  userType: string;
  applicationModule: string;
  issueStarted: string;
  description: string;
  urgencyLevel: string;
  status: string;
  comments: string;

  // ➜ opcionales (si el backend puede enviarlos)
  firstResponseAt?: string;       // ISO
  resolvedAt?: string;            // ISO
  firstResponseMinutes?: number;  // minutos hasta primera respuesta
  resolutionMinutes?: number;     // minutos hasta resolución
}

export interface SlaPolicy {
  goalFirstResponsePercent: number;     // p.ej. 95
  goalResolutionPercent: number;        // p.ej. 90
  targetFirstResponseMinutes: number;   // p.ej. 240 (4h)
  targetResolutionMinutes: number;      // p.ej. 2880 (48h)
}

export interface Pagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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
      // (opcional) política SLA aplicada por backend
      slaPolicy?: SlaPolicy;
      appliedFilters: {
        month: string;
        company: string;
        status?: string;
        urgency?: string;
      };
    };
  };
}

export interface Company {
  value: string;
  label: string;
}

export interface CompaniesResponse {
  success: boolean;
  data: { companies: Company[] };
}

export interface TicketFilters {
  month: string;     // 'all' | 'YYYY-MM'
  company: string;   // 'all' | nombre cliente
  status: string;    // 'all' | 'Resolved' | ...
  urgency: string;   // 'all' | 'High' | ...
  page: number;
  pageSize: number;
}

const DEFAULT_PAGINATION: Pagination = {
  currentPage: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TicketFilters>({
    month: 'all',
    company: 'all',
    status: 'all',
    urgency: 'all',
    page: 1,
    pageSize: 10,
  });

  // catálogos opcionales (si los manda n8n). Fuera de 'filters' para no disparar llamadas.
  const [availableStatuses, setAvailableStatuses] = useState<string[]>();
  const [availableUrgencies, setAvailableUrgencies] = useState<string[]>();
  const [slaPolicy, setSlaPolicy] = useState<SlaPolicy | undefined>(undefined);

  // Cargar compañías una sola vez (protegido contra StrictMode)
  const fetchedCompaniesRef = useRef(false);
  useEffect(() => {
    if (fetchedCompaniesRef.current) return;
    fetchedCompaniesRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/tickets/companies', { cache: 'no-store' });
        const data: CompaniesResponse = await res.json();
        if (data?.success && Array.isArray(data.data?.companies)) {
          setCompanies([{ value: 'all', label: 'All Clients' }, ...data.data.companies]);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    })();
  }, []);

  // Construir querystring a partir de filtros (incluir solo los != 'all')
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.month !== 'all') params.set('month', filters.month);
    if (filters.company !== 'all') params.set('company', filters.company);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.urgency !== 'all') params.set('urgency', filters.urgency);
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));
    return params.toString();
  }, [
    filters.month,
    filters.company,
    filters.status,
    filters.urgency,
    filters.page,
    filters.pageSize,
  ]);

  // Evitar refetch duplicados
  const lastQsRef = useRef<string>('');
  const inFlightRef = useRef<boolean>(false);

  // Fetch de tickets cuando cambia 'qs'
  useEffect(() => {
    // si no cambió el qs y hay petición en vuelo, no dispares otra
    if (qs === lastQsRef.current && inFlightRef.current) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/tickets?${qs}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data: TicketsResponse = await res.json();

        if (!data?.success) throw new Error('Backend error');

        // Datos principales
        setTickets(Array.isArray(data.data?.tickets) ? data.data.tickets : []);
        setPagination(data.data?.pagination ?? DEFAULT_PAGINATION);

        // Catálogos opcionales
        const f = data.data?.filters;
        if (Array.isArray(f?.availableStatuses)) setAvailableStatuses(f!.availableStatuses);
        else setAvailableStatuses(undefined);

        if (Array.isArray(f?.availableUrgencies)) setAvailableUrgencies(f!.availableUrgencies);
        else setAvailableUrgencies(undefined);

        // Política SLA opcional
        if (f?.slaPolicy) setSlaPolicy(f.slaPolicy);
        else setSlaPolicy(undefined);

        lastQsRef.current = qs;
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Error fetching tickets:', err);
          setError(err?.message ?? 'Network error occurred');
          setTickets([]);
          setPagination(DEFAULT_PAGINATION);
          setAvailableStatuses(undefined);
          setAvailableUrgencies(undefined);
          setSlaPolicy(undefined);
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [qs]);

  // Helpers
  const updateFilters = useCallback((patch: Partial<TicketFilters>) => {
    setFilters(prev => {
      const next: TicketFilters = { ...prev, ...patch };

      // resetear page si cambian filtros base o pageSize
      const baseChanged =
        (patch.month !== undefined && patch.month !== prev.month) ||
        (patch.company !== undefined && patch.company !== prev.company) ||
        (patch.status !== undefined && patch.status !== prev.status) ||
        (patch.urgency !== undefined && patch.urgency !== prev.urgency) ||
        (patch.pageSize !== undefined && patch.pageSize !== prev.pageSize);

      if (baseChanged) next.page = 1;

      const unchanged =
        prev.month === next.month &&
        prev.company === next.company &&
        prev.status === next.status &&
        prev.urgency === next.urgency &&
        prev.page === next.page &&
        prev.pageSize === next.pageSize;

      return unchanged ? prev : next;
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
    slaPolicy, // ➜ para calcular SLA Attainment en el componente
  };
};
