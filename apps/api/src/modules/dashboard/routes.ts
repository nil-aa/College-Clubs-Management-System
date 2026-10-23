import { Router } from 'express';
import type { M1Repository } from '../../shared/db/repository.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import type { ApiRequest } from '../../shared/http/request.js';
import { AuthorizationService } from '../../shared/authz/service.js';
import { forbidden } from '../../shared/errors/http.js';

export function dashboardRoutes(
  repository: M1Repository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  router.get('/dashboard', auth, async (request, response, next) => {
    try {
      const userId = (request as ApiRequest).auth!.userId;
      const snapshot = await repository.getPermissionSnapshot(userId);
      if (await authz.isAdmin(userId, request as ApiRequest)) {
        response.json({ role: 'admin', data: await repository.getAdminDashboardStats() });
        return;
      }
      if (snapshot.roles.some((role) => role.code === 'club_head' && role.clubId !== null)) {
        response.json({
          role: 'club_head',
          data: { clubs: await repository.getManagedClubs(userId) },
        });
        return;
      }
      response.json({ role: 'student', data: {} });
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/dashboard-stats', auth, async (request, response, next) => {
    try {
      const userId = (request as ApiRequest).auth!.userId;
      if (!(await authz.isAdmin(userId, request as ApiRequest))) throw forbidden();
      response.json(await repository.getAdminDashboardStats());
    } catch (error) {
      next(error);
    }
  });
  return router;
}
