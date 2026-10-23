import type { Request, Response } from 'express';
import type { ApiRequest } from '../../shared/http/request.js';
import { badRequest } from '../../shared/errors/http.js';
import { clubIdSchema, clubQuerySchema, clubWriteSchema, headSchema } from './schemas.js';
import { ClubService } from './service.js';
import type { M1Repository } from '../../shared/db/repository.js';

export function clubsController(service: ClubService, repository: M1Repository) {
  const actor = (request: Request) => (request as ApiRequest).auth!.userId;
  const id = (request: Request) => {
    const parsed = clubIdSchema.safeParse(request.params);
    if (!parsed.success) throw badRequest('The club id is invalid.', parsed.error.flatten());
    return parsed.data.id;
  };
  return {
    list: async (request: Request, response: Response) => {
      const parsed = clubQuerySchema.safeParse(request.query);
      if (!parsed.success) throw badRequest('The club query is invalid.', parsed.error.flatten());
      response.json(await service.list(parsed.data));
    },
    adminList: async (request: Request, response: Response) => {
      const parsed = clubQuerySchema.safeParse(request.query);
      if (!parsed.success) throw badRequest('The club query is invalid.', parsed.error.flatten());
      response.json(await service.adminList(parsed.data));
    },
    detail: async (request: Request, response: Response) => {
      response.json(await service.detail(actor(request), id(request)));
    },
    mine: async (request: Request, response: Response) => {
      response.json(await service.myClubs(actor(request)));
    },
    create: async (request: Request, response: Response) => {
      const parsed = clubWriteSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('Club details are invalid.', parsed.error.flatten());
      response.status(201).json(await service.create(actor(request), parsed.data));
    },
    update: async (request: Request, response: Response) => {
      const parsed = clubWriteSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('Club details are invalid.', parsed.error.flatten());
      response.json(await service.update(actor(request), id(request), parsed.data));
    },
    active: async (request: Request, response: Response) => {
      response.json(await service.setActive(actor(request), id(request), true));
    },
    inactive: async (request: Request, response: Response) => {
      response.json(await service.setActive(actor(request), id(request), false));
    },
    heads: async (request: Request, response: Response) => {
      response.json(await repository.getClubHeads(id(request)));
    },
    assignHead: async (request: Request, response: Response) => {
      const parsed = headSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('A valid user id is required.', parsed.error.flatten());
      response
        .status(201)
        .json(await service.assignHead(actor(request), id(request), parsed.data.userId));
    },
    revokeHead: async (request: Request, response: Response) => {
      const parsed = headSchema.safeParse({ userId: request.params.userId });
      if (!parsed.success) throw badRequest('The user id is invalid.', parsed.error.flatten());
      response.json(await service.revokeHead(actor(request), id(request), parsed.data.userId));
    },
  };
}
