import { Router } from 'express';
import type { M1Repository } from '../../shared/db/repository.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import { AuthorizationService, requirePermission } from '../../shared/authz/service.js';
import { AuditQueryService } from './service.js';
import { auditController } from './controller.js';

export function auditRoutes(
  repository: M1Repository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  router.get(
    '/admin/audit-logs',
    auth,
    requirePermission(authz, 'audit.read'),
    auditController(new AuditQueryService(repository)).list,
  );
  return router;
}
