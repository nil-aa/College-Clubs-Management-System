/* eslint-disable no-unused-vars */
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors/http.js';
import type { M1Repository } from '../../shared/db/repository.js';
import { AuditService } from '../../shared/audit/service.js';
import { NotificationService } from '../../shared/notifications/service.js';

export class RoleManagementService {
  constructor(private readonly repository: M1Repository) {}

  roles() {
    return this.repository.listRoles();
  }

  assignments() {
    return this.repository.listRoleAssignments();
  }

  async setRole(actorId: string, userId: string, role: 'student' | 'club_head' | 'admin') {
    if (!['student', 'club_head', 'admin'].includes(role)) throw badRequest('Role is invalid.');
    if (!(await this.repository.getUser(userId))) throw notFound('User not found.');
    try {
      return await this.repository.transaction(async (transactionRepository) => {
        const result = await transactionRepository.setUserRole(userId, role, actorId);
        await new AuditService(transactionRepository).log({
          actorId,
          action: 'user_role.changed',
          entityType: 'user_roles',
          entityId: result.id,
          details: { user_id: userId, new_role: role },
        });
        await new NotificationService(transactionRepository).sendInternal({
          userId,
          type: 'user_role.changed',
          title: 'Role updated',
          message: `Your role is now ${role}.`,
        });
        return result;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('last admin')) throw conflict(message);
      if (message.includes('Revoke club-head')) throw forbidden(message);
      throw error;
    }
  }
}
