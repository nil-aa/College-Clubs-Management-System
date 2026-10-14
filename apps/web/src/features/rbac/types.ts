export type Role = {
  id: string;
  code: 'student' | 'club_head' | 'admin' | string;
  name: string;
  description: string | null;
  is_global: boolean;
  is_system: boolean;
  created_at: string;
};

export type ClubOption = { id: string; name: string; status: string };

export type UserOption = { id: string; full_name: string };

export type UserRoleAssignment = {
  id: string;
  user_id: string;
  role_id: string;
  club_id: string | null;
  assigned_by: string | null;
  created_at: string;
  status: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
};
