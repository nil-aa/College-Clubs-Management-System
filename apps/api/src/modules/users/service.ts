/* eslint-disable no-unused-vars */
import { badRequest, notFound } from '../../shared/errors/http.js';
import type { M1Repository } from '../../shared/db/repository.js';
import { AuditService } from '../../shared/audit/service.js';

export class UserService {
  constructor(private readonly repository: M1Repository) {}
  getMe(userId: string) {
    return this.repository.getProfile(userId);
  }
  async updateMe(userId: string, input: Record<string, unknown>) {
    if (!Object.keys(input).length) throw badRequest('At least one profile field is required.');
    return this.repository.transaction(async (transactionRepository) => {
      const existing = await transactionRepository.getProfile(userId);
      if (!existing) throw notFound('Your profile was not found.');
      const updated = await transactionRepository.updateProfile(userId, input as any);
      await new AuditService(transactionRepository).log({
        actorId: userId,
        action: 'profile.updated',
        entityType: 'profiles',
        entityId: userId,
        details: { changed_fields: Object.keys(input) },
      });
      return updated;
    });
  }
}
