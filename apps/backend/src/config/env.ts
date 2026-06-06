import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Required — the server cannot start without a database connection
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  // Optional — AI scoring is gracefully skipped if absent
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid or missing environment variables:');
  const fieldErrors = parsedEnv.error.flatten().fieldErrors;
  for (const [field, errors] of Object.entries(fieldErrors)) {
    console.error(`  ${field}: ${(errors as string[]).join(', ')}`);
  }
  process.exit(1);
}

export const env = parsedEnv.data;
