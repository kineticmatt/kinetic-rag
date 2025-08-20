import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";
import dns from "node:dns";
import { URL } from "node:url";

/**
 * Build a Pool that prefers IPv4 to avoid ENETUNREACH on IPv6-only paths.
 * - Parses DB_URL
 * - Resolves hostname to an IPv4 with dns.resolve4
 * - If found, constructs Pool with host=<ipv4>; otherwise falls back to connectionString
 */

let poolSingleton: Pool | null = null;

interface PoolConfigWithLookup extends PoolConfig {
  // no additional fields required; we pass explicit fields when using IPv4 host
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
      resolve(addrs[0]);
    });
  });
}

export async function getPool(): Promise<Pool> {
  if (poolSingleton) return poolSingleton;

  const dbUrl = process.env.DB_URL || "";
  if (!dbUrl) throw new Error("DB_URL not set");

  const { user, password, host, port, database } = parseDbUrl(dbUrl);

  const ipv4 = await resolveIPv4OrNull(host);

  const cfg: PoolConfigWithLookup =
    ipv4
      ? {
          user,
          password,
          host: ipv4, // force IPv4 literal
          port,
          database,
          ssl: { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 10000,
        }
      : {
          connectionString: dbUrl, // fallback (may be IPv6 if only AAAA exists)
          ssl: { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 10000,
        };

  console.log("[boot] DB host chosen:", ipv4 ? `${ipv4} (from ${host})` : host);

  poolSingleton = new Pool(cfg);
  return poolSingleton!;
}

/**
 * Typed query helper.
 * Constrains T to QueryResultRow so pg types line up.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = await getPool();
  return pool.query<T>(text, params);
}

/**
 * Set Postgres session variables for RLS enforcement.
 * - app.tenant_id  -> UUID string of the current tenant
 * - app.group_ids  -> CSV of groups (e.g., "project:alpha,team:legal")
 */
export async function setSessionVars(tenantId: string, groupsCsv: string) {
  const pool = await getPool();
  await pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
  await pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}                                                                                                                    