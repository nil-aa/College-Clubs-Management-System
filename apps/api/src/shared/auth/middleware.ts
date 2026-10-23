/* eslint-disable no-unused-vars */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextFunction, Request, Response } from 'express';
import type { ApiConfig } from '../config/index.js';
import { unauthorized, forbidden } from '../errors/http.js';
import type { ApiRequest } from '../http/request.js';

export type TokenVerifier = (token: string) => Promise<{ userId: string; email?: string }>;

export function createTokenVerifier(config: ApiConfig): TokenVerifier {
  const issuer = config.SUPABASE_JWT_ISSUER ?? `${config.SUPABASE_URL}/auth/v1`;
  const key =
    config.jwtMode === 'jwks'
      ? createRemoteJWKSet(new URL(config.SUPABASE_JWKS_URL!))
      : new TextEncoder().encode(config.SUPABASE_JWT_SECRET!);
  return async (token) => {
    const { payload } = await jwtVerify(token, key, {
      issuer,
      audience: config.SUPABASE_JWT_AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Token has no subject.');
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  };
}

export function authenticate(
  verifier: TokenVerifier,
  isActive: (userId: string) => Promise<boolean>,
) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const header = request.header('authorization');
      if (!header?.startsWith('Bearer ')) throw unauthorized();
      const user = await verifier(header.slice('Bearer '.length).trim());
      if (!(await isActive(user.userId))) throw forbidden('This profile is inactive.');
      const req = request as ApiRequest;
      req.auth = user;
      next();
    } catch (error) {
      next(
        error instanceof Error && 'status' in error
          ? error
          : unauthorized('The access token is invalid or expired.'),
      );
    }
  };
}
