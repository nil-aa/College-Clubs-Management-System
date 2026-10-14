import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, NotificationType } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

export type AuditLogEntry = {
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json;
  created_at: string;
  total_count: number;
};

export type AdminDashboardAuditEntry = Omit<AuditLogEntry, 'total_count'>;

export type AdminDashboardStats = {
  active_club_count: number;
  inactive_club_count: number;
  clubs_without_head_count: number;
  users_by_role: Array<{ role: string; count: number }>;
  recent_audit_logs: AdminDashboardAuditEntry[];
};

export async function hasRole(client: AppSupabaseClient, role: string, clubId?: string | null) {
  const { data, error } = await client.rpc('has_role', { p_role: role, p_club_id: clubId ?? null });
  if (error) throw error;
  return data;
}

export async function hasPermission(
  client: AppSupabaseClient,
  permission: string,
  clubId?: string | null,
) {
  const { data, error } = await client.rpc('has_permission', {
    p_permission: permission,
    p_club_id: clubId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function isClubMember(client: AppSupabaseClient, clubId: string) {
  const { data, error } = await client.rpc('is_club_member', { p_club_id: clubId });
  if (error) throw error;
  return data;
}

export async function canManageClub(client: AppSupabaseClient, clubId: string) {
  const { data, error } = await client.rpc('can_manage_club', { p_club_id: clubId });
  if (error) throw error;
  return data;
}

export async function assignClubHead(client: AppSupabaseClient, userId: string, clubId: string) {
  const { data, error } = await client.rpc('assign_club_head', {
    p_user_id: userId,
    p_club_id: clubId,
  });
  if (error) throw error;
  return data;
}

export async function revokeClubHead(client: AppSupabaseClient, userId: string, clubId: string) {
  const { data, error } = await client.rpc('revoke_club_head', {
    p_user_id: userId,
    p_club_id: clubId,
  });
  if (error) throw error;
  return data;
}

export async function setUserRole(client: AppSupabaseClient, userId: string, role: string) {
  const { data, error } = await client.rpc('set_user_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
  return data;
}

export async function logAudit(
  client: AppSupabaseClient,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Json = {},
) {
  const { data, error } = await client.rpc('log_audit', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data;
}

export async function sendNotification(
  client: AppSupabaseClient,
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedEventId?: string | null,
) {
  const { data, error } = await client.rpc('send_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_related_event_id: relatedEventId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function sendNotificationBulk(
  client: AppSupabaseClient,
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  relatedEventId?: string | null,
) {
  const { data, error } = await client.rpc('send_notification_bulk', {
    p_user_ids: userIds,
    p_type: type,
    p_title: title,
    p_message: message,
    p_related_event_id: relatedEventId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getActiveStudentIds(client: AppSupabaseClient) {
  const { data, error } = await client.rpc('get_active_student_ids');
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(client: AppSupabaseClient, notificationId: string) {
  const { data, error } = await client.rpc('mark_notification_read', { p_id: notificationId });
  if (error) throw error;
  return data;
}

export async function markAllNotificationsRead(client: AppSupabaseClient) {
  const { data, error } = await client.rpc('mark_all_notifications_read');
  if (error) throw error;
  return data;
}

export async function assignRole(
  client: AppSupabaseClient,
  userId: string,
  roleId: string,
  clubId?: string | null,
) {
  const { data, error } = await client.rpc('assign_role', {
    p_user_id: userId,
    p_role_id: roleId,
    p_club_id: clubId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function revokeRole(
  client: AppSupabaseClient,
  userId: string,
  roleId: string,
  clubId?: string | null,
) {
  const { data, error } = await client.rpc('revoke_role', {
    p_user_id: userId,
    p_role_id: roleId,
    p_club_id: clubId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function createRole(
  client: AppSupabaseClient,
  code: string,
  name: string,
  description?: string | null,
) {
  const { data, error } = await client.rpc('create_role', {
    p_code: code,
    p_name: name,
    p_description: description ?? null,
  });
  if (error) throw error;
  return data;
}

export async function updateRole(
  client: AppSupabaseClient,
  roleId: string,
  name: string,
  code?: string | null,
  description?: string | null,
) {
  const { data, error } = await client.rpc('update_role', {
    p_role_id: roleId,
    p_name: name,
    p_code: code ?? null,
    p_description: description ?? null,
  });
  if (error) throw error;
  return data;
}

export async function updateRolePermissions(
  client: AppSupabaseClient,
  roleId: string,
  permissionIds: string[],
) {
  const { data, error } = await client.rpc('update_role_permissions', {
    p_role_id: roleId,
    p_permission_ids: permissionIds,
  });
  if (error) throw error;
  return data;
}

export async function deleteRole(client: AppSupabaseClient, roleId: string) {
  const { data, error } = await client.rpc('delete_role', { p_role_id: roleId });
  if (error) throw error;
  return data;
}

export async function createClub(
  client: AppSupabaseClient,
  name: string,
  description?: string | null,
  category?: string | null,
  contactEmail?: string | null,
) {
  const { data, error } = await client.rpc('create_club', {
    p_name: name,
    p_description: description ?? null,
    p_category: category ?? null,
    p_contact_email: contactEmail ?? null,
  });
  if (error) throw error;
  return data;
}

export async function updateClub(
  client: AppSupabaseClient,
  clubId: string,
  name: string,
  description?: string | null,
  category?: string | null,
  contactEmail?: string | null,
) {
  const { data, error } = await client.rpc('update_club', {
    p_club_id: clubId,
    p_name: name,
    p_description: description ?? null,
    p_category: category ?? null,
    p_contact_email: contactEmail ?? null,
  });
  if (error) throw error;
  return data;
}

export async function setClubActive(client: AppSupabaseClient, clubId: string, isActive: boolean) {
  const { data, error } = await client.rpc('set_club_active', {
    p_club_id: clubId,
    p_is_active: isActive,
  });
  if (error) throw error;
  return data;
}

export async function getClubHeads(client: AppSupabaseClient, clubId: string) {
  const { data, error } = await client.rpc('get_club_heads', { p_club_id: clubId });
  if (error) throw error;
  return data ?? [];
}

export async function listAuditLogs(
  client: AppSupabaseClient,
  filters: {
    action?: string | null;
    entityType?: string | null;
    actor?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { data, error } = await client.rpc('list_audit_logs', {
    p_action: filters.action ?? null,
    p_entity_type: filters.entityType ?? null,
    p_actor: filters.actor ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_limit: filters.limit ?? 25,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as AuditLogEntry[];
}

export async function getAdminDashboardStats(client: AppSupabaseClient) {
  const { data, error } = await client.rpc('get_admin_dashboard_stats');
  if (error) throw error;
  return data as unknown as AdminDashboardStats;
}
