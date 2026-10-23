import type { Request, Response } from 'express';
import { badRequest, notFound } from '../../shared/errors/http.js';
import type { ApiRequest } from '../../shared/http/request.js';
import { profileUpdateSchema, userSearchSchema } from './schemas.js';
import { UserService } from './service.js';
import type { M1Repository, PermissionSnapshot } from '../../shared/db/repository.js';

export function usersController(repository: M1Repository, service: UserService) {
  return {
    me: async (request: Request, response: Response) => {
      const userId = (request as ApiRequest).auth!.userId;
      const profile = await service.getMe(userId);
      if (!profile) throw notFound('Your profile was not found.');
      response.json(profile);
    },
    updateMe: async (request: Request, response: Response) => {
      const parsed = profileUpdateSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('Profile details are invalid.', parsed.error.flatten());
      const userId = (request as ApiRequest).auth!.userId;
      response.json(await service.updateMe(userId, parsed.data));
    },
    permissions: async (request: Request, response: Response) => {
      const userId = (request as ApiRequest).auth!.userId;
      const snapshot: PermissionSnapshot = await repository.getPermissionSnapshot(userId);
      response.json(snapshot);
    },
    search: async (request: Request, response: Response) => {
      const parsed = userSearchSchema.safeParse(request.query);
      if (!parsed.success)
        throw badRequest('The user search query is invalid.', parsed.error.flatten());
      response.json(await repository.searchUsers(parsed.data.query));
    },
  };
}
