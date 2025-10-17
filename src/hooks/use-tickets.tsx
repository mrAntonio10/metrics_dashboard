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
      availableStatuses?: string[];   // 👈 nuevas listas del backend (opcional)
      availableUrgencies?: string[];  // 👈 nuevas listas del backend (opcional)
      appliedFilters: {
        month: string;
        company: string;
        status?: string;              // 👈 reflejo de lo aplicado por backend
        urgency?: string;             // 👈 reflejo de lo aplicado por backend
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
  month: string;                // 'all' | 'YYYY-MM'
  company: string;              // 'all' | nombre exacto
  status: string;               // 'all' | 'Resolved' | 'Created' | ...
  urgency: string;              // 'all' | 'High' | 'Medium' | ...
  page: number;
  pageSize: number;

  // opcionales (catálogos que puede devolver n8n)
  availableStatuses?: string[];
  availableUrgencies?: string[];
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

  // ✅ ahora incluye status y urgency
  const [filters, setFilters] = useState<TicketFilters>({
    month: 'all',
    company: 'all',
    status: 'all',
    urgency: 'all',
    page: 1,
    pageSize: 10,
    availableStatuses: undefined,
    availableUrgencies: undefined,
  });

  // Cargar compañías al montar el componente
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Cargar tickets cuando cambien los filtros
  useEffect(() => {
    fetchTickets();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/tickets/companies');
      const data: CompaniesResponse = await response.json();

      if (data.success) {
        setCompanies([{ value: 'all', label: 'All Clients' }, ...data.data.companies]);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.month && filters.month !== 'all')   params.append('month', filters.month);
      if (filters.company && filters.company !== 'all') params.append('company', filters.company);
      if (filters.status && filters.status !== 'all')   params.append('status', filters.status);     // 👈 nuevo
      if (filters.urgency && filters.urgency !== 'all')  params.append('urgency', filters.urgency);   // 👈 nuevo
      params.append('page', filters.page.toString());
      params.append('pageSize', filters.pageSize.toString());

      const url = `/api/tickets?${params.toString()}`;
      const response = await fetch(url);
      const data: TicketsResponse = await response.json();

      if (data.success) {
        setTickets(data.data.tickets);
        setPagination(data.data.pagination);

        // Catálogos disponibles (si vienen del backend)
        const availableStatuses  = data.data.filters?.availableStatuses ?? filters.availableStatuses;
        const availableUrgencies = data.data.filters?.availableUrgencies ?? filters.availableUrgencies;

        setFilters(prev => ({
          ...prev,
          availableStatuses,
          availableUrgencies,
        }));
      } else {
        setError('Error fetching tickets');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.month, filters.company, filters.status, filters.urgency, filters.page, filters.pageSize, filters.availableStatuses, filters.availableUrgencies]);

  const updateFilters = useCallback((newFilters: Partial<TicketFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...newFilters };

      // Si cambian filtros base (no la página), vuelve a page 1
      const baseKeys: (keyof TicketFilters)[] = ['month', 'company', 'status', 'urgency', 'pageSize'];
      const changedBase = Object.keys(newFilters).some(k => baseKeys.includes(k as keyof TicketFilters) && k !== 'page');
      if (changedBase) next.page = 1;

      return next;
    });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page: Math.max(1, page) }));
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setFilters(prev => ({ ...prev, pageSize, page: 1 }));
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
    refetch: fetchTickets,
  };
};
