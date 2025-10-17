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

export interface TicketsResponse {
  success: boolean;
  data: {
    tickets: Ticket[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    filters: {
      availableCompanies: string[];
      appliedFilters: {
        month: string;
        company: string;
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
  month: string;
  company: string;
  page: number;
  pageSize: number;
}

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TicketFilters>({
    month: '',
    company: '',
    page: 1,
    pageSize: 10,
  });

  // Cargar compañías al montar el componente
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Cargar tickets cuando cambien los filtros
  useEffect(() => {
    fetchTickets();
  }, [filters]);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/tickets/companies');
      const data: CompaniesResponse = await response.json();
      
      if (data.success) {
        setCompanies([
          { value: '', label: 'All Clients' },
          ...data.data.companies
        ]);
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
      if (filters.month) params.append('month', filters.month);
      if (filters.company) params.append('company', filters.company);
      params.append('page', filters.page.toString());
      params.append('pageSize', filters.pageSize.toString());

      const response = await fetch(`/api/tickets?${params.toString()}`);
      const data: TicketsResponse = await response.json();

      if (data.success) {
        setTickets(data.data.tickets);
        setPagination(data.data.pagination);
      } else {
        setError('Error fetching tickets');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const updateFilters = useCallback((newFilters: Partial<TicketFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset page when other filters change
      ...(newFilters.month !== undefined || newFilters.company !== undefined 
        ? { page: 1 } 
        : {}
      ),
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    updateFilters({ page });
  }, [updateFilters]);

  const changePageSize = useCallback((pageSize: number) => {
    updateFilters({ pageSize, page: 1 });
  }, [updateFilters]);

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