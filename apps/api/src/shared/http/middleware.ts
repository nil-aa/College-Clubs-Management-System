/* eslint-disable no-unused-vars */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import pino, { type Logger } from 'pino';
import type { ApiRequest } from './request.js';
import { HttpError } from '../errors/http.js';

export function createLogger(level: string) {
  return pino({ level });
}

export function requestContext(logger: Logger) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const req = request as ApiRequest;
    req.requestId = request.header('x-request-id') || randomUUID();
    req.authzCache = new Map();
    req.log = logger.child({ requestId: req.requestId });
    next();
  };
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  const req = request as ApiRequest;
  const logger = req.log;
  const httpError =
    error instanceof HttpError
      ? error
      : error instanceof SyntaxError
        ? new HttpError(400, 'INVALID_JSON', 'The request body must be valid JSON.')
        : null;
  if (!httpError) logger?.error({ err: error }, 'unhandled request error');
  response.status(httpError?.status ?? 500).json({
    error: {
      code: httpError?.code ?? 'INTERNAL_ERROR',
      message: httpError?.message ?? 'An unexpected error occurred.',
      ...(httpError?.details === undefined ? {} : { details: httpError.details }),
    },
  });
}
