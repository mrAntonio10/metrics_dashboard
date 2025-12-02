// src/lib/tenantGhostUsers.ts
import mysql from 'mysql2/promise';
import type { TenantConfig } from './tenants';

export type GhostUser = {
    id: number;
    name: string;
    lastname: string;
    email: string;
};

export type TenantGhostUsers = {
    tenantId: string;
    tenantName: string;
    ghostUsers: GhostUser[];
    error?: string;
};

/**
 * Fetches "ghost users" for a specific tenant
 * Ghost users are users who can log in (password_changed=1) but are not in the providers table
 */
export async function getGhostUsersForTenant(
    tenant: TenantConfig,
): Promise<TenantGhostUsers> {
    let conn: mysql.Connection | null = null;

    try {
        conn = await mysql.createConnection(tenant.db);

        const query = `
      SELECT 
        u.id,
        u.name,
        u.lastname,
        u.email
      FROM users u
      WHERE u.password_changed = 1
        AND u.id NOT IN (SELECT user_id FROM providers WHERE user_id IS NOT NULL)
      ORDER BY u.email
    `;

        const [rows] = await conn.query(query);

        const ghostUsers = (rows as any[]).map((row) => ({
            id: Number(row.id),
            name: row.name || '',
            lastname: row.lastname || '',
            email: row.email || '',
        }));

        return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            ghostUsers,
        };
    } catch (e: any) {
        return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            ghostUsers: [],
            error: e?.code || e?.message || 'query_failed',
        };
    } finally {
        try {
            await conn?.end();
        } catch {
            // ignore cleanup errors
        }
    }
}
