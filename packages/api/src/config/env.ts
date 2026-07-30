import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  DATABASE_PATH: z.string().default('/var/lib/netviren/db/netviren.db'),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().default('http://localhost:3000'),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  AGENT_HANDLER_PORT: z.coerce.number().default(4001),
  VT_API_KEY: z.string().default(''),
  VT_API_URL: z.string().default('https://www.virustotal.com/api/v3'),
  DISCORD_WEBHOOK_URL: z.string().default(''),
  SCAN_INTERVAL_MINUTES: z.coerce.number().default(60),
  PORT_RANGES: z.string().default('20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017'),
  PACKET_RETENTION_DAYS: z.coerce.number().default(7),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  AGENT_SECRET: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;
export function getEnv(): Env {
  if (!_env) _env = envSchema.parse(process.env);
  return _env;
}
