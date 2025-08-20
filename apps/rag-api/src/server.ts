import Fastify from "fastify";
import adminRoutes from "./routes/admin.js";
import protectedRoutes from "./routes/protected.js";
import documentsRoutes from "./routes/documents.js";
import storageRoutes from "./routes/storage.js";

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ ok: true }));

// routes
app.register(adminRoutes);
app.register(protectedRoutes);
app.register(documentsRoutes);
app.register(storageRoutes);

if (require.main === module) {
  app.listen({ port: process.env.PORT ? Number(process.env.PORT) : 8080, host: "0.0.0.0" });
}

export default app;
