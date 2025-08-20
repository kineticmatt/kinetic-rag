import { Pool, PoolConfig } from "pg";
import dns from "node:dns";
import { URL } from "node:url";

/**
 * Build a Pool that always uses IPv4 (A record) when possible.
 * - Parses DB_URL
 * - Resolves hostname to IPv4 with dns.resolve4
 * - If found, constructs a Pool with host=<ipv4>, port, user, password, database
 * - If not found, falls back to the DB_URL (will likely fail with IPv6)
 */

let poolSingleton: Pool | null = null;

// Extend PoolConfig (optional, not strictly needed in this version)
interface PoolConfigWithLookup extends PoolConfig {
  // no extra fields here; we’ll pass parsed fields explicitly
}

function parseDbUrl(dbUrl: string) {
  const u = new URL(dbUrl);
  const user = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  const host = u.hostname;
  const port = Number(u.port || "5432");
  const database = u.pathname.replace(/^\//, "") || "postgres";
  return { user, password, host, port, database };
}

async function resolveIPv4OrNull(host: string): Promise<string | null> {
  return new Promise((resolve) => {
    dns.resolve4(host, (err, addrs) => {
      if (err || !addrs || addrs.length === 0) return resolve(null);
      resolve(addrs[0]); // first A record
    });
  });
}

export async function getPool(): Promise<Pool> {
  if (poolSingleton) return poolSingleton;

  const dbUrl = process.env.DB_URL || "";
  if (!dbUrl) throw new Error("DB_URL not set");

  const { user, password, host, port, database } = parseDbUrl(dbUrl);

  // Try to force IPv4 by resolving an A record and using it as host
  const ipv4 = await resolveIPv4OrNull(host);

  const cfg: PoolConfigWithLookup = ipv4
    ? {
        user,
        password,
        host: ipv4, // <-- use IPv4 literal
        port,
        database,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 10000,
      }
    : {
        connectionString: dbUrl, // fallback (may hit IPv6)
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 10000,
      };

  // one-time boot log for clarity
  console.log("[boot] DB host chosen:", ipv4 ? `${ipv4} (from ${host})` : host);

  poolSingleton = new Pool(cfg);
  return poolSingleton!;
}

/**
 * Helpers that use the singleton pool
 */
export async function setSessionVars(tenantId: string, groupsCsv: string) {
  const pool = await getPool();
  await pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
  await pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const pool = await getPool();
  return pool.query(text, params);
}
