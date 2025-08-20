import type { FastifyInstance } from "fastify";

async function redisCmd(cmd: any[]) {
  const res = await fetch(`${process.env.REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status} ${await res.text()}`);
  return res.json();
}
async function redisRPUSH(key: string, value: string) {
  await redisCmd(["RPUSH", key, value]);
}

/**
 * POST /webhooks/storage
 * Body example (you control the emitter from KineticOS/your app):
 * {
 *   "tenant_id": "...uuid...",
 *   "tenant_slug": "kinetic",
 *   "event": "updated" | "created" | "deleted",
 *   "bucket": "uploads",
 *   "key": "uploads/kinetic/docs/nda_v7.docx",
 *   "doc_type": "nda",
 *   "allow_groups": ["project:alpha","team:legal"],
 *   "title": "NDA v7"
 * }
 */
export default async function storageRoutes(app: FastifyInstance) {
  app.post("/webhooks/storage", async (req, reply) => {
    const body = req.body as any;
    const { tenant_id, tenant_slug, event, bucket, key, doc_type, allow_groups, title } = body || {};
    if (!tenant_id || !tenant_slug || !event || !bucket || !key) {
      return reply.code(400).send({ error: { code: "BAD_INPUT", message: "missing required fields" }});
    }

    if (event === "deleted") {
      // enqueue delete (handled later)
      await redisRPUSH("q:doc.saved", JSON.stringify({
        type: "doc.deleted",
        tenant_id, tenant_slug, bucket, key
      }));
      return reply.send({ ok: true });
    }

    // Only handle .docx/.pdf here; MD should use /documents
    const lower = String(key).toLowerCase();
    const ext = lower.endsWith(".docx") ? "docx" : lower.endsWith(".pdf") ? "pdf" : null;
    if (!ext) return reply.code(202).send({ ok: true, info: "ignored extension" });

    const job = {
      type: "doc.saved",
      tenant_id, tenant_slug,
      source_bucket: bucket,
      source_key: key,
      source_ext: ext,
      // write canonical MD to:
      canonical_path: `canonical-docs/${tenant_slug}/${key.replace(/^uploads\/[^/]+\//,'').replace(/\.(docx|pdf)$/i,'.md')}`,
      // doc metadata defaults
      uri: key.replace(/^uploads\/[^/]+\//,'').replace(/\.(docx|pdf)$/i,'.md'),
      title: title || key.split("/").pop(),
      format: ext, // original
      doc_type: doc_type || null,
      allow_groups: allow_groups || []
    };
    await redisRPUSH("q:doc.saved", JSON.stringify(job));
    reply.send({ ok: true });
  });
}
