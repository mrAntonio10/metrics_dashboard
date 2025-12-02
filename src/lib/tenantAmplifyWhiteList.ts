// src/lib/tenantAmplifyWhiteList.ts

export type TenantAmplifyEntry = {
    id: string;          // tenantId base (normalmente sufijo del .env)
    url: string;         // Amplify URL
    label?: string;      // texto opcional del botón
    aliases?: string[];  // otros identificadores / nombres posibles
};

const TENANT_AMPLIFY_WHITELIST: TenantAmplifyEntry[] = [
    {
        id: 'potherapy',
        aliases: ['power of therapy', 'poweroftherapy', 'the power of therapy'],
        label: 'Open PowerOfTherapy',
        url: 'https://thepoweroftherapy-uqminds-com.d6o53m8qi0iet.amplifyapp.com/',
    },
    {
        id: 'test',
        aliases: ['test fastxo', 'fastxo test'],
        label: 'Open Test',
        url: 'https://test-uqminds-com.dnuzin6r91h2f.amplifyapp.com/login',
    },
    {
        id: 'client1',
        aliases: ['its vivace', "it's vivace", 'its vivace dianel'],
        label: "Open Dianel (It's Vivace)",
        url: 'https://itsvivace-uqminds-com.d3707lwxt85vhg.amplifyapp.com/',
    },
    {
        id: 'demo',
        aliases: ['stock2'],
        label: 'Open Demo',
        url: 'https://demo-uqminds-com.d2e34nag7v2xb2.amplifyapp.com/',
    },
    {
        id: 'stock1',
        aliases: ['its v2 vivace test', 'vivace v2', 'stock1 vivace'],
        label: 'Open Stock1 (Vivace V2)',
        url: 'https://stock1-uqminds.d1s3x56aiz8vf3.amplifyapp.com/home',
    },
];

function normalize(value?: string | null): string {
    return (value ?? '').trim().toLowerCase();
}

/**
 * Busca la URL de Amplify para un tenant usando:
 *  - tenantId (id de .env.*)
 *  - tenantName (nombre que ves en la card)
 *  - aliases configurados en el whitelist
 */
export function getAmplifyInfoForTenant(
    tenantId: string,
    tenantName?: string,
): { url: string; label: string } | undefined {
    const idKey = normalize(tenantId);
    const nameKey = normalize(tenantName);

    const found = TENANT_AMPLIFY_WHITELIST.find((entry) => {
        const entryId = normalize(entry.id);
        const aliases = (entry.aliases ?? []).map(normalize);

        // Match por id
        if (idKey && (idKey === entryId || aliases.includes(idKey))) {
            return true;
        }

        // Match por nombre visible
        if (nameKey && (nameKey === entryId || aliases.includes(nameKey))) {
            return true;
        }

        return false;
    });

    if (!found) {
        return undefined;
    }

    return {
        url: found.url,
        label: found.label ?? 'Open tenant app',
    };
}
