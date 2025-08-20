"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.setSessionVars = setSessionVars;
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({
    connectionString: process.env.DB_URL,
    max: 10,
    idleTimeoutMillis: 10000
});
/**
 * Set Postgres session variables for RLS enforcement.
 * - app.tenant_id  -> UUID string of the current tenant
 * - app.group_ids  -> CSV of groups (e.g., "project:alpha,team:legal")
 */
async function setSessionVars(tenantId, groupsCsv) {
    await exports.pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
    await exports.pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}
