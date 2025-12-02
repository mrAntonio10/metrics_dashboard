// src/lib/tenantAmplifyWhiteList.ts

export type TenantAmplifyEntry = {
    id: string;        // tenantId (ej: "stock1", "demo", etc.)
    label?: string;    // texto opcional para el botón
    url: string;       // Amplify URL
};

const TENANT_AMPLIFY_WHITELIST: TenantAmplifyEntry[] = [
    {
        id: 'potherapy',
        label: 'Open PowerOfTherapy',
        url: 'https://thepoweroftherapy-uqminds-com.d6o53m8qi0iet.amplifyapp.com/',
    },
    {
        id: 'test',
        label: 'Open Test',
        url: 'https://test-uqminds-com.dnuzin6r91h2f.amplifyapp.com/login',
    },
    {
        id: 'client1',
        label: "Open Dianel (It's Vivace)",
        url: 'https://itsvivace-uqminds-com.d3707lwxt85vhg.amplifyapp.com/',
    },
    {
        id: 'demo',
        label: 'Open Demo',
        url: 'https://demo-uqminds-com.d2e34nag7v2xb2.amplifyapp.com/',
    },
    {
        id: 'stock1',
        label: 'Open Stock1 (Vivace V2)',
        url: 'https://stock1-uqminds.d1s3x56aiz8vf3.amplifyapp.com/home',
    },
];

export function getAmplifyInfoForTenant(
    tenantId: string,
): { url: string; label: string } | undefined {
    const idKey = tenantId.toLowerCase();

    const found = TENANT_AMPLIFY_WHITELIST.find(
        (entry) => entry.id.toLowerCase() === idKey,
    );

    if (!found) return undefined;

    return {
        url: found.url,
        label: found.label ?? 'Open tenant app',
    };
}
