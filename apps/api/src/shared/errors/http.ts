/* eslint-disable no-unused-vars */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string, details?: unknown) {
  return new HttpError(400, 'VALIDATION_ERROR', message, details);
}

export function unauthorized(message = 'Authentication is required.') {
  return new HttpError(401, 'UNAUTHENTICATED', message);
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'The requested resource was not found.') {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function conflict(message: string, details?: unknown) {
  return new HttpError(409, 'CONFLICT', message, details);
}
