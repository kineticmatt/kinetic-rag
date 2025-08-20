import { Pool } from "pg";
export const pool = new Pool({
    connectionString: process.env.DB_URL,
    max: 10,
    idleTimeoutMillis: 10000
});
/**
 * Set Postgres session variables for RLS enforcement.
 * - app.tenant_id  -> UUID string of the current tenant
 * - app.group_ids  -> CSV of groups (e.g., "project:alpha,team:legal")
 */
export async function setSessionVars(tenantId, groupsCsv) {
    await pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
    await pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}
