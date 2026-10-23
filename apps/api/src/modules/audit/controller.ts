import type { Request, Response } from 'express';
import { badRequest } from '../../shared/errors/http.js';
import { auditQuerySchema } from './schemas.js';
import { AuditQueryService } from './service.js';

export function auditController(service: AuditQueryService) {
  return {
    list: async (request: Request, response: Response) => {
      const parsed = auditQuerySchema.safeParse(request.query);
      if (!parsed.success) throw badRequest('The audit query is invalid.', parsed.error.flatten());
      const result = await service.list({
        action: parsed.data.action,
        entityType: parsed.data.entity_type,
        actor: parsed.data.actor,
        from: parsed.data.from ? new Date(parsed.data.from) : undefined,
        to: parsed.data.to ? new Date(parsed.data.to) : undefined,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
      response.json({
        items: result.rows,
        total: result.total,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
    },
  };
}
