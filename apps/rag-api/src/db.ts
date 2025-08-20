import { Pool } from "pg";
import dns from "node:dns";

// Force IPv4 for pg's hostname resolution
function ipv4Lookup(hostname: string, options: any, callback: any) {
  dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG }, callback);
}

export const pool = new Pool({
  connectionString: process.env.DB_URL,
  // Supabase requires SSL; 'require' matches the URI’s ?sslmode=require
  ssl: { rejectUnauthorized: false },
  // Force IPv4 DNS resolution even if AAAA records are present
  lookup: ipv4Lookup
});

/**
 * Set Postgres session variables for RLS enforcement.
 * - app.tenant_id  -> UUID string of the current tenant
 * - app.group_ids  -> CSV of groups (e.g., "project:alpha,team:legal")
 */
export async function setSessionVars(tenantId: string, groupsCsv: string) {
  await pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
  await pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}
