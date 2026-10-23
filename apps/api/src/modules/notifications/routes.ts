import { Router } from 'express';
import type { M1Repository } from '../../shared/db/repository.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import { NotificationQueryService } from './service.js';
import { notificationsController } from './controller.js';

export function notificationsRoutes(repository: M1Repository, verifier: TokenVerifier) {
  const router = Router();
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  const controller = notificationsController(new NotificationQueryService(repository));
  router.get('/notifications', auth, controller.list);
  router.get('/notifications/unread-count', auth, controller.unreadCount);
  router.patch('/notifications/:id/read', auth, controller.markRead);
  router.post('/notifications/read-all', auth, controller.markAll);
  return router;
}
