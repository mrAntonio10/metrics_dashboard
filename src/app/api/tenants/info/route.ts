import { NextRequest, NextResponse } from 'next/server';
import { loadTenants } from '@/lib/tenants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const tenants = await loadTenants();

        const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();

        // Si viene tenantId por queryParam, devolvemos solo ese tenant
        if (tenantId) {
            const tenant = tenants.find((t) => t.id === tenantId);

            if (!tenant) {
                return NextResponse.json(
                    { error: 'tenant_not_found' },
                    { status: 404 },
                );
            }

            const item = {
                tenantId: tenant.id,
                tenantName: tenant.name,
                status: tenant.management.status,
                expirationDate: tenant.management.date,
            };

            return NextResponse.json({ item });
        }

        // Sin tenantId: devolver todos los tenants (comportamiento original)
        const items = tenants.map((t) => ({
            tenantId: t.id,
            tenantName: t.name,
            status: t.management.status,
            expirationDate: t.management.date,
        }));

        return NextResponse.json({ items });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || 'failed_to_load_tenants' },
            { status: 500 },
        );
    }
}
