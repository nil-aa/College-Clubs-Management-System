import type { AuditLogEntry, Json } from '@club-management/shared';

export type AuditLogRow = AuditLogEntry;

export const knownAuditActions = [
  'profile.updated',
  'role.assigned',
  'role.revoked',
  'role.created',
  'role.updated',
  'role.permissions_updated',
  'role.deleted',
  'club_head.assigned',
  'club_head.revoked',
  'user_role.changed',
  'club.created',
  'club.updated',
  'club.activated',
  'club.deactivated',
] as const;

const actionLabels: Record<string, string> = {
  'profile.updated': 'Profile updated',
  'role.assigned': 'Role assigned',
  'role.revoked': 'Role revoked',
  'role.created': 'Role created',
  'role.updated': 'Role updated',
  'role.permissions_updated': 'Role permissions updated',
  'role.deleted': 'Role deleted',
  'club_head.assigned': 'Club Head assigned',
  'club_head.revoked': 'Club Head revoked',
  'user_role.changed': 'User role changed',
  'club.created': 'Club created',
  'club.updated': 'Club updated',
  'club.activated': 'Club activated',
  'club.deactivated': 'Club deactivated',
};

export function auditActionLabel(action: string) {
  return actionLabels[action] ?? action;
}

export function formatAuditDetails(details: Json) {
  return JSON.stringify(details ?? {}, null, 2);
}

export function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
