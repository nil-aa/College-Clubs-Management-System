import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const timeoutMs = Number(process.env.PRISMA_INTROSPECTION_TIMEOUT_MS || 60_000);

const result = spawnSync('prisma', ['db', 'pull'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: process.env.PRISMA_INTROSPECTION_DATABASE_URL || process.env.DATABASE_URL,
  },
  shell: process.platform === 'win32',
  timeout: timeoutMs,
});

if (result.error?.code === 'ETIMEDOUT') {
  console.error(`Prisma introspection timed out after ${timeoutMs} ms.`);
  console.error(
    'Check the Supabase connection string, database availability, and whether the selected pooler supports the configured credentials.',
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
