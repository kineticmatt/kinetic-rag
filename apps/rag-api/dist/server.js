"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
node_dns_1.default.setDefaultResultOrder("ipv4first");
const fastify_1 = __importDefault(require("fastify"));
const admin_js_1 = __importDefault(require("./routes/admin.js"));
const protected_js_1 = __importDefault(require("./routes/protected.js"));
const documents_js_1 = __importDefault(require("./routes/documents.js"));
const storage_js_1 = __importDefault(require("./routes/storage.js"));
const app = (0, fastify_1.default)({ logger: true });
app.get("/healthz", async () => ({ ok: true }));
// routes
app.register(admin_js_1.default);
app.register(protected_js_1.default);
app.register(documents_js_1.default);
app.register(storage_js_1.default);
if (require.main === module) {
    app.listen({
        port: process.env.PORT ? Number(process.env.PORT) : 8080,
        host: "0.0.0.0"
    });
}
exports.default = app;
