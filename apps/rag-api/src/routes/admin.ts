import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { randomUUID } from "crypto";
import argon2 from "argon2";

function requireAdminSecret(headers: Record<string, any>) {
  const s = headers["x-admin-secret"];
  if (!s || s !== process.env.ADMIN_SECRET) {
    const err: any = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
}

export default async function adminRoutes(app: FastifyInstance) {
  // POST /admin/tenant { slug, name }
  app.post("/admin/tenant", async (req, reply) => {
    requireAdminSecret(req.headers as any);
    const { slug, name } = (req.body as any) || {};
    if (!slug || !name) return reply.code(400).send({ error: { code: "BAD_INPUT", message: "slug and name required" }});
    const r = await query(
      `insert into tenants (slug, name) values ($1, $2) returning id, slug, name`,
      [slug, name]
    );
    reply.send(r.rows[0]);
  });

  // POST /admin/keys { tenant_id, name }
  // returns plaintext api_key ONCE: rk_<keyId>_<random16>
  app.post("/admin/keys", async (req, reply) => {
    requireAdminSecret(req.headers as any);
    const { tenant_id, name } = (req.body as any) || {};
    if (!tenant_id || !name) return reply.code(400).send({ error: { code: "BAD_INPUT", message: "tenant_id and name required" }});

    const keyId = randomUUID();
    const rand = randomUUID().replace(/-/g, "").slice(0, 16);
    const plaintext = `rk_${keyId}_${rand}`;

    const hash = await argon2.hash(plaintext);
    const r = await query(
      `insert into api_keys (id, tenant_id, name, key_hash) values ($1, $2, $3, $4)
       returning id, tenant_id, name, created_at`,
      [keyId, tenant_id, name, hash]
    );
    reply.send({ ...r.rows[0], api_key: plaintext });
  });

  // GET /admin/keys?tenant_id=...
  app.get("/admin/keys", async (req, reply) => {
    requireAdminSecret(req.headers as any);
    const tenant_id = (req.query as any)?.tenant_id || null;
    const r = await query(
      `select id, tenant_id, name, created_at, revoked_at from api_keys
       where ($1::uuid is null or tenant_id = $1)
       order by created_at desc`,
      [tenant_id]
    );
    reply.send(r.rows);
  });

  // POST /admin/keys/revoke { id }
  app.post("/admin/keys/revoke", async (req, reply) => {
    requireAdminSecret(req.headers as any);
    const { id } = (req.body as any) || {};
    if (!id) return reply.code(400).send({ error: { code: "BAD_INPUT", message: "id required" }});
    await query(`update api_keys set revoked_at = now() where id = $1`, [id]);
    reply.send({ ok: true });
  });
}
