"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.query = query;
exports.setSessionVars = setSessionVars;
const pg_1 = require("pg");
const node_dns_1 = __importDefault(require("node:dns"));
const node_url_1 = require("node:url");
/**
 * Build a Pool that prefers IPv4 to avoid ENETUNREACH on IPv6-only paths.
 * - Parses DB_URL
 * - Resolves hostname to an IPv4 with dns.resolve4
 * - If found, constructs Pool with host=<ipv4>; otherwise falls back to connectionString
 */
let poolSingleton = null;
function parseDbUrl(dbUrl) {
    const u = new node_url_1.URL(dbUrl);
    const user = decodeURIComponent(u.username);
    const password = decodeURIComponent(u.password);
    const host = u.hostname;
    const port = Number(u.port || "5432");
    const database = u.pathname.replace(/^\//, "") || "postgres";
    return { user, password, host, port, database };
}
async function resolveIPv4OrNull(host) {
    return new Promise((resolve) => {
        node_dns_1.default.resolve4(host, (err, addrs) => {
            if (err || !addrs || addrs.length === 0)
                return resolve(null);
            resolve(addrs[0]);
        });
    });
}
async function getPool() {
    if (poolSingleton)
        return poolSingleton;
    const dbUrl = process.env.DB_URL || "";
    if (!dbUrl)
        throw new Error("DB_URL not set");
    const { user, password, host, port, database } = parseDbUrl(dbUrl);
    const ipv4 = await resolveIPv4OrNull(host);
    const cfg = ipv4
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
    poolSingleton = new pg_1.Pool(cfg);
    return poolSingleton;
}
/**
 * Typed query helper.
 * Constrains T to QueryResultRow so pg types line up.
 */
async function query(text, params) {
    const pool = await getPool();
    return pool.query(text, params);
}
/**
 * Set Postgres session variables for RLS enforcement.
 * - app.tenant_id  -> UUID string of the current tenant
 * - app.group_ids  -> CSV of groups (e.g., "project:alpha,team:legal")
 */
async function setSessionVars(tenantId, groupsCsv) {
    const pool = await getPool();
    await pool.query("select set_config('app.tenant_id', $1, true);", [tenantId]);
    await pool.query("select set_config('app.group_ids', $1, true);", [groupsCsv]);
}
