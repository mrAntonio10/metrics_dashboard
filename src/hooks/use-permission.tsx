'use client'

import { useRole, type Role } from '@/contexts/role-context';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

const PERMISSIONS: Record<string, Role[]> = {
    // Page access
    'page:home': ['OWNER', 'FINANCE', 'SUPPORT', 'CSM', 'ADMIN'],
    'page:billing': ['OWNER', 'FINANCE', 'ADMIN'],
    'page:usage': ['OWNER', 'CSM', 'SUPPORT', 'ADMIN'],
    'page:support': ['OWNER', 'SUPPORT', 'CSM', 'ADMIN'],
    'page:feedback': ['OWNER', 'CSM', 'SUPPORT', 'ADMIN'],
    'page:settings': ['ADMIN'],
    'page:payment': ['OWNER', 'FINANCE', 'SUPPORT', 'CSM', 'ADMIN'],
    'page:payment-history': ['OWNER', 'FINANCE', 'SUPPORT', 'CSM', 'ADMIN'],
    // Widget access
    'widget:mrr_arr': ['OWNER', 'FINANCE', 'ADMIN'],
    'widget:collections': ['OWNER', 'FINANCE', 'ADMIN'],
    'widget:seat_usage': ['OWNER', 'CSM', 'ADMIN'],
    'widget:uptime_incidents': ['OWNER', 'SUPPORT', 'CSM', 'ADMIN'],
    'widget:invoices': ['OWNER', 'FINANCE', 'ADMIN'],
    'widget:dunning_pipeline': ['FINANCE', 'ADMIN'],
    'widget:ar_aging': ['FINANCE', 'ADMIN'],
    'widget:dau_mau': ['OWNER', 'CSM', 'ADMIN'],
    'widget:feature_adoption': ['OWNER', 'CSM', 'ADMIN'],
    'widget:activation_funnel': ['OWNER', 'CSM', 'ADMIN'],
    'widget:ticket_volume': ['SUPPORT', 'CSM', 'ADMIN'],
    'widget:sla_attainment': ['SUPPORT', 'CSM', 'OWNER', 'ADMIN'],
    'widget:csat': ['SUPPORT', 'CSM', 'OWNER', 'ADMIN'],
    'widget:api_keys': ['ADMIN'],
    'widget:portal_users': ['ADMIN'],

    // Action access
    'action:export_data': ['OWNER', 'FINANCE', 'ADMIN'],
    'action:invite_user': ['ADMIN'],
};

export function usePermission(permissionKey: string) {
    const { role } = useRole();
    const allowedRoles = PERMISSIONS[permissionKey];

    if (!allowedRoles) {
        console.warn(`Permission key "${permissionKey}" not found.`);
        return false;
    }

    return allowedRoles.includes(role);
}


export function ProtectedComponent({
    permissionKey,
    children,
    fallback,
}: {
    permissionKey: string,
    children: ReactNode,
    fallback?: ReactNode,
}) {
    const hasPermission = usePermission(permissionKey);

    if (hasPermission) {
        return <>{children}</>;
    }

    return fallback === undefined ? <AccessDeniedFallback /> : fallback;
}

export function AccessDeniedFallback() {
    return (
        <Card className="flex h-full min-h-[200px] items-center justify-center bg-muted/30 shadow-none">
            <CardContent className="p-6 text-center text-muted-foreground">
                <Lock className="mx-auto h-8 w-8" />
                <p className="mt-2 text-sm font-medium">Access Denied</p>
                <p className="mt-1 text-xs">You do not have permission to view this section.</p>
            </CardContent>
        </Card>
    );
}
