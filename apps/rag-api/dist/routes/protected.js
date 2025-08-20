import { authGuard } from "../auth.js";
import { enforceRateLimit } from "../ratelimit.js";
export default async function protectedRoutes(app) {
    app.addHook("preHandler", async (req, reply) => {
        await authGuard(req, reply);
        if (reply.sent)
            return; // auth failed
        await enforceRateLimit(req.apiKeyId);
    });
    app.get("/whoami", async (req, reply) => {
        const rid = req.apiKeyId;
        const tid = req.tenantId;
        const groupsCsv = req.groupsCsv || "";
        reply.send({ api_key_id: rid, tenant_id: tid, groups: groupsCsv.split(",").filter(Boolean) });
    });
}
