// src/lib/tenantAgreements.ts
import mysql from 'mysql2/promise';
import type { TenantConfig } from './tenants';

export type AgreementRecord = {
    id: number;
    userId: number;
    agreementId: number;
    acceptedAt: string | null;
    acceptanceMethod: string | null;
    ipAddress: string | null;
    isCurrent: boolean;
    userFullName: string;
};

export type TenantAgreements = {
    tenantId: string;
    tenantName: string;
    agreements: AgreementRecord[];
    error?: string;
};

/**
 * Fetches user agreement acceptances for a specific tenant
 * Joins with users table to get full names
 */
export async function getAgreementsForTenant(
    tenant: TenantConfig,
): Promise<TenantAgreements> {
    let conn: mysql.Connection | null = null;

    try {
        conn = await mysql.createConnection(tenant.db);

        const query = `
      SELECT 
        uaa.id,
        uaa.user_id AS userId,
        uaa.agreement_id AS agreementId,
        uaa.accepted_at AS acceptedAt,
        uaa.acceptance_method AS acceptanceMethod,
        uaa.ip_address AS ipAddress,
        uaa.is_current AS isCurrent,
        CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.lastname, '')) AS userFullName
      FROM user_agreement_acceptances uaa
      LEFT JOIN users u ON uaa.user_id = u.id
      ORDER BY uaa.accepted_at DESC
    `;

        const [rows] = await conn.query(query);

        const agreements = (rows as any[]).map((row) => ({
            id: Number(row.id),
            userId: Number(row.userId),
            agreementId: Number(row.agreementId),
            acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
            acceptanceMethod: row.acceptanceMethod || null,
            ipAddress: row.ipAddress || null,
            isCurrent: Boolean(row.isCurrent),
            userFullName: (row.userFullName || '').trim() || 'Unknown User',
        }));

        return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            agreements,
        };
    } catch (e: any) {
        return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            agreements: [],
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
