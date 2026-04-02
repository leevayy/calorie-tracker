import { pool } from "./db/client.ts";
import { env } from "./env.ts";
import { buildApp } from "./app.ts";

async function start(): Promise<void> {
  const app = await buildApp();

  app.addHook("onClose", async () => {
    await pool.end();
  });

  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
