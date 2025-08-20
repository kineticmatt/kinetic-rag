import { Pool, PoolConfig } from "pg";
import dns from "node:dns";

// Extend PoolConfig to allow a custom lookup function
interface PoolConfigWithLookup extends PoolConfig {
  lookup?: (
    hostname: string,
    options: any,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  ) => void;
}

// Force IPv4 resolution
function ipv4Lookup(hostname: string, options: any, callback: any) {
  dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG }, callback);
}

const config: PoolConfigWithLookup = {
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
  lookup: ipv4Lookup,
};

export const pool = new Pool(config);

/**
 * Set Postgres session variables for RLS enforcement.
 * - app.tenant_id  -> UUID string of the current tenant
 * - app.group_ids  -> CSV of groups (e.g., "project:alpha,team:legal")
 */
export async function setSessionVars(tenantId: string, groupsCsv: string) {
  await pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
  await pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}
