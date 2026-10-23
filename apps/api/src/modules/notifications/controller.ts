import type { Request, Response } from 'express';
import { badRequest } from '../../shared/errors/http.js';
import type { ApiRequest } from '../../shared/http/request.js';
import { notificationIdSchema, notificationQuerySchema } from './schemas.js';
import { NotificationQueryService } from './service.js';

export function notificationsController(service: NotificationQueryService) {
  const userId = (request: Request) => (request as ApiRequest).auth!.userId;
  return {
    list: async (request: Request, response: Response) => {
      const parsed = notificationQuerySchema.safeParse(request.query);
      if (!parsed.success)
        throw badRequest('The notification query is invalid.', parsed.error.flatten());
      const [result, unreadCount] = await Promise.all([
        service.list(userId(request), {
          unread: parsed.data.unread === 'true',
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        }),
        service.unreadCount(userId(request)),
      ]);
      response.json({
        items: result.rows,
        total: result.total,
        unread_count: unreadCount,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
    },
    unreadCount: async (request: Request, response: Response) => {
      response.json({ count: await service.unreadCount(userId(request)) });
    },
    markRead: async (request: Request, response: Response) => {
      const parsed = notificationIdSchema.safeParse(request.params);
      if (!parsed.success)
        throw badRequest('The notification id is invalid.', parsed.error.flatten());
      response.json(await service.markRead(userId(request), parsed.data.id));
    },
    markAll: async (request: Request, response: Response) => {
      response.json(await service.markAll(userId(request)));
    },
  };
}
