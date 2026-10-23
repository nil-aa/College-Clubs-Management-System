import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

type GrantRow = {
  relname: string;
  relkind: string;
  relrowsecurity: boolean;
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  has_api_policy: boolean;
};

try {
  const rows = await db.$queryRawUnsafe<GrantRow[]>(`
    select
      c.relname,
      c.relkind,
      c.relrowsecurity,
      has_table_privilege('club_api', c.oid, 'SELECT') as can_select,
      has_table_privilege('club_api', c.oid, 'INSERT') as can_insert,
      has_table_privilege('club_api', c.oid, 'UPDATE') as can_update,
      has_table_privilege('club_api', c.oid, 'DELETE') as can_delete,
      exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
          and p.policyname like 'api_club_api%'
      ) as has_api_policy
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
    order by c.relname
  `);

  const failures = rows.filter((row) => {
    const audit = row.relname === 'audit_logs';
    const privilegesOk = audit
      ? row.can_select && row.can_insert && !row.can_update && !row.can_delete
      : row.can_select && row.can_insert && row.can_update && row.can_delete;
    return !privilegesOk || (row.relrowsecurity && !row.has_api_policy);
  });

  for (const row of rows) {
    console.log(
      `${row.relname}: select=${row.can_select} insert=${row.can_insert} update=${row.can_update} delete=${row.can_delete} rls=${row.relrowsecurity} api_policy=${row.has_api_policy}`,
    );
  }

  if (failures.length) {
    console.error(`API grant check failed for: ${failures.map((row) => row.relname).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('API grants and RLS policies are complete.');
  }
} finally {
  await db.$disconnect();
}
