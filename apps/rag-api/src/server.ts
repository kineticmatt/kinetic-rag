import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ ok: true }));

if (require.main === module) {
  app.listen({ port: process.env.PORT ? Number(process.env.PORT) : 8080, host: "0.0.0.0" });
}

export default app;
