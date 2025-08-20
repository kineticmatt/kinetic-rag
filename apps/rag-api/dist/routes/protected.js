"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = protectedRoutes;
const auth_js_1 = require("../auth.js");
const ratelimit_js_1 = require("../ratelimit.js");
async function protectedRoutes(app) {
    app.addHook("preHandler", async (req, reply) => {
        await (0, auth_js_1.authGuard)(req, reply);
        if (reply.sent)
            return; // auth failed
        await (0, ratelimit_js_1.enforceRateLimit)(req.apiKeyId);
    });
    app.get("/whoami", async (req, reply) => {
        const rid = req.apiKeyId;
        const tid = req.tenantId;
        const groupsCsv = req.groupsCsv || "";
        reply.send({ api_key_id: rid, tenant_id: tid, groups: groupsCsv.split(",").filter(Boolean) });
    });
}
