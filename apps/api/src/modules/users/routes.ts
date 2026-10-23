import { Router } from 'express';
import type { M1Repository } from '../../shared/db/repository.js';
import { AuthorizationService, requirePermission } from '../../shared/authz/service.js';
import type { TokenVerifier } from '../../shared/auth/middleware.js';
import { authenticate } from '../../shared/auth/middleware.js';
import { UserService } from './service.js';
import { usersController } from './controller.js';

export function usersRoutes(
  repository: M1Repository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  const controller = usersController(repository, new UserService(repository));
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  router.get('/users/me', auth, controller.me);
  router.patch('/users/me', auth, controller.updateMe);
  router.get('/me/permissions', auth, controller.permissions);
  router.get('/admin/users', auth, requirePermission(authz, 'users.read'), controller.search);
  return router;
}
