import { NextRequest, NextResponse } from 'next/server';
import { loadTenants } from '@/lib/tenants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 👇 Ajusta esto al dominio REAL de tu frontend si quieres ser más estricto
// por ejemplo: 'https://app.itsvivace.com'
const ALLOWED_ORIGIN = '*';

const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    // Respuesta al preflight CORS
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
    try {
        const tenants = await loadTenants();

        const tenantKey = req.nextUrl.searchParams.get('tenantId')?.trim();

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

            const item = {
                tenantId: tenant.id,
                tenantName: tenant.name,
                status: tenant.management.status,
                expirationDate: tenant.management.date,
            };

            return NextResponse.json({ item }, { headers: corsHeaders });
        }

        const items = tenants.map((t) => ({
            tenantId: t.id,
            tenantName: t.name,
            status: t.management.status,
            expirationDate: t.management.date,
        }));

        return NextResponse.json({ items }, { headers: corsHeaders });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || 'failed_to_load_tenants' },
            {
                status: 500,
                headers: corsHeaders,
            },
        );
    }
}
