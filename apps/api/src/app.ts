import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { ApiConfig } from './shared/config/index.js';
import { createLogger, errorHandler, requestContext } from './shared/http/middleware.js';
import { HttpError } from './shared/errors/http.js';
import { prisma } from './shared/db/client.js';
import { PrismaM1Repository, type M1Repository } from './shared/db/repository.js';
import { AuthorizationService } from './shared/authz/service.js';
import { createTokenVerifier, type TokenVerifier } from './shared/auth/middleware.js';
import { usersRoutes } from './modules/users/routes.js';
import { clubsRoutes } from './modules/clubs/routes.js';
import { notificationsRoutes } from './modules/notifications/routes.js';
import { auditRoutes } from './modules/audit/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { rolesRoutes } from './modules/roles/routes.js';
import { eventsRoutes } from './modules/events/routes.js';
import type { EventRepository } from './shared/db/repository.js';
import { signupRoutes } from './modules/signup/routes.js';
import type { DomainRepository } from './shared/db/repository.js';

export type AppDependencies = {
  config: ApiConfig;
  repository?: M1Repository;
  verifier?: TokenVerifier;
};

export function createApp(dependencies: AppDependencies): Express {
  const repository = dependencies.repository ?? new PrismaM1Repository(prisma);
  const verifier = dependencies.verifier ?? createTokenVerifier(dependencies.config);
  const authz = new AuthorizationService(repository);
  const logger = createLogger(dependencies.config.LOG_LEVEL);
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || dependencies.config.corsOrigins.includes(origin))
          return callback(null, true);
        callback(new HttpError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed.'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: dependencies.config.API_RATE_LIMIT,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_request, _response, next) =>
        next(new HttpError(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.')),
    }),
  );
  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  app.use('/api', usersRoutes(repository, authz, verifier));
  app.use('/api', clubsRoutes(repository, authz, verifier));
  app.use('/api', notificationsRoutes(repository, verifier));
  app.use('/api', auditRoutes(repository, authz, verifier));
  app.use('/api', dashboardRoutes(repository, authz, verifier));
  app.use('/api', rolesRoutes(repository, authz, verifier));
  app.use('/api', eventsRoutes(repository as typeof repository & EventRepository, authz, verifier));
  app.use(
    '/api',
    signupRoutes(repository as typeof repository & DomainRepository, authz, verifier),
  );
  app.use((_request, _response, next) =>
    next(new HttpError(404, 'NOT_FOUND', 'The requested route was not found.')),
  );
  app.use(errorHandler);
  return app;
}
