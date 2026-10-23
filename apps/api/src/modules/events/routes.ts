import { Router } from 'express';
import type { M1Repository, EventRepository } from '../../shared/db/repository.js';
import { authenticate, type TokenVerifier } from '../../shared/auth/middleware.js';
import { AuthorizationService } from '../../shared/authz/service.js';
import { badRequest, forbidden } from '../../shared/errors/http.js';
import type { ApiRequest } from '../../shared/http/request.js';
import {
  eventIdSchema,
  eventQuerySchema,
  managedEventQuerySchema,
  eventWriteSchema,
  eventUpdateSchema,
  postponeSchema,
  attendanceSchema,
  odSheetSchema,
  registrationQuerySchema,
  sheetIdSchema,
} from './schemas.js';
import { EventService, mapEventError } from './service.js';

export function eventsRoutes(
  repository: M1Repository & EventRepository,
  authz: AuthorizationService,
  verifier: TokenVerifier,
) {
  const router = Router();
  const auth = authenticate(verifier, (id) => repository.isProfileActive(id));
  const manager = async (request: ApiRequest, _response: any, next: any) => {
    try {
      if (!(await authz.hasAnyPermission(request.auth!.userId, 'events.manage', request)))
        throw forbidden();
      next();
    } catch (error) {
      next(error);
    }
  };
  const service = new EventService(repository, authz);
  const user = (r: any) => (r as ApiRequest).auth!.userId;
  const id = (r: any) => {
    const parsed = eventIdSchema.safeParse(r.params);
    if (!parsed.success) throw badRequest('The event id is invalid.');
    return parsed.data.eventId;
  };
  const wrap = (fn: any) => async (req: any, res: any, next: any) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(mapEventError(e));
    }
  };
  router.get(
    '/events',
    auth,
    wrap(async (req: any, res: any) => {
      const q = eventQuerySchema.parse(req.query);
      res.json(
        await service.list({
          search: q.search,
          clubId: q.club_id,
          category: q.category,
          startFrom: q.start_from ? new Date(q.start_from) : undefined,
          startTo: q.start_to ? new Date(q.start_to) : undefined,
          limit: q.limit,
          offset: q.offset,
        }),
      );
    }),
  );
  router.get(
    '/events/:eventId',
    auth,
    wrap(async (req: any, res: any) => res.json(await service.detail(user(req), id(req)))),
  );
  router.post(
    '/events/:eventId/registrations',
    auth,
    wrap(async (req: any, res: any) =>
      res.status(201).json(await service.register(user(req), id(req))),
    ),
  );
  router.delete(
    '/events/:eventId/registrations',
    auth,
    wrap(async (req: any, res: any) =>
      res.json(await service.cancelRegistration(user(req), id(req))),
    ),
  );
  router.get(
    '/me/registrations',
    auth,
    wrap(async (req: any, res: any) => {
      const q = registrationQuerySchema.parse(req.query);
      res.json(
        await service.registrations(user(req), {
          upcomingOnly: q.upcoming === 'true',
          limit: q.limit,
          offset: q.offset,
        }),
      );
    }),
  );
  router.get(
    '/me/participation',
    auth,
    wrap(async (req: any, res: any) => res.json(await service.participation(user(req)))),
  );
  router.get(
    '/admin/events',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const q = managedEventQuerySchema.parse(req.query);
      res.json(
        await service.managedList(user(req), {
          clubId: q.club_id,
          limit: q.limit,
          offset: q.offset,
        }),
      );
    }),
  );
  router.get(
    '/admin/events/:eventId',
    auth,
    manager,
    wrap(async (req: any, res: any) => res.json(await service.managedDetail(user(req), id(req)))),
  );
  router.post(
    '/admin/events',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const b = eventWriteSchema.parse(req.body);
      res.status(201).json(await service.create(user(req), b));
    }),
  );
  router.patch(
    '/admin/events/:eventId',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const b = eventUpdateSchema.parse(req.body);
      res.json(await service.update(user(req), id(req), b));
    }),
  );
  router.post(
    '/admin/events/:eventId/publish',
    auth,
    manager,
    wrap(async (req: any, res: any) =>
      res.json(await service.transition(user(req), id(req), 'publish')),
    ),
  );
  router.post(
    '/admin/events/:eventId/postpone',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const b = postponeSchema.parse(req.body);
      res.json(await service.transition(user(req), id(req), 'postpone', b));
    }),
  );
  router.post(
    '/admin/events/:eventId/cancel',
    auth,
    manager,
    wrap(async (req: any, res: any) =>
      res.json(await service.transition(user(req), id(req), 'cancel')),
    ),
  );
  router.get(
    '/admin/events/:eventId/participants',
    auth,
    manager,
    wrap(async (req: any, res: any) => res.json(await service.participants(user(req), id(req)))),
  );
  router.get(
    '/admin/events/:eventId/attendance',
    auth,
    manager,
    wrap(async (req: any, res: any) => res.json(await service.attendance(user(req), id(req)))),
  );
  router.post(
    '/admin/events/:eventId/attendance',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const b = attendanceSchema.parse(req.body);
      res.json(await service.markAttendance(user(req), { ...b, event_id: id(req) }));
    }),
  );
  router.post(
    '/admin/events/:eventId/attendance/finalize',
    auth,
    manager,
    wrap(async (req: any, res: any) =>
      res.json(await service.finalizeAttendance(user(req), id(req))),
    ),
  );
  router.get(
    '/admin/attendance',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const q = managedEventQuerySchema.parse(req.query);
      res.json(
        await service.attendanceDashboard(user(req), {
          clubId: q.club_id,
          limit: q.limit,
          offset: q.offset,
        }),
      );
    }),
  );
  router.post(
    '/admin/events/:eventId/od-sheets',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const b = odSheetSchema.parse(req.body);
      res.status(201).json(await service.odSheet(user(req), id(req), b));
    }),
  );
  router.get(
    '/admin/od-sheets',
    auth,
    manager,
    wrap(async (req: any, res: any) => res.json(await service.odSheets(user(req)))),
  );
  router.get(
    '/admin/od-sheets/:sheetId',
    auth,
    manager,
    wrap(async (req: any, res: any) => {
      const parsed = sheetIdSchema.parse(req.params);
      res.json(await service.odSheetDetail(user(req), parsed.sheetId));
    }),
  );
  return router;
}
