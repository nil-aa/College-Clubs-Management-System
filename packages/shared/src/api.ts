export type ApiProfile = {
  id: string;
  full_name: string;
  email: string;
  roll_number: string | null;
  department: string | null;
  year_of_study: number | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ApiPermissionSnapshot = {
  roles: Array<{ code: string; clubId: string | null }>;
  permissions: Array<{ code: string; clubId: string | null }>;
};

export type ApiClub = {
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

export type ApiClubHead = { id: string; full_name: string };
export type ApiClubWithHeads = ApiClub & { heads: ApiClubHead[] };

export type ApiNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_event_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type ApiAuditLog = {
  actor_id: string | null;
  actor_name: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  created_at: string;
  total_count?: number;
};

export type ApiAdminDashboardStats = {
  active_club_count: number;
  inactive_club_count: number;
  clubs_without_head_count: number;
  users_by_role: Array<{ role: string; count: number }>;
  recent_audit_logs: ApiAuditLog[];
};

export type ApiRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_global: boolean;
  is_system: boolean;
  created_at: string;
};

export type ApiRoleAssignment = {
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
