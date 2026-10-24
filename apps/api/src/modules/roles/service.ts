/* eslint-disable no-unused-vars */
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors/http.js';
import type { FacultyAssignmentRepository, M1Repository } from '../../shared/db/repository.js';
import { AuditService } from '../../shared/audit/service.js';
import { NotificationService } from '../../shared/notifications/service.js';

export class RoleManagementService {
  constructor(private readonly repository: M1Repository & FacultyAssignmentRepository) {}

  roles() {
    return this.repository.listRoles();
  }

  assignments() {
    return this.repository.listRoleAssignments();
  }

  async setRole(
    actorId: string,
    userId: string,
    role: 'student' | 'faculty' | 'club_head' | 'admin',
  ) {
    if (!['student', 'faculty', 'club_head', 'admin'].includes(role))
      throw badRequest('Role is invalid.');
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

  async assignFacultyCoordinator(actorId: string, userId: string, clubId: string) {
    if (!(await this.repository.getUser(userId))) throw notFound('User not found.');
    try {
      return await this.repository.transaction(async (transactionRepository) => {
        const result = await (
          transactionRepository as M1Repository & FacultyAssignmentRepository
        ).assignFacultyCoordinator(userId, clubId, actorId);
        await new AuditService(transactionRepository).log({
          actorId,
          action: 'faculty_coordinator.assigned',
          entityType: 'user_roles',
          entityId: result.id,
          details: { user_id: userId, club_id: clubId },
        });
        return result;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('already a Faculty Coordinator')) throw conflict(message);
      if (message.includes('not found') || message.includes('not configured'))
        throw notFound(message);
      throw error;
    }
  }

  async revokeFacultyCoordinator(actorId: string, userId: string, clubId: string) {
    return this.repository.transaction(async (transactionRepository) => {
      const result = await (
        transactionRepository as M1Repository & FacultyAssignmentRepository
      ).revokeFacultyCoordinator(userId, clubId, actorId);
      if (!result) throw notFound('Faculty Coordinator assignment not found.');
      await new AuditService(transactionRepository).log({
        actorId,
        action: 'faculty_coordinator.revoked',
        entityType: 'user_roles',
        entityId: result.id,
        details: { user_id: userId, club_id: clubId },
      });
      return { revoked: true };
    });
  }
}
