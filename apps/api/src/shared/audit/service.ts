/* eslint-disable no-unused-vars */
import type { M1Repository } from '../db/repository.js';

export type AuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
};

export class AuditService {
  constructor(private readonly repository: M1Repository) {}
  log(input: AuditInput) {
    return this.repository.insertAudit({ ...input, details: input.details ?? {} });
  }
}
