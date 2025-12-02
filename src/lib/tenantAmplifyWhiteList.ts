// src/app/lib/tenantAmplifyWhitelist.ts

export type TenantAmplifyEntry = {
    id: string;         // tenantId (ej: "stock1", "demo", etc.)
    name?: string;      // opcional: nombre legible si quieres matchear por tenantName
    url: string;        // Amplify URL
};

// 🔒 Whitelist de tenants permitidos y su URL de Amplify
const TENANT_AMPLIFY_WHITELIST: TenantAmplifyEntry[] = [
    {
        id: 'poweroftherapy',
        name: 'PowerOfTherapy',
        url: 'https://thepoweroftherapy-uqminds-com.d6o53m8qi0iet.amplifyapp.com/',
    },
    {
        id: 'test',
        name: 'Test',
        url: 'https://test-uqminds-com.dnuzin6r91h2f.amplifyapp.com/login',
    },
    {
        id: 'itsvivace',
        name: "Dianel (It's Vivace)",
        url: 'https://itsvivace-uqminds-com.d3707lwxt85vhg.amplifyapp.com/',
    },
    {
        id: 'demo',
        name: 'Demo',
        url: 'https://demo-uqminds-com.d2e34nag7v2xb2.amplifyapp.com/',
    },
    {
        id: 'stock1',
        name: 'Stock1 (Vivace V2)',
        url: 'https://stock1-uqminds.d1s3x56aiz8vf3.amplifyapp.com/home',
    },
];

// Helper principal
export function getAmplifyUrlForTenant(
    tenantId: string,
    tenantName?: string,
): string | undefined {
    const idKey = tenantId.toLowerCase();
    const nameKey = (tenantName || '').toLowerCase();

    const entry = TENANT_AMPLIFY_WHITELIST.find((e) => {
        const eid = e.id.toLowerCase();
        const ename = (e.name || '').toLowerCase();
        return eid === idKey || (ename && ename === nameKey);
    });

    return entry?.url;
}
