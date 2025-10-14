import type { ReactNode } from 'react';
import { RoleProvider } from '@/contexts/role-context';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
            <AppHeader />
            <div className="p-4 sm:p-6 lg:p-8">
                {children}
            </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  );
}
