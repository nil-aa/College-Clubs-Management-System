/* eslint-disable no-unused-vars */
import type { M1Repository, PermissionSnapshot } from '../db/repository.js';
import type { ApiRequest } from '../http/request.js';
import { forbidden, badRequest } from '../errors/http.js';

export class AuthorizationService {
  constructor(private readonly repository: M1Repository) {}

  private async snapshot(userId: string, request?: ApiRequest): Promise<PermissionSnapshot> {
    const key = `snapshot:${userId}`;
    if (request?.authzCache?.has(key)) return request.authzCache.get(key) as PermissionSnapshot;
    const result = await this.repository.getPermissionSnapshot(userId);
    // The request-local cache is intentionally an object cache encoded in the map.
    request?.authzCache?.set(key, result);
    return result;
  }

  async isAdmin(userId: string, request?: ApiRequest) {
    const snapshot = await this.snapshot(userId, request);
    return snapshot.roles.some(
      (role) => role.clubId === null && (role.code === 'admin' || role.code === 'global_admin'),
    );
  }

  async hasRole(userId: string, role: string, clubId?: string | null, request?: ApiRequest) {
    const normalized = role.toLowerCase();
    const snapshot = await this.snapshot(userId, request);
    return snapshot.roles.some((candidate) => {
      if (normalized === 'admin')
        return (
          candidate.clubId === null &&
          (candidate.code === 'admin' || candidate.code === 'global_admin')
        );
      if (normalized === 'club_head')
        return candidate.code === 'club_head' && Boolean(clubId) && candidate.clubId === clubId;
      return candidate.code === normalized && candidate.clubId === null;
    });
  }

  async hasPermission(
    userId: string,
    permission: string,
    clubId?: string | null,
    request?: ApiRequest,
  ) {
    const snapshot = await this.snapshot(userId, request);
    if (
      snapshot.roles.some(
        (role) => role.clubId === null && (role.code === 'admin' || role.code === 'global_admin'),
      )
    )
      return true;
    return snapshot.permissions.some(
      (candidate) =>
        candidate.code === permission.toLowerCase() &&
        (candidate.clubId === null || candidate.clubId === clubId),
    );
  }

  async hasAnyPermission(userId: string, permission: string, request?: ApiRequest) {
    const snapshot = await this.snapshot(userId, request);
    if (
      snapshot.roles.some(
        (role) => role.clubId === null && (role.code === 'admin' || role.code === 'global_admin'),
      )
    )
      return true;
    return snapshot.permissions.some((candidate) => candidate.code === permission.toLowerCase());
  }

  async canManageClub(userId: string, clubId: string, request?: ApiRequest) {
    return (
      (await this.isAdmin(userId, request)) ||
      (await this.hasRole(userId, 'club_head', clubId, request))
    );
  }
}

export function requireRole(authz: AuthorizationService, role: string, clubIdFrom?: string) {
  return async (request: ApiRequest, _response: any, next: any) => {
    try {
      if (!request.auth) throw forbidden();
      const clubId = clubIdFrom ? readValue(request, clubIdFrom) : undefined;
      if (clubIdFrom && !clubId) throw badRequest('A club id is required.');
      if (!(await authz.hasRole(request.auth.userId, role, clubId, request))) throw forbidden();
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(
  authz: AuthorizationService,
  permission: string,
  options: { clubIdFrom?: string } = {},
) {
  return async (request: ApiRequest, _response: any, next: any) => {
    try {
      if (!request.auth) throw forbidden();
      const clubId = options.clubIdFrom ? readValue(request, options.clubIdFrom) : undefined;
      if (options.clubIdFrom && !clubId) throw badRequest('A club id is required.');
      if (!(await authz.hasPermission(request.auth.userId, permission, clubId, request)))
        throw forbidden();
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireClubManager(authz: AuthorizationService, options: { clubIdFrom: string }) {
  return async (request: ApiRequest, _response: any, next: any) => {
    try {
      if (!request.auth) throw forbidden();
      const clubId = readValue(request, options.clubIdFrom);
      if (!clubId) throw badRequest('A club id is required.');
      if (!(await authz.canManageClub(request.auth.userId, clubId, request))) throw forbidden();
      next();
    } catch (error) {
      next(error);
    }
  };
}

function readValue(request: ApiRequest, source: string) {
  return (request.params[source] ??
    request.query[source] ??
    (request.body as Record<string, unknown> | undefined)?.[source]) as string | undefined;
}
