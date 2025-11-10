// src/app/api/billing/tenants/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TENANTS_DIR = process.env.TENANTS_DIR || '/data/vivace-vivace-api';
const ENV_PREFIX = '.env.';

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function listEnvFiles(dir: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.startsWith(ENV_PREFIX) &&
          e.name.length > ENV_PREFIX.length,
      )
      .map((e) => path.join(dir, e.name));
  } catch (e: any) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }
}

export async function GET() {
  try {
    const files = await listEnvFiles(TENANTS_DIR);

    const tenants = await Promise.all(
      files.map(async (file) => {
        const base = path.basename(file);
        const tenantId = base.slice(ENV_PREFIX.length);
        const env = parseDotenv(await fs.readFile(file, 'utf8'));

        const realName = (env.REAL_NAME || env.NEXT_PUBLIC_REAL_NAME || '').trim();
        const appNameRaw = (env.APP_NAME || env.NEXT_PUBLIC_APP_NAME || '').trim();

        const companyName =
          realName ||
          (env.COMPANY_NAME || '').trim() ||
          (env.TENANT_NAME || '').trim() ||
          (env.APP_TENANT_NAME || '').trim() ||
          appNameRaw ||
          tenantId;

        return {
          tenantId,
          companyName,
        };
      }),
    );

    return NextResponse.json({ items: tenants });
  } catch (error: any) {
    console.error('Error listing tenants', error);
    return NextResponse.json(
      {
        error: true,
        message: error?.message || 'Unable to list tenants',
      },
      { status: 500 },
    );
  }
}
