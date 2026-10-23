/* eslint-disable no-undef */
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_JWT_SECRET: z.string().optional().or(z.literal('')),
  SUPABASE_JWT_ISSUER: z.string().url().optional(),
  SUPABASE_JWT_AUDIENCE: z.string().min(1).default('authenticated'),
  API_CORS_ORIGINS: z.string().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type ApiConfig = z.infer<typeof envSchema> & {
  jwtMode: 'jwks' | 'secret';
  corsOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must not be set in apps/api. The API uses the club_api database role.',
    );
  }
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid API configuration: ${parsed.error.message}`);
  }
  const jwks = Boolean(parsed.data.SUPABASE_JWKS_URL);
  const secret = Boolean(parsed.data.SUPABASE_JWT_SECRET);
  if (jwks === secret) {
    throw new Error('Configure exactly one of SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET.');
  }
  return {
    ...parsed.data,
    jwtMode: jwks ? 'jwks' : 'secret',
    corsOrigins: parsed.data.API_CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
