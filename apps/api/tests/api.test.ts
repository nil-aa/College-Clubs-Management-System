import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig, type ApiConfig } from '../src/shared/config/index.js';
import type { M1Repository } from '../src/shared/db/repository.js';
import { AuthorizationService } from '../src/shared/authz/service.js';
import { ClubService } from '../src/modules/clubs/service.js';

const admin = '00000000-0000-0000-0000-000000000001';
const student = '00000000-0000-0000-0000-000000000002';
const clubA = '10000000-0000-0000-0000-000000000001';
const clubB = '10000000-0000-0000-0000-000000000002';

function config(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    DATABASE_URL: 'postgresql://club_api:password@localhost:6543/postgres',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_JWKS_URL: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
    SUPABASE_JWT_SECRET: '',
    SUPABASE_JWT_ISSUER: 'https://example.supabase.co/auth/v1',
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    API_CORS_ORIGINS: 'http://localhost:5173',
    API_PORT: 3001,
    API_RATE_LIMIT: 120,
    LOG_LEVEL: 'info',
    jwtMode: 'jwks' as const,
    corsOrigins: ['http://localhost:5173'],
    ...overrides,
  };
}

function repository(overrides: Partial<M1Repository> = {}) {
  const base: M1Repository = {
    transaction: async (work) => work(base),
    isProfileActive: async () => true,
    getProfile: async (id) => ({
      id,
      full_name: 'User',
      email: `${id}@example.test`,
      roll_number: null,
      department: null,
      year_of_study: null,
      phone: null,
      is_active: true,
      avatar_url: null,
      bio: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    updateProfile: async (id, input) =>
      ({
        ...(await base.getProfile(id))!,
        ...input,
        full_name: String(input.full_name ?? 'User'),
      }) as any,
    getPermissionSnapshot: async (id) =>
      id === admin
        ? { roles: [{ code: 'admin', clubId: null }], permissions: [] }
        : { roles: [{ code: 'student', clubId: null }], permissions: [] },
    listClubs: async () => [],
    getClub: async () => null,
    getClubHeads: async () => [],
    getManagedClubs: async () => [],
    createClub: async () => {
      throw { code: 'P2002' };
    },
    updateClub: async () => {
      throw new Error('not implemented');
    },
    setClubActive: async () => {
      throw new Error('not implemented');
    },
    getRole: async () => ({ id: 'role', code: 'club_head' }),
    getUser: async (id) => base.getProfile(id),
    getActiveClubHeadAssignment: async () => null,
    deactivateStudentRole: async () => undefined,
    ensureClubHeadRole: async () => undefined,
    activateOrCreateClubHeadAssignment: async () => ({ id: 'assignment' }),
    deactivateClubHeadAssignment: async () => ({ id: 'assignment' }),
    searchUsers: async () => [],
    insertAudit: async () => 1n,
    insertNotification: async () => 'notification',
    insertNotifications: async () => 0,
    getActiveStudentIds: async () => [],
    listNotifications: async () => ({ rows: [], total: 0 }),
    countUnreadNotifications: async () => 0,
    markNotificationRead: async () => true,
    markAllNotificationsRead: async () => 0,
    listAuditLogs: async () => ({ rows: [], total: 0 }),
    getAdminDashboardStats: async () => ({
      active_club_count: 0,
      inactive_club_count: 0,
      clubs_without_head_count: 0,
      users_by_role: [],
      recent_audit_logs: [],
    }),
    listRoles: async () => [],
    listRoleAssignments: async () => [],
    setUserRole: async () => ({ id: 'assignment' }),
  };
  Object.assign(base, overrides);
  return base;
}

function appFor(repo = repository(), tokenUser: Record<string, string> = { admin, student }) {
  return createApp({
    config: config(),
    repository: repo,
    verifier: async (token) => ({
      userId: tokenUser[token] ?? token,
      email: `${token}@example.test`,
    }),
  });
}

describe('API foundation', () => {
  it('returns health without authentication and rejects missing tokens', async () => {
    const app = appFor();
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/users/me')).status).toBe(401);
  });

  it('rejects students from admin routes', async () => {
    const response = await request(appFor())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${student}`);
    expect(response.status).toBe(403);
  });

  it('rejects students from faculty OD review routes', async () => {
    const response = await request(appFor())
      .get('/api/faculty/od-sheets')
      .set('Authorization', `Bearer ${student}`);
    expect(response.status).toBe(403);
  });

  it('validates Faculty Coordinator assignment path ids', async () => {
    const response = await request(appFor())
      .post('/api/admin/users/not-a-uuid/faculty-assignments')
      .set('Authorization', `Bearer ${admin}`)
      .send({ club_id: clubA });
    expect(response.status).toBe(400);
  });

  it('returns validation errors in the documented shape', async () => {
    const response = await request(appFor())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${admin}`)
      .send({ full_name: '' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for an expired or otherwise invalid token', async () => {
    const app = createApp({
      config: config(),
      repository: repository(),
      verifier: async () => {
        throw new Error('JWT expired');
      },
    });
    expect(
      (await request(app).get('/api/users/me').set('Authorization', 'Bearer expired-token')).status,
    ).toBe(401);
  });

  it('maps duplicate club names to 409', async () => {
    const response = await request(appFor())
      .post('/api/admin/clubs')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Existing club' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rejects an unknown CORS origin', async () => {
    const response = await request(appFor())
      .get('/api/health')
      .set('Origin', 'https://unknown.example');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('rate limits requests', async () => {
    const app = createApp({
      config: config({ API_RATE_LIMIT: 1 }),
      repository: repository(),
      verifier: async (token) => ({ userId: token }),
    });
    await request(app).get('/api/health');
    expect((await request(app).get('/api/health')).status).toBe(429);
  });
});

describe('authz parity', () => {
  it('allows admins globally and limits club heads to their active club', async () => {
    const repo = repository({
      getPermissionSnapshot: async (id) =>
        id === admin
          ? { roles: [{ code: 'admin', clubId: null }], permissions: [] }
          : {
              roles: [{ code: 'club_head', clubId: clubA }],
              permissions: [{ code: 'clubs.manage', clubId: clubA }],
            },
    });
    const authz = new AuthorizationService(repo);
    expect(await authz.canManageClub(admin, clubB)).toBe(true);
    expect(await authz.canManageClub(student, clubA)).toBe(true);
    expect(await authz.canManageClub(student, clubB)).toBe(false);
  });

  it('does not treat a deactivated Club Head assignment as authorization', async () => {
    const repo = repository({
      getPermissionSnapshot: async () => ({
        roles: [{ code: 'club_head', clubId: null }],
        permissions: [],
      }),
    });
    const authz = new AuthorizationService(repo);
    expect(await authz.canManageClub(student, clubA)).toBe(false);
  });

  it('hides inactive clubs from students', async () => {
    const repo = repository({
      getClub: async () => ({
        id: clubB,
        name: 'Closed',
        slug: 'closed',
        description: null,
        category: null,
        contact_email: null,
        is_active: false,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    await expect(
      new ClubService(repo, new AuthorizationService(repo)).detail(student, clubB),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('side effects', () => {
  it('runs audit and notification only after a successful head assignment', async () => {
    const calls = { audit: 0, notification: 0 };
    const repo = repository({
      getClub: async () => ({
        id: clubA,
        name: 'Chess',
        slug: 'chess',
        description: null,
        category: null,
        contact_email: null,
        is_active: true,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      insertAudit: async () => {
        calls.audit += 1;
        return 1n;
      },
      insertNotification: async () => {
        calls.notification += 1;
        return 'n';
      },
    });
    await new ClubService(repo, new AuthorizationService(repo)).assignHead(admin, clubA, student);
    expect(calls).toEqual({ audit: 1, notification: 1 });
  });

  it('does not write side effects when a duplicate head assignment is rejected', async () => {
    const calls = { audit: 0, notification: 0 };
    const repo = repository({
      getClub: async () => ({
        id: clubA,
        name: 'Chess',
        slug: 'chess',
        description: null,
        category: null,
        contact_email: null,
        is_active: true,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      getActiveClubHeadAssignment: async () => ({ id: 'existing' }),
      insertAudit: async () => {
        calls.audit += 1;
        return 1n;
      },
      insertNotification: async () => {
        calls.notification += 1;
        return 'n';
      },
    });
    await expect(
      new ClubService(repo, new AuthorizationService(repo)).assignHead(admin, clubA, student),
    ).rejects.toMatchObject({ status: 409 });
    expect(calls).toEqual({ audit: 0, notification: 0 });
  });
});

describe('configuration', () => {
  it('fails fast if the service role key is present', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/db',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_JWKS_URL: 'https://example.supabase.co/jwks',
        API_CORS_ORIGINS: '*',
        SUPABASE_SERVICE_ROLE_KEY: 'forbidden',
      }),
    ).toThrow(/SERVICE_ROLE/);
  });
});
