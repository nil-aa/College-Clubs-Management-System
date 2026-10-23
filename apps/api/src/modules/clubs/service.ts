/* eslint-disable no-unused-vars */
import { conflict, forbidden, notFound } from '../../shared/errors/http.js';
import type { M1Repository } from '../../shared/db/repository.js';
import { AuthorizationService } from '../../shared/authz/service.js';
import { AuditService } from '../../shared/audit/service.js';
import { NotificationService } from '../../shared/notifications/service.js';
import type { ClubDto } from '../../shared/db/repository.js';

export class ClubService {
  private activeClubsCache: { expiresAt: number; value: ClubDto[] } | null = null;

  constructor(
    private readonly repository: M1Repository,
    private readonly authz: AuthorizationService,
  ) {}

  async list(input: { search?: string; category?: string }) {
    // The directory is identical for every authenticated user. Keep a very
    // short cache here to avoid repeated remote pooler round trips when React
    // remounts the page in development or when a user navigates back to it.
    // Authentication still runs for every request before this method.
    const cacheable = !input.search && !input.category;
    const now = Date.now();
    if (cacheable && this.activeClubsCache && this.activeClubsCache.expiresAt > now)
      return this.activeClubsCache.value;

    const value = await this.repository.listClubs({ activeOnly: true, ...input });
    if (cacheable) this.activeClubsCache = { value, expiresAt: now + 10_000 };
    return value;
  }
  adminList(input: { search?: string; category?: string }) {
    return this.repository.listClubs({ activeOnly: false, ...input });
  }

  async detail(userId: string, id: string) {
    const club = await this.repository.getClub(id);
    if (!club) throw notFound('Club not found.');
    if (!club.is_active && !(await this.authz.canManageClub(userId, id)))
      throw notFound('Club not found.');
    return { ...club, heads: await this.repository.getClubHeads(id) };
  }

  myClubs(userId: string) {
    return this.repository.getManagedClubs(userId);
  }

  async create(actorId: string, input: any) {
    try {
      const club = await this.repository.transaction(async (transactionRepository) => {
        const club = await transactionRepository.createClub({ ...input, created_by: actorId });
        await new AuditService(transactionRepository).log({
          actorId,
          action: 'club.created',
          entityType: 'clubs',
          entityId: club.id,
          details: { name: club.name, category: club.category },
        });
        return club;
      });
      this.activeClubsCache = null;
      return club;
    } catch (error) {
      throw mapDbError(error, 'A club with this name already exists.');
    }
  }

  async update(actorId: string, id: string, input: any) {
    if (!(await this.repository.getClub(id))) throw notFound('Club not found.');
    try {
      const club = await this.repository.transaction(async (transactionRepository) => {
        const club = await transactionRepository.updateClub(id, input);
        await new AuditService(transactionRepository).log({
          actorId,
          action: 'club.updated',
          entityType: 'clubs',
          entityId: id,
          details: { name: club.name, category: club.category },
        });
        return club;
      });
      this.activeClubsCache = null;
      return club;
    } catch (error) {
      throw mapDbError(error, 'A club with this name already exists.');
    }
  }

  async setActive(actorId: string, id: string, active: boolean) {
    if (!(await this.repository.getClub(id))) throw notFound('Club not found.');
    const club = await this.repository.transaction(async (transactionRepository) => {
      const club = await transactionRepository.setClubActive(id, active);
      await new AuditService(transactionRepository).log({
        actorId,
        action: active ? 'club.activated' : 'club.deactivated',
        entityType: 'clubs',
        entityId: id,
        details: { is_active: active },
      });
      return club;
    });
    this.activeClubsCache = null;
    return club;
  }

  async assignHead(actorId: string, clubId: string, userId: string) {
    const [club, user, snapshot] = await Promise.all([
      this.repository.getClub(clubId),
      this.repository.getUser(userId),
      this.repository.getPermissionSnapshot(userId),
    ]);
    if (!club) throw notFound('Club not found.');
    if (!user) throw notFound('User not found.');
    if (
      snapshot.roles.some(
        (role) => role.clubId === null && (role.code === 'admin' || role.code === 'global_admin'),
      )
    )
      throw forbidden('An admin cannot be assigned a club-head scope.');
    if (await this.repository.getActiveClubHeadAssignment(userId, clubId))
      throw conflict('This user is already a Club Head for this club.');
    return this.repository.transaction(async (transactionRepository) => {
      await transactionRepository.deactivateStudentRole(userId, actorId);
      await transactionRepository.ensureClubHeadRole(userId, actorId);
      const assignment = await transactionRepository.activateOrCreateClubHeadAssignment(
        userId,
        clubId,
        actorId,
      );
      const audit = new AuditService(transactionRepository);
      const notifications = new NotificationService(transactionRepository);
      await audit.log({
        actorId,
        action: 'club_head.assigned',
        entityType: 'user_roles',
        entityId: assignment.id,
        details: { user_id: userId, club_id: clubId },
      });
      await notifications.sendInternal({
        userId,
        type: 'club_head.assigned',
        title: 'Club head assignment',
        message: `You are now a club head for ${club.name}.`,
      });
      return assignment;
    });
  }

  async revokeHead(actorId: string, clubId: string, userId: string) {
    const club = await this.repository.getClub(clubId);
    if (!club) throw notFound('Club not found.');
    return this.repository.transaction(async (transactionRepository) => {
      const assignment = await transactionRepository.deactivateClubHeadAssignment(
        userId,
        clubId,
        actorId,
      );
      if (!assignment) throw notFound('This Club Head assignment was not found.');
      const audit = new AuditService(transactionRepository);
      const notifications = new NotificationService(transactionRepository);
      await audit.log({
        actorId,
        action: 'club_head.revoked',
        entityType: 'user_roles',
        entityId: assignment.id,
        details: { user_id: userId, club_id: clubId },
      });
      await notifications.sendInternal({
        userId,
        type: 'club_head.revoked',
        title: 'Club head assignment revoked',
        message: `Your Club Head assignment for ${club.name} has been revoked.`,
      });
      return { revoked: true };
    });
  }
}

function mapDbError(error: unknown, duplicateMessage: string) {
  if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')
    return conflict(duplicateMessage);
  return error;
}
