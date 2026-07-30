import { buildApp } from './app.js';
import { getEnv } from './config/env.js';
import { getDb } from './db/connection.js';

async function main() {
  const env = getEnv();
  const app = await buildApp();
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`NetViren API running on port ${env.API_PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
    } catch (err) {
      console.error('Error closing HTTP server:', err);
    }
    try {
      getDb().close();
    } catch (err) {
      console.error('Error closing database:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
