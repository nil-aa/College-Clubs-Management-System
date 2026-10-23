/* eslint-disable no-unused-vars */
import type { M1Repository } from '../../shared/db/repository.js';

export class AuditQueryService {
  constructor(private readonly repository: M1Repository) {}
  list(input: {
    action?: string;
    entityType?: string;
    actor?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }) {
    return this.repository.listAuditLogs({ ...input, limit: Math.min(input.limit, 100) });
  }
}
