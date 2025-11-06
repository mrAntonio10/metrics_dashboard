'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, Home, LifeBuoy, MessageSquare, Server, BarChart3, Settings as SettingsIcon, ShieldCheck, ReceiptText } from 'lucide-react';
import { Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { ProtectedComponent } from '@/hooks/use-permission';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/', label: 'Home', icon: Home, permission: 'page:home' },
  { href: '/billing', label: 'Billing', icon: CreditCard, permission: 'page:billing' },
  { href: '/usage', label: 'Usage', icon: BarChart3, permission: 'page:usage' },
  { href: '/support', label: 'Support', icon: LifeBuoy, permission: 'page:support' },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare, permission: 'page:feedback' },
  { href: '/payment', label: 'Payment', icon: CreditCard, permission: 'page:payment' },
  { href: '/payment-history', label: 'Payment History', icon: ReceiptText, permission: 'page:payment-history' },
];

const settingsNav = { href: '/settings', label: 'Settings', icon: SettingsIcon, permission: 'page:settings' };

export function AppSidebar() {
  const pathname = usePathname();

  const NavLink = ({ item }: { item: typeof navItems[0] | typeof settingsNav }) => {
    const isActive = pathname === '/' ? item.href === '/' : item.href !== '/' && pathname.startsWith(item.href);
    return (
      <ProtectedComponent permissionKey={item.permission}>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={item.label}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </ProtectedComponent>
    );
  };

  return (
    <Sidebar variant="inset" side="left">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 p-2" title="Aggregate Insights Home">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold text-sidebar-foreground">Aggregate Insights</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="flex-1">
          {navItems.map((item) => <NavLink key={item.href} item={item} />)}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <Separator className="my-2 bg-sidebar-border" />
        <SidebarMenu>
          <NavLink item={settingsNav} />
        </SidebarMenu>
        <div className="p-4 text-xs text-sidebar-foreground/60 space-y-2">
          <Badge variant="outline" className="border-green-500/50 text-green-400">HIPAA-Safe</Badge>
          <p>This is a prototype. No PHI is displayed.</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
