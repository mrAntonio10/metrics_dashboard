# **App Name**: Aggregate Insights

## Core Features:

- Role-Based Dashboard Views: Client-side role toggles (OWNER, FINANCE, SUPPORT, CSM, ADMIN) to show/hide cards and modules.
- Executive Summary: Dashboard view aggregating key operational metrics, showing MRR/ARR, Collections funnel, active seats, uptime, and alerts.
- Billing & Revenue Insights: Display billing data (invoices, AR aging) and visualizations (dunning pipeline).
- Usage Analytics: DAU/WAU/MAU trends, feature adoption rates (suppressed if <5 tenants), and seat utilization.
- Support Operations Overview: Ticket volume analysis, SLA attainment metrics, and CSAT/NPS trends.
- Platform Health Monitoring: Monitor uptime, error rates, latency, release stability, and API quota utilization.
- Data Suppression Tool: Automatically apply k-anonymity by suppressing data for cohorts smaller than 5, with a visual suppression badge.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to evoke trust and security, aligning with the sensitivity of HIPAA data.
- Background color: Light blue-gray (#E8EAF6) for a clean, professional, and non-distracting background.
- Accent color: Teal (#009688) for interactive elements and key metrics, providing visual interest and emphasis.
- Font: 'Inter' (sans-serif) for body and headline text, providing a modern and neutral appearance with excellent readability.
- Use simple, line-based icons for navigation and key actions. Icons should be consistent in style and weight, and color-coded where appropriate to reinforce meaning.
- Employ a left sticky, collapsible sidebar for primary navigation with breadcrumbs/sub-tabs for secondary navigation. Use a grid-based layout to maintain consistency and responsiveness across different screen sizes.
- Use subtle transitions and animations to enhance the user experience and provide feedback on interactions (e.g., skeleton loaders, smooth scrolling).