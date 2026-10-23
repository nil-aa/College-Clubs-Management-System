import type { Request } from 'express';
import type { Logger } from 'pino';

export type AuthUser = { userId: string; email?: string };

export type ApiRequest = Request & {
  auth?: AuthUser;
  requestId?: string;
  authzCache?: Map<string, unknown>;
  log?: Logger;
};
