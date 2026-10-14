import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

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
  type: string,
  title: string,
  message: string,
  channels: string[],
  metadata: Json = {},
) {
  const { data, error } = await client.rpc('send_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_channels: channels,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data;
}
