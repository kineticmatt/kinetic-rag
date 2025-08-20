"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = authGuard;
const db_js_1 = require("./db.js");
const argon2_1 = __importDefault(require("argon2"));
function parseBearer(req) {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/.exec(h);
    return m ? m[1].trim() : null;
}
function parseKeyId(apiKey) {
    // format: rk_<uuid>_<suffix>
    const m = /^rk_([0-9a-f-]{36})_/i.exec(apiKey);
    return m ? m[1] : null;
}
/**
 * Auth guard:
 *  - Validates Bearer API key against api_keys (argon2 hash)
 *  - Sets Postgres session variables app.tenant_id and app.group_ids
 *  - Attaches {tenantId, apiKeyId, groupsCsv} to req
 */
async function authGuard(req, reply) {
    const apiKey = parseBearer(req);
    if (!apiKey)
        return reply.code(401).send({ error: { code: "NO_AUTH", message: "Missing Bearer token" } });
    const keyId = parseKeyId(apiKey);
    if (!keyId)
        return reply.code(401).send({ error: { code: "BAD_KEY_FORMAT", message: "Malformed API key" } });
    const { rows } = await (0, db_js_1.query)(`select id, tenant_id, key_hash, revoked_at
     from api_keys
     where id = $1`, [keyId]);
    if (rows.length === 0 || rows[0].revoked_at) {
        return reply.code(401).send({ error: { code: "KEY_NOT_FOUND", message: "Invalid or revoked API key" } });
    }
    const { tenant_id, key_hash } = rows[0];
    const ok = await argon2_1.default.verify(key_hash, apiKey);
    if (!ok)
        return reply.code(401).send({ error: { code: "KEY_MISMATCH", message: "Invalid API key" } });
    // parse groups from header (comma-separated), e.g. "project:alpha,team:legal"
    const groupsCsv = String(req.headers["x-rag-groups"] || "").trim();
    // set Postgres session GUCs so RLS policies apply to all queries on this connection
    await (0, db_js_1.setSessionVars)(tenant_id, groupsCsv);
    // attach to request for handlers
    req.tenantId = tenant_id;
    req.apiKeyId = keyId;
    req.groupsCsv = groupsCsv;
}
