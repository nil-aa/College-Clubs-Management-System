import { Router } from 'express';
import type { M1Repository } from '../../shared/db/repository.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import { AuthorizationService, requirePermission } from '../../shared/authz/service.js';
import { RoleManagementService } from './service.js';
import { rolesController } from './controller.js';

export function rolesRoutes(
  repository: M1Repository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  const admin = requirePermission(authz, 'users.manage');
  const controller = rolesController(new RoleManagementService(repository));
  router.get('/admin/roles', auth, admin, controller.roles);
  router.get('/admin/role-assignments', auth, admin, controller.assignments);
  router.post('/admin/users/:userId/role', auth, admin, controller.setRole);
  return router;
}
