"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminRoutes;
const db_js_1 = require("../db.js");
const crypto_1 = require("crypto");
const argon2_1 = __importDefault(require("argon2"));
function requireAdminSecret(headers) {
    const s = headers["x-admin-secret"];
    if (!s || s !== process.env.ADMIN_SECRET) {
        const err = new Error("Forbidden");
        err.statusCode = 403;
        throw err;
    }
}
async function adminRoutes(app) {
    // POST /admin/tenant { slug, name }
    app.post("/admin/tenant", async (req, reply) => {
        requireAdminSecret(req.headers);
        const { slug, name } = req.body || {};
        if (!slug || !name)
            return reply.code(400).send({ error: { code: "BAD_INPUT", message: "slug and name required" } });
        const r = await db_js_1.pool.query(`insert into tenants (slug, name) values ($1, $2) returning id, slug, name`, [slug, name]);
        reply.send(r.rows[0]);
    });
    // POST /admin/keys { tenant_id, name }
    // returns plaintext api_key ONCE: rk_<keyId>_<random16>
    app.post("/admin/keys", async (req, reply) => {
        requireAdminSecret(req.headers);
        const { tenant_id, name } = req.body || {};
        if (!tenant_id || !name)
            return reply.code(400).send({ error: { code: "BAD_INPUT", message: "tenant_id and name required" } });
        const keyId = (0, crypto_1.randomUUID)();
        const rand = (0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 16);
        const plaintext = `rk_${keyId}_${rand}`;
        const hash = await argon2_1.default.hash(plaintext);
        const r = await db_js_1.pool.query(`insert into api_keys (id, tenant_id, name, key_hash) values ($1, $2, $3, $4)
       returning id, tenant_id, name, created_at`, [keyId, tenant_id, name, hash]);
        reply.send({ ...r.rows[0], api_key: plaintext });
    });
    // GET /admin/keys?tenant_id=...
    app.get("/admin/keys", async (req, reply) => {
        requireAdminSecret(req.headers);
        const tenant_id = req.query?.tenant_id || null;
        const r = await db_js_1.pool.query(`select id, tenant_id, name, created_at, revoked_at from api_keys
       where ($1::uuid is null or tenant_id = $1)
       order by created_at desc`, [tenant_id]);
        reply.send(r.rows);
    });
    // POST /admin/keys/revoke { id }
    app.post("/admin/keys/revoke", async (req, reply) => {
        requireAdminSecret(req.headers);
        const { id } = req.body || {};
        if (!id)
            return reply.code(400).send({ error: { code: "BAD_INPUT", message: "id required" } });
        await db_js_1.pool.query(`update api_keys set revoked_at = now() where id = $1`, [id]);
        reply.send({ ok: true });
    });
}
