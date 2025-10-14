import { subDays, subMonths, format } from 'date-fns';
import type { Organization, Invoice, Subscription, UsageAggregate, SupportAggregate, IncidentSummary, FeedbackItem } from '@/lib/types';

const today = new Date();

// --- ORGANIZATIONS ---
export const organizations: Organization[] = [
  { id: 'org_1', name: 'Innovate Corp', plan: 'Enterprise', region: 'US-West', status: 'active' },
  { id: 'org_2', name: 'Synergy Solutions', plan: 'Pro', region: 'US-East', status: 'active' },
  { id: 'org_3', name: 'Quantum Dynamics', plan: 'Pro', region: 'EU-Central', status: 'active' },
  { id: 'org_4', name: 'Apex Innovations', plan: 'Enterprise', region: 'US-West', status: 'active' },
  { id: 'org_5', name: 'Stellar Systems', plan: 'Basic', region: 'US-East', status: 'trial' },
  { id: 'org_6', name: 'Momentum Labs', plan: 'Pro', region: 'US-East', status: 'active' },
  { id: 'org_7', name: 'Zenith Tech', plan: 'Enterprise', region: 'EU-Central', status: 'active' },
  { id: 'org_8', name: 'Horizon Ventures', plan: 'churned', region: 'US-West', status: 'churned' },
];

// --- INVOICES ---
export const invoices: Invoice[] = [
  { id: 'inv_1', organizationId: 'org_1', organizationName: 'Innovate Corp', amount: 5000, currency: 'USD', dueDate: subDays(today, 15), status: 'paid', tax: 400 },
  { id: 'inv_2', organizationId: 'org_2', organizationName: 'Synergy Solutions', amount: 1500, currency: 'USD', dueDate: subDays(today, 5), status: 'pending', tax: 120 },
  { id: 'inv_3', organizationId: 'org_3', organizationName: 'Quantum Dynamics', amount: 1500, currency: 'USD', dueDate: subDays(today, 35), status: 'overdue', tax: 120 },
  { id: 'inv_4', organizationId: 'org_4', organizationName: 'Apex Innovations', amount: 5000, currency: 'USD', dueDate: today, status: 'pending', tax: 400 },
  { id: 'inv_5', organizationId: 'org_1', organizationName: 'Innovate Corp', amount: 5000, currency: 'USD', dueDate: subDays(today, 45), status: 'paid', tax: 400 },
  { id: 'inv_6', organizationId: 'org_6', organizationName: 'Momentum Labs', amount: 1500, currency: 'USD', dueDate: subDays(today, 65), status: 'dunning', tax: 120 },
];

// --- SUBSCRIPTIONS ---
export const subscriptions: Subscription[] = organizations.map(org => ({
  id: `sub_${org.id}`,
  organizationId: org.id,
  cycle: org.plan === 'Enterprise' ? 'yearly' : 'monthly',
  seats: Math.floor(Math.random() * 41) + 10, // 10 to 50
  licensedSeats: 50,
  start: subMonths(today, Math.floor(Math.random() * 12) + 1),
  end: subMonths(today, -11),
  status: org.status === 'active' ? 'active' : 'canceled'
}));


// --- TIME SERIES DATA GENERATORS ---
const generateTimeSeries = (months: number, valueGen: (i: number) => number) => {
  return Array.from({ length: months }, (_, i) => {
    const date = subMonths(today, months - 1 - i);
    return {
      date: format(date, 'MMM yy'),
      value: valueGen(i),
    };
  });
};

export const mrrData = generateTimeSeries(12, i => 32000 + i * 500 + Math.random() * 1000);
export const dauData = generateTimeSeries(12, i => 1200 + i * 50 + Math.sin(i) * 100);
export const wauData = generateTimeSeries(12, i => 4500 + i * 100 + Math.sin(i) * 200);
export const mauData = generateTimeSeries(12, i => 8000 + i * 200 + Math.sin(i) * 500);

export const collectionsFunnelData = {
  attempted: 125000,
  succeeded: 115000,
  failed: 10000,
  recovered: 4500,
};

export const seatUsageData = [
  { name: 'Licensed', value: 850 },
  { name: 'Active', value: 620 },
];

export const uptimeData = generateTimeSeries(90, i => 99.95 - Math.sin(i / 10) * (i > 80 ? 0.5 : 0.05));
export const incidentData = generateTimeSeries(90, i => Math.max(0, 5 - Math.floor(i / 20) + (Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0)));


// --- BILLING DATA ---
export const arAgingData = [
    { name: '0-30 Days', value: 75000 },
    { name: '31-60 Days', value: 25000 },
    { name: '61-90 Days', value: 12000 },
    { name: '90+ Days', value: 5000 },
];

// --- USAGE DATA ---
export const featureAdoptionData = [
    { name: 'Patient Search', adoption: 95 },
    { name: 'Billing Codes', adoption: 88 },
    { name: 'Reporting V2', adoption: 72 },
    { name: 'Secure Messaging', adoption: 65 },
    { name: 'Appointment Scheduler', adoption: 58 },
    { name: 'E-Prescribe', adoption: 45 },
    { name: 'Analytics Dashboard', adoption: 32 },
    { name: 'User Management', adoption: 28 },
    { name: 'Custom Fields', adoption: 15 },
    { name: 'API Access', adoption: 4 },
];

export const activationFunnelData = [
  { step: 'Signed Up', value: 100 },
  { step: 'Invited User', value: 85 },
  { step: 'Created Record', value: 72 },
  { step: 'Ran Report', value: 55 },
  { step: 'First Value', value: 48 },
];

// --- SUPPORT DATA ---
export const ticketVolumeData = generateTimeSeries(12, i => 300 + Math.sin(i) * 50 + Math.random() * 20);
export const backlogData = generateTimeSeries(12, i => 80 - i * 2 + Math.cos(i) * 10);
export const csatData = generateTimeSeries(12, i => 4.6 + Math.sin(i) * 0.1);

// --- PLATFORM HEALTH ---
export const errorRateData = generateTimeSeries(90, i => 0.1 + Math.sin(i / 10) * 0.1 - (i/90 * 0.05) );
export const p95LatencyData = generateTimeSeries(90, i => 250 - i * 0.5 + Math.sin(i/5) * 20 );

export const incidents: IncidentSummary[] = [
    { id: 'inc_1', startedAt: subDays(today, 3), duration: 45, impactScope: 'minor', rootCauseCategory: 'infra', summary: '[REDACTED] Minor latency in EU-Central' },
    { id: 'inc_2', startedAt: subDays(today, 15), duration: 120, impactScope: 'major', rootCauseCategory: 'code', summary: '[REDACTED] API auth failures for new tenants' },
    { id: 'inc_3', startedAt: subDays(today, 40), duration: 15, impactScope: 'minor', rootCauseCategory: 'third-party', summary: '[REDACTED] Upstream provider performance degradation' },
    { id: 'inc_4', startedAt: subDays(today, 75), duration: 240, impactScope: 'critical', rootCauseCategory: 'infra', summary: '[REDACTED] Database failover event' },
];

// --- FEEDBACK ---
export const feedbackItems: FeedbackItem[] = [
    { id: 'fb_1', organizationId: 'org_1', organizationName: 'Innovate Corp', theme: 'Improved reporting filtering', votes: 15, status: 'planned' },
    { id: 'fb_2', organizationId: 'org_2', organizationName: 'Synergy Solutions', theme: 'Bulk user import', votes: 12, status: 'in-progress' },
    { id: 'fb_3', organizationId: 'org_3', organizationName: 'Quantum Dynamics', theme: 'Mobile app improvements', votes: 8, status: 'open' },
    { id: 'fb_4', organizationId: 'org_4', organizationName: 'Apex Innovations', theme: 'More granular permissions', votes: 22, status: 'planned' },
    { id: 'fb_5', organizationId: 'org_6', organizationName: 'Momentum Labs', theme: 'Customizable dashboards', votes: 5, status: 'open' },
    { id: 'fb_6', organizationId: 'org_1', organizationName: 'Innovate Corp', theme: 'Audit log export', votes: 18, status: 'shipped' },
];
