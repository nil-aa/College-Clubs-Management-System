import { Router } from 'express';
import type { M1Repository } from '../../shared/db/repository.js';
import { AuthorizationService, requireRole } from '../../shared/authz/service.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import { ClubService } from './service.js';
import { clubsController } from './controller.js';

export function clubsRoutes(
  repository: M1Repository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  const admin = requireRole(authz, 'admin');
  const service = new ClubService(repository, authz);
  const controller = clubsController(service, repository);
  router.get('/clubs', auth, controller.list);
  router.get('/clubs/:id', auth, controller.detail);
  router.get('/me/clubs', auth, controller.mine);
  router.get('/admin/clubs', auth, admin, controller.adminList);
  router.post('/admin/clubs', auth, admin, controller.create);
  router.patch('/admin/clubs/:id', auth, admin, controller.update);
  router.post('/admin/clubs/:id/activate', auth, admin, controller.active);
  router.post('/admin/clubs/:id/deactivate', auth, admin, controller.inactive);
  router.get('/admin/clubs/:id/heads', auth, admin, controller.heads);
  router.post('/admin/clubs/:id/heads', auth, admin, controller.assignHead);
  router.delete('/admin/clubs/:id/heads/:userId', auth, admin, controller.revokeHead);
  return router;
}
