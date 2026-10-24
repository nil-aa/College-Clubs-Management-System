/* eslint-disable no-unused-vars */
import type { PrismaClient } from '@prisma/client';
import type { DbClient } from './client.js';

export type ProfileDto = {
  id: string;
  full_name: string;
  email: string;
  roll_number: string | null;
  department: string | null;
  year_of_study: number | null;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  bio: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
export type ClubDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type HeadDto = { id: string; full_name: string };
export type UserSearchDto = { id: string; full_name: string; email: string; is_active: boolean };
export type PermissionSnapshot = {
  roles: Array<{ code: string; clubId: string | null }>;
  permissions: Array<{ code: string; clubId: string | null }>;
};
export type NotificationDto = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_event_id: string | null;
  is_read: boolean;
  created_at: string;
};
export type AuditLogDto = {
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  created_at: string;
  total_count: number;
};
export type AdminDashboardStatsDto = {
  active_club_count: number;
  inactive_club_count: number;
  clubs_without_head_count: number;
  users_by_role: Array<{ role: string; count: number }>;
  recent_audit_logs: Omit<AuditLogDto, 'total_count' | 'actor_email'>[];
};
export type RoleDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_global: boolean;
  is_system: boolean;
  created_at: string;
};
export type RoleAssignmentDto = {
  id: string;
  user_id: string;
  user_name: string;
  role_id: string;
  role_code: string;
  club_id: string | null;
  club_name: string | null;
  assigned_by: string | null;
  created_at: string;
  status: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
};

export type EventRepository = {
  listStudentEvents(input: {
    search?: string;
    clubId?: string;
    category?: string;
    startFrom?: Date;
    startTo?: Date;
    limit: number;
    offset: number;
  }): Promise<any[]>;
  getStudentEvent(eventId: string): Promise<any | null>;
  listManagedEvents(input: {
    userId: string;
    admin: boolean;
    clubId?: string;
    limit: number;
    offset: number;
  }): Promise<any[]>;
  getManagedEvent(eventId: string): Promise<any | null>;
  createEvent(input: {
    actorId: string;
    clubId: string;
    title: string;
    description?: string | null;
    venue: string;
    category?: string | null;
    startTime: Date;
    endTime: Date;
    registrationDeadline: Date;
    capacity: number;
  }): Promise<string>;
  updateEvent(input: {
    actorId: string;
    eventId: string;
    title: string;
    description?: string | null;
    venue: string;
    category?: string | null;
    startTime: Date;
    endTime: Date;
    registrationDeadline: Date;
    capacity: number;
    confirmRegisteredScheduleChange?: boolean;
  }): Promise<string>;
  transitionEvent(
    eventId: string,
    action: 'publish' | 'postpone' | 'cancel',
    actorId: string,
    schedule?: { startTime: Date; endTime: Date; registrationDeadline: Date },
    confirmRegisteredScheduleChange?: boolean,
  ): Promise<string>;
  registerForEvent(userId: string, eventId: string): Promise<any>;
  cancelEventRegistration(userId: string, eventId: string): Promise<any>;
  listRegisteredUserIds(eventId: string): Promise<string[]>;
  listMyEventRegistrations(
    userId: string,
    input: { upcomingOnly: boolean; limit: number; offset: number },
  ): Promise<any[]>;
  listEventParticipants(eventId: string): Promise<any[]>;
  getAttendance(eventId: string): Promise<{ session: any | null; rows: any[] }>;
  markAttendance(input: {
    actorId: string;
    eventId: string;
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
    notes?: string | null;
  }): Promise<any>;
  finalizeAttendance(actorId: string, eventId: string): Promise<any>;
  listMyParticipation(userId: string): Promise<any[]>;
  listAttendanceDashboard(input: {
    userId: string;
    admin: boolean;
    clubId?: string;
    limit: number;
    offset: number;
  }): Promise<any[]>;
  generateOdSheet(input: {
    actorId: string;
    eventId: string;
    title: string;
    studentFields: string[];
    eventFields: string[];
  }): Promise<any>;
  listFinalizedAttendanceSessions(userId: string, admin: boolean): Promise<any[]>;
  listOdSheets(userId: string, admin: boolean): Promise<any[]>;
  getOdSheet(id: string): Promise<{ sheet: any | null; students: any[] }>;
  listFacultyOdSheets(userId: string): Promise<any[]>;
  closeOdSheet(actorId: string, id: string): Promise<any>;
  approveOdSheet(actorId: string, id: string): Promise<any>;
};

export type FacultyAssignmentRepository = {
  assignFacultyCoordinator(
    userId: string,
    clubId: string,
    actorId: string,
  ): Promise<{ id: string }>;
  revokeFacultyCoordinator(
    userId: string,
    clubId: string,
    actorId: string,
  ): Promise<{ id: string } | null>;
};

export type ProjectRepository = M1Repository & EventRepository;
export type DomainRepository = {
  listSignupDomains(): Promise<string[]>;
  addSignupDomain(domain: string): Promise<void>;
  removeSignupDomain(domain: string): Promise<void>;
  signupEmailEligible(email: string): Promise<boolean>;
};

export interface M1Repository {
  transaction<T>(work: (repository: M1Repository) => Promise<T>): Promise<T>;
  isProfileActive(userId: string): Promise<boolean>;
  getProfile(userId: string): Promise<ProfileDto | null>;
  updateProfile(
    userId: string,
    input: Partial<
      Pick<ProfileDto, 'full_name' | 'department' | 'year_of_study' | 'phone' | 'roll_number'>
    >,
  ): Promise<ProfileDto>;
  getPermissionSnapshot(userId: string): Promise<PermissionSnapshot>;
  listClubs(input: {
    activeOnly: boolean;
    search?: string;
    category?: string;
    userId?: string;
  }): Promise<ClubDto[]>;
  getClub(id: string): Promise<ClubDto | null>;
  getClubHeads(clubId: string): Promise<HeadDto[]>;
  getManagedClubs(userId: string): Promise<ClubDto[]>;
  createClub(input: {
    name: string;
    description?: string | null;
    category?: string | null;
    contact_email?: string | null;
    created_by: string;
  }): Promise<ClubDto>;
  updateClub(
    id: string,
    input: {
      name: string;
      description?: string | null;
      category?: string | null;
      contact_email?: string | null;
    },
  ): Promise<ClubDto>;
  setClubActive(id: string, active: boolean): Promise<ClubDto>;
  getRole(code: string): Promise<{ id: string; code: string } | null>;
  getUser(userId: string): Promise<ProfileDto | null>;
  getActiveClubHeadAssignment(userId: string, clubId: string): Promise<{ id: string } | null>;
  deactivateStudentRole(userId: string, actorId: string): Promise<void>;
  ensureClubHeadRole(userId: string, actorId: string): Promise<void>;
  activateOrCreateClubHeadAssignment(
    userId: string,
    clubId: string,
    actorId: string,
  ): Promise<{ id: string }>;
  deactivateClubHeadAssignment(
    userId: string,
    clubId: string,
    actorId: string,
  ): Promise<{ id: string } | null>;
  searchUsers(query: string): Promise<UserSearchDto[]>;
  insertAudit(input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    details: unknown;
  }): Promise<bigint>;
  insertNotification(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedEventId?: string | null;
  }): Promise<string>;
  insertNotifications(input: {
    userIds: string[];
    type: string;
    title: string;
    message: string;
    relatedEventId?: string | null;
  }): Promise<number>;
  getActiveStudentIds(): Promise<string[]>;
  listNotifications(input: {
    userId: string;
    unreadOnly: boolean;
    limit: number;
    offset: number;
  }): Promise<{ rows: NotificationDto[]; total: number }>;
  countUnreadNotifications(userId: string): Promise<number>;
  markNotificationRead(userId: string, notificationId: string): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<number>;
  listAuditLogs(input: {
    action?: string;
    entityType?: string;
    actor?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }): Promise<{ rows: AuditLogDto[]; total: number }>;
  getAdminDashboardStats(): Promise<AdminDashboardStatsDto>;
  listRoles(): Promise<RoleDto[]>;
  listRoleAssignments(): Promise<RoleAssignmentDto[]>;
  setUserRole(userId: string, role: string, actorId: string): Promise<{ id: string }>;
}

type PrismaLike = PrismaClient | any;

function profileRow(row: any): ProfileDto {
  return {
    id: row.id,
    full_name: row.fullName,
    email: row.email,
    roll_number: row.rollNumber ?? null,
    department: row.department ?? null,
    year_of_study: row.yearOfStudy ?? null,
    phone: row.phone ?? null,
    is_active: row.isActive,
    avatar_url: row.avatarUrl ?? null,
    bio: row.bio ?? null,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function clubRow(row: any): ClubDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    category: row.category ?? null,
    contact_email: row.contactEmail ?? null,
    is_active: row.isActive,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export class PrismaM1Repository implements M1Repository {
  constructor(private readonly db: PrismaLike) {}

  transaction<T>(work: (repository: M1Repository) => Promise<T>) {
    return this.db.$transaction((tx: PrismaLike) => work(new PrismaM1Repository(tx)));
  }

  async isProfileActive(userId: string) {
    const row = await this.db.profile.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return row?.isActive === true;
  }

  async getProfile(userId: string) {
    const row = await this.db.profile.findUnique({ where: { id: userId } });
    return row ? profileRow(row) : null;
  }

  async updateProfile(userId: string, input: any) {
    const row = await this.db.profile.update({
      where: { id: userId },
      data: {
        ...(input.full_name === undefined ? {} : { fullName: input.full_name }),
        ...(input.department === undefined ? {} : { department: input.department }),
        ...(input.year_of_study === undefined ? {} : { yearOfStudy: input.year_of_study }),
        ...(input.phone === undefined ? {} : { phone: input.phone }),
        ...(input.roll_number === undefined ? {} : { rollNumber: input.roll_number }),
      },
    });
    return profileRow(row);
  }

  async getPermissionSnapshot(userId: string): Promise<PermissionSnapshot> {
    const rows = await this.db.userRole.findMany({
      where: { userId, status: 'active', isActive: true },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const roles = rows.map((row: any) => ({ code: row.role.code, clubId: row.clubId ?? null }));
    const permissions = rows.flatMap((row: any) => {
      // The SQL contract keeps a global club_head marker for role display, but
      // that marker must never grant the role's club-scoped permissions.
      if (row.role.code === 'club_head' && row.clubId === null) return [];
      return row.role.permissions.map((rp: any) => ({
        code: rp.permission.code,
        clubId: row.clubId ?? null,
      }));
    });
    return { roles, permissions };
  }

  async listClubs(input: {
    activeOnly: boolean;
    search?: string;
    category?: string;
    userId?: string;
  }) {
    const where: any = {};
    if (input.activeOnly) where.isActive = true;
    if (input.search)
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
      ];
    if (input.category) where.category = input.category;
    if (!input.activeOnly && input.userId)
      where.OR = [
        ...(where.OR ?? []),
        {
          userRoles: {
            some: {
              userId: input.userId,
              clubId: { not: null },
              status: 'active',
              isActive: true,
              role: { code: 'club_head' },
            },
          },
        },
      ];
    const rows = await this.db.club.findMany({
      where,
      orderBy: { name: 'asc' },
      // Keep directory responses limited to the fields rendered by the UI.
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        contactEmail: true,
        isActive: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(clubRow);
  }

  async getClub(id: string) {
    const row = await this.db.club.findUnique({ where: { id } });
    return row ? clubRow(row) : null;
  }
  async getClubHeads(clubId: string) {
    const rows = await this.db.userRole.findMany({
      where: {
        clubId,
        status: 'active',
        isActive: true,
        role: { code: 'club_head' },
        user: { isActive: true },
      },
      select: { user: { select: { id: true, fullName: true } } },
    });
    return rows.map((row: any) => ({ id: row.user.id, full_name: row.user.fullName }));
  }
  async getManagedClubs(userId: string) {
    return this.listClubs({ activeOnly: false, userId });
  }
  async createClub(input: any) {
    const row = await this.db.club.create({
      data: {
        name: input.name,
        slug: slugify(input.name),
        description: input.description ?? null,
        category: input.category ?? null,
        contactEmail: input.contact_email ?? null,
        createdBy: input.created_by,
        status: 'active',
        isActive: true,
      },
    });
    return clubRow(row);
  }
  async updateClub(id: string, input: any) {
    const row = await this.db.club.update({
      where: { id },
      data: {
        name: input.name,
        slug: slugify(input.name),
        description: input.description ?? null,
        category: input.category ?? null,
        contactEmail: input.contact_email ?? null,
      },
    });
    return clubRow(row);
  }
  async setClubActive(id: string, active: boolean) {
    const row = await this.db.club.update({
      where: { id },
      data: { isActive: active, status: active ? 'active' : 'archived' },
    });
    return clubRow(row);
  }
  async getRole(code: string) {
    const row = await this.db.role.findUnique({ where: { code } });
    return row ? { id: row.id, code: row.code } : null;
  }
  async getUser(userId: string) {
    return this.getProfile(userId);
  }
  async getActiveClubHeadAssignment(userId: string, clubId: string) {
    const row = await this.db.userRole.findFirst({
      where: { userId, clubId, status: 'active', isActive: true, role: { code: 'club_head' } },
      select: { id: true },
    });
    return row;
  }
  async deactivateStudentRole(userId: string, actorId: string) {
    await this.db.userRole.updateMany({
      where: { userId, clubId: null, status: 'active', role: { code: 'student' } },
      data: {
        status: 'inactive',
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: actorId,
      },
    });
  }
  async ensureClubHeadRole(userId: string, actorId: string) {
    const role = await this.getRole('club_head');
    if (!role) throw new Error('Role catalogue is missing club_head.');
    const existing = await this.db.userRole.findFirst({
      where: { userId, roleId: role.id, clubId: null },
    });
    if (existing)
      await this.db.userRole.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          isActive: true,
          assignedBy: actorId,
          deactivatedAt: null,
          deactivatedBy: null,
        },
      });
    else
      await this.db.userRole.create({
        data: {
          userId,
          roleId: role.id,
          clubId: null,
          assignedBy: actorId,
          status: 'active',
          isActive: true,
        },
      });
  }
  async activateOrCreateClubHeadAssignment(userId: string, clubId: string, actorId: string) {
    const role = await this.getRole('club_head');
    if (!role) throw new Error('Role catalogue is missing club_head.');
    const existing = await this.db.userRole.findFirst({
      where: { userId, roleId: role.id, clubId },
    });
    if (existing)
      return this.db.userRole
        .update({
          where: { id: existing.id },
          data: {
            status: 'active',
            isActive: true,
            assignedBy: actorId,
            deactivatedAt: null,
            deactivatedBy: null,
          },
        })
        .then((row: any) => ({ id: row.id }));
    return this.db.userRole
      .create({
        data: {
          userId,
          roleId: role.id,
          clubId,
          assignedBy: actorId,
          status: 'active',
          isActive: true,
        },
      })
      .then((row: any) => ({ id: row.id }));
  }
  async deactivateClubHeadAssignment(userId: string, clubId: string, actorId: string) {
    const row = await this.db.userRole.findFirst({
      where: { userId, clubId, status: 'active', isActive: true, role: { code: 'club_head' } },
      select: { id: true },
    });
    if (!row) return null;
    await this.db.userRole.update({
      where: { id: row.id },
      data: {
        status: 'inactive',
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: actorId,
      },
    });
    return row;
  }
  async searchUsers(query: string) {
    const rows = await this.db.profile.findMany({
      where: {
        isActive: true,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { rollNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { fullName: 'asc' },
      take: 50,
    });
    return rows.map((row: any) => ({
      id: row.id,
      full_name: row.fullName,
      email: row.email,
      is_active: row.isActive,
    }));
  }
  async insertAudit(input: any) {
    const row = await this.db.auditLog.create({
      data: {
        actor: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: input.details ?? {},
      },
    });
    return BigInt(row.id);
  }
  async insertNotification(input: any) {
    const row = await this.db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        relatedEventId: input.relatedEventId ?? null,
        isRead: false,
      },
    });
    return row.id;
  }
  async insertNotifications(input: any) {
    if (!input.userIds.length) return 0;
    const result = await this.db.notification.createMany({
      data: input.userIds.map((userId: string) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        relatedEventId: input.relatedEventId ?? null,
        isRead: false,
      })),
    });
    return result.count;
  }
  async getActiveStudentIds() {
    const rows = await this.db.userRole.findMany({
      where: {
        status: 'active',
        isActive: true,
        clubId: null,
        role: { code: 'student' },
        user: { isActive: true },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((row: any) => row.userId);
  }

  async listSignupDomains() {
    const rows = await this.db.$queryRawUnsafe(
      `select domain from public.allowed_signup_email_domains order by domain`,
    );
    return rows.map((row: any) => row.domain);
  }
  async addSignupDomain(domain: string) {
    await this.db.$executeRawUnsafe(
      `insert into public.allowed_signup_email_domains(domain) values($1)`,
      domain,
    );
  }
  async removeSignupDomain(domain: string) {
    await this.db.$executeRawUnsafe(
      `delete from public.allowed_signup_email_domains where domain=$1`,
      domain,
    );
  }
  async signupEmailEligible(email: string) {
    return Boolean(
      (
        await this.db.$queryRawUnsafe(
          `select public.check_signup_email_eligibility($1) as eligible`,
          email,
        )
      )[0]?.eligible,
    );
  }

  async listNotifications(input: {
    userId: string;
    unreadOnly: boolean;
    limit: number;
    offset: number;
  }) {
    const where: any = { userId: input.userId };
    if (input.unreadOnly) where.isRead = false;
    const [rows, total] = await Promise.all([
      this.db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: input.offset,
        take: input.limit,
      }),
      this.db.notification.count({ where }),
    ]);
    return {
      rows: rows.map(notificationRow),
      total,
    };
  }

  async countUnreadNotifications(userId: string) {
    return this.db.notification.count({ where: { userId, isRead: false } });
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const result = await this.db.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data: { isRead: true },
    });
    return result.count > 0;
  }

  async markAllNotificationsRead(userId: string) {
    const result = await this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  async listAuditLogs(input: {
    action?: string;
    entityType?: string;
    actor?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }) {
    const where: any = {};
    if (input.action) where.action = input.action;
    if (input.entityType) where.entityType = input.entityType;
    if (input.actor) where.actor = input.actor;
    if (input.from || input.to)
      where.createdAt = {
        ...(input.from ? { gte: input.from } : {}),
        ...(input.to ? { lte: input.to } : {}),
      };
    const [rows, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        include: { actorProfile: { select: { fullName: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: input.offset,
        take: input.limit,
      }),
      this.db.auditLog.count({ where }),
    ]);
    return {
      rows: rows.map((row: any) => ({
        actor_id: row.actor ?? null,
        actor_name: row.actorProfile?.fullName ?? null,
        actor_email: row.actorProfile?.email ?? null,
        action: row.action,
        entity_type: row.entityType,
        entity_id: row.entityId ?? null,
        details: row.details ?? {},
        created_at: row.createdAt.toISOString(),
        total_count: total,
      })),
      total,
    };
  }

  async getAdminDashboardStats() {
    const [active, inactive, withoutHead, roleRows, recent] = await Promise.all([
      this.db.club.count({ where: { isActive: true } }),
      this.db.club.count({ where: { isActive: false } }),
      this.db.club.count({
        where: {
          userRoles: {
            none: {
              status: 'active',
              isActive: true,
              clubId: { not: null },
              role: { code: 'club_head' },
            },
          },
        },
      }),
      this.db.userRole.groupBy({
        by: ['roleId'],
        where: { status: 'active', isActive: true, clubId: null },
        _count: { userId: true },
      }),
      this.db.auditLog.findMany({
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { actorProfile: { select: { fullName: true } } },
      }),
    ]);
    const roles = await this.db.role.findMany({ select: { id: true, code: true } });
    const codeById = new Map(roles.map((role: any) => [role.id, role.code]));
    return {
      active_club_count: active,
      inactive_club_count: inactive,
      clubs_without_head_count: withoutHead,
      users_by_role: roleRows.map((row: any) => ({
        role: codeById.get(row.roleId) ?? row.roleId,
        count: row._count.userId,
      })),
      recent_audit_logs: recent.map((row: any) => ({
        actor_id: row.actor ?? null,
        actor_name: row.actorProfile?.fullName ?? null,
        action: row.action,
        entity_type: row.entityType,
        entity_id: row.entityId ?? null,
        details: row.details ?? {},
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  async listRoles() {
    const rows = await this.db.role.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      is_global: row.isGlobal,
      is_system: row.isSystem,
      created_at: row.createdAt.toISOString(),
    }));
  }

  async listRoleAssignments() {
    const rows = await this.db.userRole.findMany({
      include: {
        role: true,
        user: { select: { fullName: true } },
        club: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row: any) => ({
      id: row.id,
      user_id: row.userId,
      user_name: row.user.fullName,
      role_id: row.roleId,
      role_code: row.role.code,
      club_id: row.clubId ?? null,
      club_name: row.club?.name ?? null,
      assigned_by: row.assignedBy ?? null,
      created_at: row.createdAt.toISOString(),
      status: row.status,
      deactivated_at: row.deactivatedAt?.toISOString() ?? null,
      deactivated_by: row.deactivatedBy ?? null,
    }));
  }

  async setUserRole(userId: string, role: string, actorId: string) {
    await this.db.$executeRaw`select pg_advisory_xact_lock(2147483646)`;
    const roleRow = await this.db.role.findUnique({ where: { code: role } });
    if (!roleRow) throw new Error('Role catalogue is missing.');
    const assignment = await this.db.userRole.findFirst({
      where: {
        userId,
        clubId: null,
        status: 'active',
        role: { code: { in: ['student', 'faculty', 'club_head', 'admin', 'global_admin'] } },
      },
      include: { role: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const oldRole = assignment?.role?.code ?? null;
    if ((oldRole === 'admin' || oldRole === 'global_admin') && role !== 'admin') {
      const count = await this.db.userRole.count({
        where: {
          clubId: null,
          status: 'active',
          role: { code: { in: ['admin', 'global_admin'] } },
        },
      });
      if (count <= 1) throw new Error('The last admin cannot be demoted.');
    }
    if (role !== 'club_head') {
      const scoped = await this.db.userRole.count({
        where: { userId, clubId: { not: null }, status: 'active', role: { code: 'club_head' } },
      });
      if (scoped > 0)
        throw new Error(
          'Revoke club-head assignments before changing this user to a non-Club-Head role.',
        );
    }
    await this.db.userRole.updateMany({
      where: { userId, clubId: null, status: 'active', roleId: { not: roleRow.id } },
      data: {
        status: 'inactive',
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: actorId,
      },
    });
    const existing = await this.db.userRole.findFirst({
      where: { userId, roleId: roleRow.id, clubId: null },
    });
    const saved = existing
      ? await this.db.userRole.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            isActive: true,
            assignedBy: actorId,
            deactivatedAt: null,
            deactivatedBy: null,
          },
        })
      : await this.db.userRole.create({
          data: {
            userId,
            roleId: roleRow.id,
            clubId: null,
            assignedBy: actorId,
            status: 'active',
            isActive: true,
          },
        });
    return { id: saved.id };
  }

  async assignFacultyCoordinator(userId: string, clubId: string, actorId: string) {
    const [role, user, club] = await Promise.all([
      this.db.role.findUnique({ where: { code: 'faculty_coordinator' } }),
      this.db.profile.findUnique({ where: { id: userId }, select: { id: true, isActive: true } }),
      this.db.club.findUnique({ where: { id: clubId }, select: { id: true, isActive: true } }),
    ]);
    if (!role) throw new Error('Faculty Coordinator role is not configured.');
    if (!user?.isActive) throw new Error('Active user not found.');
    if (!club?.isActive) throw new Error('Active club not found.');
    const existing = await this.db.userRole.findFirst({
      where: { userId, roleId: role.id, clubId },
      select: { id: true, status: true, isActive: true },
    });
    if (existing?.status === 'active' && existing.isActive)
      throw new Error('User is already a Faculty Coordinator for this club.');
    if (existing) {
      const restored = await this.db.userRole.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          isActive: true,
          assignedBy: actorId,
          deactivatedAt: null,
          deactivatedBy: null,
        },
      });
      return { id: restored.id };
    }
    const created = await this.db.userRole.create({
      data: {
        userId,
        roleId: role.id,
        clubId,
        assignedBy: actorId,
        status: 'active',
        isActive: true,
      },
    });
    return { id: created.id };
  }

  async revokeFacultyCoordinator(userId: string, clubId: string, actorId: string) {
    const role = await this.db.role.findUnique({ where: { code: 'faculty_coordinator' } });
    if (!role) throw new Error('Faculty Coordinator role is not configured.');
    const existing = await this.db.userRole.findFirst({
      where: { userId, roleId: role.id, clubId, status: 'active', isActive: true },
      select: { id: true },
    });
    if (!existing) return null;
    const revoked = await this.db.userRole.update({
      where: { id: existing.id },
      data: {
        status: 'inactive',
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: actorId,
      },
    });
    return { id: revoked.id };
  }

  async listStudentEvents(input: {
    search?: string;
    clubId?: string;
    category?: string;
    startFrom?: Date;
    startTo?: Date;
    limit: number;
    offset: number;
  }) {
    return this.db.$queryRawUnsafe(
      `select e.event_id, e.club_id, c.name as club_name, e.title, e.description, e.venue, e.category,
        e.start_time, e.end_time, e.registration_deadline, e.capacity, e.status, e.published_at,
        count(er.registration_id) filter (where er.status = 'REGISTERED')::int as registration_count,
        case when e.status <> 'PUBLISHED' or e.registration_deadline <= now() then 'CLOSED'
             when count(er.registration_id) filter (where er.status = 'REGISTERED') >= e.capacity then 'FULL'
             else 'AVAILABLE' end as registration_availability
       from public.events e join public.clubs c on c.id=e.club_id and c.is_active
       left join public.event_registrations er on er.event_id=e.event_id
       where e.published_at is not null and e.status in ('PUBLISHED','POSTPONED','CANCELLED','COMPLETED')
         and ($1::text is null or e.title ilike '%'||$1||'%' or coalesce(e.description,'') ilike '%'||$1||'%')
         and ($2::uuid is null or e.club_id=$2::uuid)
         and ($3::text is null or lower(e.category)=lower($3))
         and ($4::timestamptz is null or e.start_time >= $4::timestamptz)
         and ($5::timestamptz is null or e.start_time < $5::timestamptz)
       group by e.event_id,c.name order by e.start_time asc,e.event_id asc limit $6 offset $7`,
      input.search?.trim() || null,
      input.clubId || null,
      input.category?.trim() || null,
      input.startFrom ?? null,
      input.startTo ?? null,
      input.limit,
      input.offset,
    );
  }

  async getStudentEvent(eventId: string) {
    const rows = await this.db.$queryRawUnsafe(
      `select e.event_id,e.club_id,c.name as club_name,e.title,e.description,e.venue,e.category,e.start_time,e.end_time,
        e.registration_deadline,e.capacity,e.status,e.published_at,
        count(er.registration_id) filter (where er.status='REGISTERED')::int as registration_count,
        case when e.status <> 'PUBLISHED' or e.registration_deadline <= now() then 'CLOSED'
             when count(er.registration_id) filter (where er.status='REGISTERED') >= e.capacity then 'FULL' else 'AVAILABLE' end as registration_availability
       from public.events e join public.clubs c on c.id=e.club_id and c.is_active
       left join public.event_registrations er on er.event_id=e.event_id
       where e.event_id=$1::uuid and e.published_at is not null and e.status in ('PUBLISHED','POSTPONED','CANCELLED','COMPLETED')
       group by e.event_id,c.name`,
      eventId,
    );
    return rows[0] ?? null;
  }

  async listManagedEvents(input: {
    userId: string;
    admin: boolean;
    clubId?: string;
    limit: number;
    offset: number;
  }) {
    return this.db.$queryRawUnsafe(
      `select e.event_id,e.club_id,e.created_by,e.title,e.description,e.venue,e.category,e.start_time,e.end_time,
        e.registration_deadline,e.capacity,e.status,e.published_at,e.created_at,e.updated_at,
        count(er.registration_id) filter (where er.status='REGISTERED')::int as registration_count
       from public.events e join public.clubs c on c.id=e.club_id and c.is_active
       left join public.event_registrations er on er.event_id=e.event_id
       where ($1::boolean or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
          where ur.user_id=$2::uuid and ur.club_id=e.club_id and ur.status='active' and ur.is_active and r.code='club_head'))
         and ($3::uuid is null or e.club_id=$3::uuid)
       group by e.event_id order by e.start_time desc,e.event_id desc limit $4 offset $5`,
      input.admin,
      input.userId,
      input.clubId || null,
      input.limit,
      input.offset,
    );
  }

  async getManagedEvent(eventId: string) {
    const rows = await this.db.$queryRawUnsafe(
      `select e.event_id,e.club_id,e.created_by,e.title,e.description,e.venue,e.category,e.start_time,e.end_time,
        e.registration_deadline,e.capacity,e.status,e.published_at,e.created_at,e.updated_at,
        count(er.registration_id) filter (where er.status='REGISTERED')::int as registration_count
       from public.events e left join public.event_registrations er on er.event_id=e.event_id
       where e.event_id=$1::uuid group by e.event_id`,
      eventId,
    );
    return rows[0] ?? null;
  }

  async createEvent(input: {
    actorId: string;
    clubId: string;
    title: string;
    description?: string | null;
    venue: string;
    category?: string | null;
    startTime: Date;
    endTime: Date;
    registrationDeadline: Date;
    capacity: number;
  }) {
    const rows = await this.db.$queryRawUnsafe(
      `insert into public.events(club_id,created_by,title,description,venue,category,start_time,end_time,registration_deadline,capacity)
       values($1::uuid,$2::uuid,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10)
       returning event_id`,
      input.clubId,
      input.actorId,
      input.title,
      input.description ?? null,
      input.venue,
      input.category ?? null,
      input.startTime,
      input.endTime,
      input.registrationDeadline,
      input.capacity,
    );
    return rows[0].event_id as string;
  }

  async updateEvent(input: {
    actorId: string;
    eventId: string;
    title: string;
    description?: string | null;
    venue: string;
    category?: string | null;
    startTime: Date;
    endTime: Date;
    registrationDeadline: Date;
    capacity: number;
    confirmRegisteredScheduleChange?: boolean;
  }) {
    await this.db.$executeRawUnsafe(
      `select set_config('app.confirm_registered_schedule_change', $1, true)`,
      input.confirmRegisteredScheduleChange ? 'true' : 'false',
    );
    const rows = await this.db.$queryRawUnsafe(
      `update public.events set title=$2,description=$3,venue=$4,category=$5,start_time=$6::timestamptz,end_time=$7::timestamptz,registration_deadline=$8::timestamptz,capacity=$9
       where event_id=$1::uuid returning event_id`,
      input.eventId,
      input.title,
      input.description ?? null,
      input.venue,
      input.category ?? null,
      input.startTime,
      input.endTime,
      input.registrationDeadline,
      input.capacity,
    );
    if (!rows[0]) throw new Error('Event not found.');
    return rows[0].event_id as string;
  }

  async transitionEvent(
    eventId: string,
    action: 'publish' | 'postpone' | 'cancel',
    actorId: string,
    schedule?: { startTime: Date; endTime: Date; registrationDeadline: Date },
    confirmRegisteredScheduleChange = false,
  ) {
    const current = (
      await this.db.$queryRawUnsafe(
        `select * from public.events where event_id=$1::uuid for update`,
        eventId,
      )
    )[0];
    if (!current) throw new Error('Event not found.');
    if (action === 'publish' && !['DRAFT', 'POSTPONED'].includes(current.status))
      throw new Error('Only draft or postponed events can be published.');
    if (action === 'postpone' && current.status !== 'PUBLISHED')
      throw new Error('Only published events can be postponed.');
    if (action === 'cancel' && !['PUBLISHED', 'POSTPONED'].includes(current.status))
      throw new Error('Only published or postponed events can be cancelled.');
    if (action === 'publish' && new Date(current.end_time) <= new Date())
      throw new Error('This event has already ended. Edit the schedule before publishing it.');
    const replacement = schedule ?? {
      startTime: current.start_time,
      endTime: current.end_time,
      registrationDeadline: current.registration_deadline,
    };
    if (action === 'postpone') {
      if (new Date(replacement.endTime) <= new Date(replacement.startTime))
        throw new Error('Event end time must be later than start time.');
      if (new Date(replacement.registrationDeadline) > new Date(replacement.endTime))
        throw new Error('Registration deadline must be no later than the event end.');
      if (new Date(replacement.endTime) <= new Date())
        throw new Error('Event end time must be in the future.');
      await this.db.$executeRawUnsafe(
        `select set_config('app.confirm_registered_schedule_change', $1, true)`,
        confirmRegisteredScheduleChange ? 'true' : 'false',
      );
    }
    const sets =
      action === 'publish'
        ? `status='PUBLISHED',published_at=coalesce(published_at,now())`
        : action === 'cancel'
          ? `status='CANCELLED'`
          : `status='POSTPONED',start_time=$2::timestamptz,end_time=$3::timestamptz,registration_deadline=$4::timestamptz`;
    const args =
      action === 'postpone'
        ? [eventId, replacement.startTime, replacement.endTime, replacement.registrationDeadline]
        : [eventId];
    const rows = await this.db.$queryRawUnsafe(
      `update public.events set ${sets} where event_id=$1::uuid returning event_id`,
      ...args,
    );
    if (!rows[0]) throw new Error('Event not found.');
    return rows[0].event_id as string;
  }

  async registerForEvent(userId: string, eventId: string) {
    const events = await this.db.$queryRawUnsafe(
      `select e.* from public.events e join public.clubs c on c.id=e.club_id and c.is_active where e.event_id=$1::uuid for update`,
      eventId,
    );
    const event = events[0];
    if (!event) throw new Error('Event not found.');
    if (event.status !== 'PUBLISHED' || new Date(event.registration_deadline) <= new Date())
      throw new Error('The registration deadline has passed.');
    if (new Date(event.end_time) <= new Date()) throw new Error('This event has already ended.');
    const existing = (
      await this.db.$queryRawUnsafe(
        `select * from public.event_registrations where event_id=$1::uuid and student_id=$2::uuid for update`,
        eventId,
        userId,
      )
    )[0];
    if (existing?.status === 'REGISTERED')
      throw new Error('You are already registered for this event.');
    const count = Number(
      (
        await this.db.$queryRawUnsafe(
          `select count(*)::int as count from public.event_registrations where event_id=$1::uuid and status='REGISTERED'`,
          eventId,
        )
      )[0].count,
    );
    if (count >= event.capacity) throw new Error('Event is at capacity.');
    const row = existing
      ? (
          await this.db.$queryRawUnsafe(
            `update public.event_registrations set status='REGISTERED',registered_at=statement_timestamp() where registration_id=$1::uuid returning *`,
            existing.registration_id,
          )
        )[0]
      : (
          await this.db.$queryRawUnsafe(
            `insert into public.event_registrations(event_id,student_id,status) values($1::uuid,$2::uuid,'REGISTERED') returning *`,
            eventId,
            userId,
          )
        )[0];
    return {
      registration_id: row.registration_id,
      event_id: eventId,
      status: row.status,
      registered_at: row.registered_at,
      registration_count: count + 1,
      capacity: event.capacity,
      registration_availability: count + 1 >= event.capacity ? 'FULL' : 'AVAILABLE',
      event_title: event.title,
      reactivated: Boolean(existing),
    };
  }

  async cancelEventRegistration(userId: string, eventId: string) {
    const event = (
      await this.db.$queryRawUnsafe(
        `select * from public.events where event_id=$1::uuid for update`,
        eventId,
      )
    )[0];
    if (!event) throw new Error('Event not found.');
    const row = (
      await this.db.$queryRawUnsafe(
        `select * from public.event_registrations where event_id=$1::uuid and student_id=$2::uuid for update`,
        eventId,
        userId,
      )
    )[0];
    if (!row) throw new Error('Registration not found.');
    if (row.status === 'CANCELLED')
      return {
        registration_id: row.registration_id,
        event_id: eventId,
        status: row.status,
        registered_at: row.registered_at,
        registration_count: Number(
          (
            await this.db.$queryRawUnsafe(
              `select count(*)::int as count from public.event_registrations where event_id=$1::uuid and status='REGISTERED'`,
              eventId,
            )
          )[0].count,
        ),
        capacity: event.capacity,
        registration_availability: 'AVAILABLE',
        event_title: event.title,
        changed: false,
      };
    const saved = (
      await this.db.$queryRawUnsafe(
        `update public.event_registrations set status='CANCELLED' where registration_id=$1::uuid returning *`,
        row.registration_id,
      )
    )[0];
    const count = Number(
      (
        await this.db.$queryRawUnsafe(
          `select count(*)::int as count from public.event_registrations where event_id=$1::uuid and status='REGISTERED'`,
          eventId,
        )
      )[0].count,
    );
    return {
      registration_id: saved.registration_id,
      event_id: eventId,
      status: saved.status,
      registered_at: saved.registered_at,
      registration_count: count,
      capacity: event.capacity,
      registration_availability: 'AVAILABLE',
      event_title: event.title,
      changed: true,
    };
  }

  async listRegisteredUserIds(eventId: string) {
    const rows = await this.db.$queryRawUnsafe(
      `select er.student_id from public.event_registrations er join public.profiles p on p.id=er.student_id and p.is_active where er.event_id=$1::uuid and er.status='REGISTERED'`,
      eventId,
    );
    return rows.map((row: any) => row.student_id as string);
  }

  async listMyEventRegistrations(
    userId: string,
    input: { upcomingOnly: boolean; limit: number; offset: number },
  ) {
    return this.db.$queryRawUnsafe(
      `select er.registration_id,e.event_id,e.club_id,c.name as club_name,c.is_active as club_is_active,e.title,e.description,e.venue,e.category,e.start_time,e.end_time,e.registration_deadline,e.capacity,e.status as event_status,er.status as registration_status,er.registered_at,er.updated_at,
       (select count(*)::int from public.event_registrations a where a.event_id=e.event_id and a.status='REGISTERED') as registration_count,
       case when e.status <> 'PUBLISHED' or e.registration_deadline<=now() or e.start_time<=now() then 'CLOSED' when (select count(*) from public.event_registrations a where a.event_id=e.event_id and a.status='REGISTERED')>=e.capacity then 'FULL' else 'AVAILABLE' end as registration_availability
       from public.event_registrations er join public.events e on e.event_id=er.event_id join public.clubs c on c.id=e.club_id
       where er.student_id=$1::uuid and ($2::boolean=false or (er.status='REGISTERED' and e.status in ('PUBLISHED','POSTPONED') and e.start_time>now() and c.is_active))
       order by e.start_time desc,er.registered_at desc limit $3 offset $4`,
      userId,
      input.upcomingOnly,
      input.limit,
      input.offset,
    );
  }

  async listEventParticipants(eventId: string) {
    return this.db.$queryRawUnsafe(
      `select er.registration_id,er.student_id,p.full_name,p.department,p.roll_number,er.status as registration_status,er.registered_at from public.event_registrations er join public.profiles p on p.id=er.student_id where er.event_id=$1::uuid order by p.full_name`,
      eventId,
    );
  }

  async getAttendance(eventId: string) {
    const [session, rows] = await Promise.all([
      this.db.$queryRawUnsafe(
        `select status,finalized_at from public.event_attendance_sessions where event_id=$1::uuid`,
        eventId,
      ),
      this.db.$queryRawUnsafe(
        `select student_id,status,notes from public.event_attendance where event_id=$1::uuid`,
        eventId,
      ),
    ]);
    return { session: session[0] ?? null, rows };
  }

  async markAttendance(input: {
    actorId: string;
    eventId: string;
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
    notes?: string | null;
  }) {
    const event = (
      await this.db.$queryRawUnsafe(
        `select * from public.events where event_id=$1::uuid`,
        input.eventId,
      )
    )[0];
    if (!event) throw new Error('Event not found.');
    await this.db.$executeRawUnsafe(
      `insert into public.event_attendance_sessions(event_id,club_id) values($1::uuid,$2::uuid) on conflict(event_id) do nothing`,
      input.eventId,
      event.club_id,
    );
    const session = (
      await this.db.$queryRawUnsafe(
        `select * from public.event_attendance_sessions where event_id=$1::uuid for update`,
        input.eventId,
      )
    )[0];
    if (session.status === 'FINALIZED') throw new Error('Finalized attendance cannot be changed.');
    const registered = (
      await this.db.$queryRawUnsafe(
        `select 1 from public.event_registrations where event_id=$1::uuid and student_id=$2::uuid and status='REGISTERED'`,
        input.eventId,
        input.studentId,
      )
    )[0];
    if (!registered)
      throw new Error('Attendance can only be marked for a currently registered participant.');
    return (
      await this.db.$queryRawUnsafe(
        `insert into public.event_attendance(event_id,student_id,status,notes,marked_by) values($1::uuid,$2::uuid,$3::public.attendance_status,$4,$5::uuid) on conflict(event_id,student_id) do update set status=excluded.status,notes=excluded.notes,marked_by=excluded.marked_by,marked_at=now(),updated_at=now() returning *`,
        input.eventId,
        input.studentId,
        input.status,
        input.notes ?? null,
        input.actorId,
      )
    )[0];
  }

  async finalizeAttendance(actorId: string, eventId: string) {
    await this.db.$executeRawUnsafe(
      `insert into public.event_attendance_sessions(event_id,club_id) select event_id,club_id from public.events where event_id=$1::uuid on conflict(event_id) do nothing`,
      eventId,
    );
    const session = (
      await this.db.$queryRawUnsafe(
        `select * from public.event_attendance_sessions where event_id=$1::uuid for update`,
        eventId,
      )
    )[0];
    if (!session) throw new Error('Event not found.');
    if (session.status === 'FINALIZED') throw new Error('Attendance is already finalized.');
    const unmarked = Number(
      (
        await this.db.$queryRawUnsafe(
          `select count(*)::int as count from public.event_registrations er left join public.event_attendance ea on ea.event_id=er.event_id and ea.student_id=er.student_id where er.event_id=$1::uuid and er.status='REGISTERED' and ea.id is null`,
          eventId,
        )
      )[0].count,
    );
    if (unmarked)
      throw new Error('Mark attendance for every registered participant before finalizing.');
    return (
      await this.db.$queryRawUnsafe(
        `update public.event_attendance_sessions set status='FINALIZED',finalized_by=$2::uuid,finalized_at=now() where id=$1::uuid returning *`,
        session.id,
        actorId,
      )
    )[0];
  }

  async listMyParticipation(userId: string) {
    return this.db.$queryRawUnsafe(
      `select er.registration_id,e.event_id,e.title as event_title,c.name as club_name,e.venue,e.start_time as starts_at,er.status as registration_status,ea.status as attendance_status,(s.status='FINALIZED') as attendance_finalized from public.event_registrations er join public.events e on e.event_id=er.event_id join public.clubs c on c.id=e.club_id left join public.event_attendance ea on ea.event_id=e.event_id and ea.student_id=er.student_id left join public.event_attendance_sessions s on s.event_id=e.event_id where er.student_id=$1::uuid order by e.start_time desc,er.registered_at desc`,
      userId,
    );
  }

  async listAttendanceDashboard(input: {
    userId: string;
    admin: boolean;
    clubId?: string;
    limit: number;
    offset: number;
  }) {
    return this.db.$queryRawUnsafe(
      `select e.event_id,e.club_id,c.name as club_name,e.title as event_title,e.start_time as starts_at,e.status as event_status,
      count(er.registration_id) filter(where er.status='REGISTERED')::int as registered_count,
      count(ea.id) filter(where er.status='REGISTERED' and ea.status='PRESENT')::int as present_count,
      count(ea.id) filter(where er.status='REGISTERED' and ea.status='ABSENT')::int as absent_count,
      count(ea.id) filter(where er.status='REGISTERED' and ea.status='EXCUSED')::int as excused_count,
      count(er.registration_id) filter(where er.status='REGISTERED' and ea.id is null)::int as unmarked_count,
      (s.status='FINALIZED') as attendance_finalized
      from public.events e join public.clubs c on c.id=e.club_id and c.is_active left join public.event_registrations er on er.event_id=e.event_id left join public.event_attendance ea on ea.event_id=er.event_id and ea.student_id=er.student_id left join public.event_attendance_sessions s on s.event_id=e.event_id
      where ($1::boolean or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$2::uuid and ur.club_id=e.club_id and ur.status='active' and ur.is_active and r.code='club_head')) and ($3::uuid is null or e.club_id=$3::uuid)
      group by e.event_id,c.name,s.status order by e.start_time desc,e.event_id limit $4 offset $5`,
      input.admin,
      input.userId,
      input.clubId || null,
      input.limit,
      input.offset,
    );
  }

  async generateOdSheet(input: {
    actorId: string;
    eventId: string;
    title: string;
    studentFields: string[];
    eventFields: string[];
  }) {
    const event = (
      await this.db.$queryRawUnsafe(
        `select e.*,c.name as club_name,s.status as attendance_session_status from public.events e join public.clubs c on c.id=e.club_id left join public.event_attendance_sessions s on s.event_id=e.event_id where e.event_id=$1::uuid`,
        input.eventId,
      )
    )[0];
    if (!event) throw new Error('Event not found.');
    if (event.attendance_session_status !== 'FINALIZED')
      throw new Error('OD sheets can only use finalized attendance.');
    const sheet = (
      await this.db.$queryRawUnsafe(
        `insert into public.od_sheets(event_id,club_id,title,student_fields,event_fields,event_data,created_by) values($1::uuid,$2::uuid,$3,$4::text[],$5::text[],$6::jsonb,$7::uuid) returning *`,
        input.eventId,
        event.club_id,
        input.title,
        input.studentFields,
        input.eventFields,
        JSON.stringify(
          Object.fromEntries(input.eventFields.map((field) => [field, event[field] ?? null])),
        ),
        input.actorId,
      )
    )[0];
    const students = await this.db.$queryRawUnsafe(
      `select ea.student_id,p.full_name,p.roll_number,p.department,p.year_of_study,p.email,p.phone from public.event_attendance ea join public.profiles p on p.id=ea.student_id where ea.event_id=$1::uuid and ea.status='PRESENT' order by ea.student_id`,
      input.eventId,
    );
    for (const student of students) {
      const data = Object.fromEntries(
        input.studentFields.map((field) => [field, student[field] ?? null]),
      );
      await this.db.$queryRawUnsafe(
        `insert into public.od_sheet_students(od_sheet_id,student_id,student_data) values($1::uuid,$2::uuid,$3::jsonb)`,
        sheet.id,
        student.student_id,
        JSON.stringify({ attendance_status: 'PRESENT', ...data }),
      );
    }
    return sheet;
  }

  async listFinalizedAttendanceSessions(userId: string, admin: boolean) {
    return this.db.$queryRawUnsafe(
      `select s.id,s.event_id,s.club_id,s.status,s.finalized_by,s.finalized_at,s.created_at,e.title from public.event_attendance_sessions s join public.events e on e.event_id=s.event_id where s.status='FINALIZED' and ($1::boolean or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$2::uuid and ur.club_id=s.club_id and ur.status='active' and ur.is_active and r.code='club_head')) order by s.finalized_at desc`,
      admin,
      userId,
    );
  }
  async listOdSheets(userId: string, admin: boolean) {
    return this.db.$queryRawUnsafe(
      `select s.* from public.od_sheets s where ($1::boolean or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$2::uuid and ur.club_id=s.club_id and ur.status='active' and ur.is_active and r.code='club_head')) order by s.created_at desc`,
      admin,
      userId,
    );
  }
  async listFacultyOdSheets(userId: string) {
    return this.db.$queryRawUnsafe(
      `select s.*, e.title as event_title, c.name as club_name
       from public.od_sheets s
       join public.events e on e.event_id=s.event_id
       join public.clubs c on c.id=s.club_id
       where s.status in ('CLOSED','APPROVED')
         and exists (
           select 1 from public.user_roles ur
           join public.roles r on r.id=ur.role_id
           where ur.user_id=$1::uuid and ur.club_id=s.club_id
             and ur.status='active' and ur.is_active and r.code='faculty_coordinator'
         )
       order by s.closed_at desc nulls last, s.created_at desc`,
      userId,
    );
  }
  async closeOdSheet(actorId: string, id: string) {
    const rows = await this.db.$queryRawUnsafe(
      `update public.od_sheets
       set status='CLOSED', closed_by=$1::uuid, closed_at=now()
       where id=$2::uuid and status='OPEN'
       returning *`,
      actorId,
      id,
    );
    if (!rows[0]) throw new Error('Only an open participation list can be closed.');
    return rows[0];
  }
  async approveOdSheet(actorId: string, id: string) {
    const rows = await this.db.$queryRawUnsafe(
      `update public.od_sheets
       set status='APPROVED', approved_by=$1::uuid, approved_at=now()
       where id=$2::uuid and status='CLOSED'
       returning *`,
      actorId,
      id,
    );
    if (!rows[0]) throw new Error('Only a closed participation list can be approved.');
    return rows[0];
  }
  async getOdSheet(id: string) {
    const [sheet, students] = await Promise.all([
      this.db.$queryRawUnsafe(`select * from public.od_sheets where id=$1::uuid`, id),
      this.db.$queryRawUnsafe(
        `select * from public.od_sheet_students where od_sheet_id=$1::uuid order by created_at`,
        id,
      ),
    ]);
    return { sheet: sheet[0] ?? null, students };
  }
}

function notificationRow(row: any): NotificationDto {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    related_event_id: row.relatedEventId ?? null,
    is_read: row.isRead,
    created_at: row.createdAt.toISOString(),
  };
}

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `club-${Date.now()}`;
}
