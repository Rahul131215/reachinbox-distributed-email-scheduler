import { PrismaClient } from '@prisma/client';

export interface PostgresHealthStatus {
  connected: boolean;
  databaseUrlConfigured: boolean;
  databaseUrlRedacted: string;
  pingMs?: number;
  tableCounts?: {
    tenants: number;
    campaigns: number;
    emailJobs: number;
  };
  error?: string;
}

let prismaInstance: PrismaClient | null = null;

const DEFAULT_DATABASE_URL =
  'postgresql://reachinbox:reachinbox_secure_pass@localhost:5432/reachinbox_scheduler?schema=public';

export function getPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: [],
    });
  }
  return prismaInstance;
}

export function redactDatabaseUrl(url?: string): string {
  if (!url) return 'NOT_CONFIGURED';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '******';
    }
    return parsed.toString();
  } catch {
    return 'CONFIGURED (INVALID_URL_FORMAT)';
  }
}

export async function checkPostgresHealth(): Promise<PostgresHealthStatus> {
  const dbUrl = process.env.DATABASE_URL;
  const redactedUrl = redactDatabaseUrl(dbUrl);

  if (!dbUrl) {
    return {
      connected: false,
      databaseUrlConfigured: false,
      databaseUrlRedacted: redactedUrl,
      error: 'DATABASE_URL environment variable is missing or empty. Please set DATABASE_URL in .env',
    };
  }

  const prisma = getPrismaClient();
  const startTime = Date.now();

  try {
    // Run direct query against PostgreSQL
    await Promise.race([
      prisma.$queryRaw`SELECT 1 as health_check`,
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('PostgreSQL connection timeout (2500ms)')), 2500)
      ),
    ]);

    const pingMs = Date.now() - startTime;

    let tableCounts = { tenants: 0, campaigns: 0, emailJobs: 0 };
    try {
      const [tenants, campaigns, emailJobs] = await Promise.all([
        prisma.tenant.count(),
        prisma.campaign.count(),
        prisma.emailJob.count(),
      ]);
      tableCounts = { tenants, campaigns, emailJobs };
    } catch {
      // Tables might need migration
    }

    return {
      connected: true,
      databaseUrlConfigured: true,
      databaseUrlRedacted: redactedUrl,
      pingMs,
      tableCounts,
    };
  } catch (err: any) {
    return {
      connected: false,
      databaseUrlConfigured: true,
      databaseUrlRedacted: redactedUrl,
      error: err?.message || 'Failed to connect to PostgreSQL database',
    };
  }
}
