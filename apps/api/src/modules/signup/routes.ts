import { Router } from 'express';
import { z } from 'zod';
import type { DomainRepository, M1Repository } from '../../shared/db/repository.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import { AuthorizationService, requirePermission } from '../../shared/authz/service.js';
import { badRequest, conflict } from '../../shared/errors/http.js';

const domainSchema = z.object({ domain: z.string().trim().toLowerCase().min(3).max(253) }).strict();
const emailSchema = z.object({ email: z.string().email() }).strict();

export function signupRoutes(
  repository: M1Repository & DomainRepository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  router.post('/signup/email-eligibility', async (request, response, next) => {
    try {
      const parsed = emailSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('A valid email is required.');
      response.json({ eligible: await repository.signupEmailEligible(parsed.data.email) });
    } catch (error) {
      next(error);
    }
  });
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  const admin = requirePermission(authz, 'users.manage');
  router.get('/admin/signup-domains', auth, admin, async (_request, response, next) => {
    try {
      response.json(await repository.listSignupDomains());
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/signup-domains', auth, admin, async (request, response, next) => {
    try {
      const parsed = domainSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('The domain is invalid.');
      await repository.addSignupDomain(parsed.data.domain);
      response.status(201).json({ domain: parsed.data.domain });
    } catch (error) {
      next((error as any)?.code === 'P2002' ? conflict('That domain is already allowed.') : error);
    }
  });
  router.delete('/admin/signup-domains/:domain', auth, admin, async (request, response, next) => {
    try {
      await repository.removeSignupDomain(String(request.params.domain));
      response.json({ removed: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
