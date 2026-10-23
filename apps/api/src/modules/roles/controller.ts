import type { Request, Response } from 'express';
import { badRequest } from '../../shared/errors/http.js';
import type { ApiRequest } from '../../shared/http/request.js';
import { roleChangeSchema } from './schemas.js';
import { RoleManagementService } from './service.js';

export function rolesController(service: RoleManagementService) {
  const actor = (request: Request) => (request as ApiRequest).auth!.userId;
  return {
    roles: async (_request: Request, response: Response) => response.json(await service.roles()),
    assignments: async (_request: Request, response: Response) =>
      response.json(await service.assignments()),
    setRole: async (request: Request, response: Response) => {
      const parsed = roleChangeSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('The role change is invalid.', parsed.error.flatten());
      const userId = String(request.params.userId);
      if (!userId) throw badRequest('A user id is required.');
      response.json(await service.setRole(actor(request), userId, parsed.data.role));
    },
  };
}
