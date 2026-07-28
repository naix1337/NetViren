import { buildApp } from './app.js';
import { getEnv } from './config/env.js';

async function main() {
  const env = getEnv();
  const app = await buildApp();
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`NetViren API running on port ${env.API_PORT}`);
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
