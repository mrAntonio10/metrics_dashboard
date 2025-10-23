'use client';

import React, { type PropsWithChildren, Suspense } from 'react';
import { RoleProvider } from '@/contexts/role-context';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

/** Simple error boundary to avoid breaking the whole portal UI */
class PortalLayoutBoundary extends React.Component<
  PropsWithChildren,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Keep it concise but useful in logs
    console.error('PortalLayout error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-4">
          Something went wrong while loading the portal layout.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PortalLayout({ children }: PropsWithChildren) {
  return (
    <PortalLayoutBoundary>
      <RoleProvider>
        <SidebarProvider>
          {/* Accessibility: quick skip to main content */}
          <a
            href="#portal-main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:ring"
          >
            Skip to content
          </a>

          {/* Sidebar + content shell */}
          <Suspense fallback={<aside aria-hidden="true" className="w-64" />}>
            <AppSidebar />
          </Suspense>

          <SidebarInset>
            <Suspense fallback={<div aria-hidden="true" className="h-14" />}>
              <AppHeader />
            </Suspense>

            <main id="portal-main" className="p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </RoleProvider>
    </PortalLayoutBoundary>
  );
}
