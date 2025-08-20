"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = documentsRoutes;
const db_js_1 = require("../db.js");
// Simple Upstash REST helpers
async function redisCmd(cmd) {
    const res = await fetch(`${process.env.REDIS_URL}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(cmd),
    });
    if (!res.ok)
        throw new Error(`Redis error: ${res.status} ${await res.text()}`);
    return res.json();
}
async function redisRPUSH(key, value) {
    await redisCmd(["RPUSH", key, value]);
}
async function documentsRoutes(app) {
    /**
     * POST /documents
     * Body: {
     *  tenant_slug: string,               // e.g., "kinetic"
     *  uri: string,                       // e.g., "playbooks/voice.md"
     *  title?: string,
     *  content_md: string,                // Markdown
     *  doc_type?: string,                 // e.g., "messaging"
     *  allow_groups?: string[]            // e.g., ["project:alpha","team:legal"]
     * }
     *
     * Requires: Bearer key (authGuard) sets req.tenantId, optionally X-RAG-Groups.
     */
    app.post("/documents", async (req, reply) => {
        const body = req.body;
        const { tenant_slug, uri, title, content_md, doc_type, allow_groups } = body || {};
        if (!tenant_slug || !uri || !content_md) {
            return reply
                .code(400)
                .send({ error: { code: "BAD_INPUT", message: "tenant_slug, uri, content_md required" } });
        }
        // write canonical MD to Supabase Storage
        // path: canonical-docs/{tenant_slug}/{uri}
        const storageUrl = process.env.SUPABASE_STORAGE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const objectPath = `canonical-docs/${tenant_slug}/${uri.replace(/^\/+/, "")}`;
        const upRes = await fetch(`${storageUrl}/object/${encodeURIComponent(objectPath)}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "text/markdown",
            },
            body: content_md,
        });
        if (!upRes.ok) {
            return reply.code(502).send({ error: { code: "STORAGE_WRITE_FAILED", message: await upRes.text() } });
        }
        // Upsert document row (RLS relies on req.tenantId set by auth middleware)
        const tenantId = req.tenantId;
        if (!tenantId) {
            return reply.code(401).send({ error: { code: "NO_TENANT", message: "Missing tenant in request context" } });
        }
        const r = await (0, db_js_1.query)(`insert into documents (tenant_id, uri, title, format, doc_type, allow_groups, status, updated_at)
       values ($1,$2,$3,'md',$4, coalesce($5,'{}'::text[]), 'needs_index', now())
       on conflict (tenant_id, uri) do update
         set title = excluded.title,
             doc_type = excluded.doc_type,
             allow_groups = excluded.allow_groups,
             status = 'needs_index',
             updated_at = now()
       returning id`, [tenantId, uri, title || null, doc_type || null, allow_groups || []]);
        const documentId = r.rows[0].id;
        // enqueue doc.saved job for worker
        const job = {
            type: "doc.saved",
            tenant_id: tenantId,
            tenant_slug,
            document_id: documentId,
            uri,
            canonical_path: objectPath,
            format: "md",
        };
        await redisRPUSH("q:doc.saved", JSON.stringify(job));
        reply.send({ ok: true, document_id: documentId });
    });
}
