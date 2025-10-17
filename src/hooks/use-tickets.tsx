// src/hooks/use-tickets.ts
import { useState, useEffect, useCallback } from 'react';

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
  data: {
    companies: Company[];
  };
}

export interface TicketFilters {
  month: string;    // 'all' | 'YYYY-MM'
  company: string;  // 'all' | nombre cliente
  status: string;   // 'all' | 'Resolved' | ...
  urgency: string;  // 'all' | 'High' | ...
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

  // ✅ filtros: NO guardamos catálogos aquí para no re-disparar el efecto
  const [filters, setFilters] = useState<TicketFilters>({
    month: 'all',
    company: 'all',
    status: 'all',
    urgency: 'all',
    page: 1,
    pageSize: 10,
  });

  // ✅ catálogos (no afectan el efecto de fetchTickets)
  const [availableStatuses, setAvailableStatuses] = useState<string[] | undefined>(undefined);
  const [availableUrgencies, setAvailableUrgencies] = useState<string[] | undefined>(undefined);

  // -------- Companies: solo una vez al montar
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tickets/companies');
        const data: CompaniesResponse = await res.json();
        if (data.success) {
          setCompanies([{ value: 'all', label: 'All Clients' }, ...data.data.companies]);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    })();
  }, []);

  // -------- Tickets: 1ra vez con 'all', luego SOLO cuando cambian los filtros
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        // Solo mandamos filtros que no son 'all'
        if (filters.month !== 'all')   params.append('month', filters.month);
        if (filters.company !== 'all') params.append('company', filters.company);
        if (filters.status !== 'all')  params.append('status', filters.status);
        if (filters.urgency !== 'all') params.append('urgency', filters.urgency);
        params.append('page', String(filters.page));
        params.append('pageSize', String(filters.pageSize));

        const url = `/api/tickets?${params.toString()}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data: TicketsResponse = await res.json();

        if (!data.success) throw new Error('Backend error');

        setTickets(data.data.tickets);
        setPagination(data.data.pagination);

        // Guardar catálogos SIN tocar filters (evita 2da llamada)
        if (Array.isArray(data.data.filters?.availableStatuses)) {
          setAvailableStatuses(data.data.filters.availableStatuses!);
        }
        if (Array.isArray(data.data.filters?.availableUrgencies)) {
          setAvailableUrgencies(data.data.filters.availableUrgencies!);
        }
      } catch (err: any) {
        console.error('Error fetching tickets:', err);
        setError(err?.message ?? 'Network error occurred');
        setTickets([]);
        setPagination(DEFAULT_PAGINATION);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  // 👇 Dependencias SOLO de filtros base. Nada de catálogos aquí.
  }, [filters.month, filters.company, filters.status, filters.urgency, filters.page, filters.pageSize]);

  // -------- Helpers para actualizar filtros evitando sets innecesarios
  const updateFilters = useCallback((patch: Partial<TicketFilters>) => {
    setFilters(prev => {
      const next: TicketFilters = { ...prev, ...patch };

      // Si cambian filtros base (no 'page'), resetea page a 1
      const baseKeys: (keyof TicketFilters)[] = ['month', 'company', 'status', 'urgency', 'pageSize'];
      const changedBase = Object.keys(patch).some(
        (k) => baseKeys.includes(k as keyof TicketFilters) && k !== 'page'
      );
      if (changedBase) next.page = 1;

      // Evita setState si no cambió nada (reduce renders/llamadas)
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
      prev.pageSize === pageSize ? prev : { ...prev, pageSize, page: 1 }
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
    // 👉 expón los catálogos para llenar los combos
    catalogs: {
      availableStatuses,
      availableUrgencies,
    },
    // por si quieres forzar recarga manual
    // refetch: () => setFilters(f => ({ ...f })), // trigger suave sin cambiar valores
  };
};
