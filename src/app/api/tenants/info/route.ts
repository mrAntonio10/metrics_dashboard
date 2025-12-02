import { NextRequest, NextResponse } from 'next/server';
import { loadTenants } from '@/lib/tenants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const tenants = await loadTenants();

        const tenantKey = req.nextUrl.searchParams.get('tenantId')?.trim();

        // Si viene tenantId por queryParam, devolvemos solo ese tenant
        if (tenantKey) {
            const keyLower = tenantKey.toLowerCase();

            const tenant = tenants.find((t) => {
                const idLower = (t.id || '').toLowerCase();
                const nameLower = (t.name || '').toLowerCase();
                // 👉 match por ID (.env.stock1 => "stock1") o por APP_NAME/REAL_NAME ("Its V2 Vivace Test")
                return idLower === keyLower || nameLower === keyLower;
            });

            if (!tenant) {
                return NextResponse.json(
                    {
                        error: 'tenant_not_found',
                        tenantKey,
                        // opcional: datos para debug si quieres ver qué cargó del server
                        availableTenants: tenants.map((t) => ({
                            id: t.id,
                            name: t.name,
                            status: t.management.status,
                        })),
                    },
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

        // Sin tenantId: devolver todos los tenants
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
