export interface Organization {
  id: string;
  name: string;
  plan: 'Basic' | 'Pro' | 'Enterprise';
  region: 'US-East' | 'US-West' | 'EU-Central';
  status: 'active' | 'churned' | 'trial';
}

export interface Invoice {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  currency: 'USD';
  dueDate: Date;
  status: 'paid' | 'pending' | 'overdue' | 'dunning';
  tax: number;
}

export interface Subscription {
  id: string;
  organizationId: string;
  cycle: 'monthly' | 'yearly';
  seats: number;
  licensedSeats: number;
  start: Date;
  end: Date;
  status: 'active' | 'canceled';
}

export interface UsageAggregate {
  organizationId: string;
  period: string; // YYYY-MM
  activeUsers: number;
  sessions: number;
  featureAdoption: Record<string, number>;
}

export interface SupportAggregate {
  organizationId: string;
  period: string; // YYYY-MM
  ticketsOpened: number;
  ticketsClosed: number;
  backlog: number;
  firstResponseSlaPct: number;
  resolutionSlaPct: number;
  csatAvg: number;
}

export interface IncidentSummary {
  id: string;
  startedAt: Date;
  duration: number; // in minutes
  impactScope: 'minor' | 'major' | 'critical';
  rootCauseCategory: 'infra' | 'code' | 'third-party';
  summary: string;
}

export interface FeedbackItem {
  id: string;
  organizationId: string;
  organizationName: string;
  theme: string;
  votes: number;
  status: 'open' | 'planned' | 'in-progress' | 'shipped';
}
