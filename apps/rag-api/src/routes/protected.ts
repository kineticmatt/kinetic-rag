import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth.js";
import { enforceRateLimit } from "../ratelimit.js";

export default async function protectedRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    await authGuard(req, reply);
    if (reply.sent) return; // auth failed
    await enforceRateLimit((req as any).apiKeyId);
  });

  app.get("/whoami", async (req, reply) => {
    const rid = (req as any).apiKeyId;
    const tid = (req as any).tenantId;
    const groupsCsv = (req as any).groupsCsv || "";
    reply.send({ api_key_id: rid, tenant_id: tid, groups: groupsCsv.split(",").filter(Boolean) });
  });
}
