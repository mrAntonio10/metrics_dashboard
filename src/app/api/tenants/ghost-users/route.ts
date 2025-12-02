// src/app/api/tenants/ghost-users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loadTenants } from '@/lib/tenants';
import { getGhostUsersForTenant } from '@/lib/tenantGhostUsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ORIGIN = '*';

const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
    try {
        const tenants = await loadTenants();
        const tenantKey = req.nextUrl.searchParams.get('tenantId')?.trim();

        // If specific tenant requested
        if (tenantKey) {
            const keyLower = tenantKey.toLowerCase();
            const tenant = tenants.find((t) => {
                const idLower = (t.id || '').toLowerCase();
                const nameLower = (t.name || '').toLowerCase();
                return idLower === keyLower || nameLower === keyLower;
            });

            if (!tenant) {
                return NextResponse.json(
                    {
                        error: 'tenant_not_found',
                        tenantKey,
                    },
                    {
                        status: 404,
                        headers: corsHeaders,
                    },
                );
            }

            const result = await getGhostUsersForTenant(tenant);
            return NextResponse.json({ item: result }, { headers: corsHeaders });
        }

        // Fetch ghost users for all tenants
        const items = await Promise.all(
            tenants.map((tenant) => getGhostUsersForTenant(tenant)),
        );

        return NextResponse.json({ items }, { headers: corsHeaders });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || 'failed_to_load_ghost_users' },
            {
                status: 500,
                headers: corsHeaders,
            },
        );
    }
}
