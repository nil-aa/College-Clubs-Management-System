export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type NotificationType =
  | 'event_published'
  | 'registration_confirmed'
  | 'registration_cancelled'
  | 'event_postponed'
  | 'event_cancelled';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          roll_number: string | null;
          avatar_url: string | null;
          phone: string | null;
          department: string | null;
          year_of_study: number | null;
          bio: string | null;
          status: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          full_name: string;
          email: string;
          roll_number: string | null;
          avatar_url: string | null;
          phone: string | null;
          department: string | null;
          year_of_study: number | null;
          bio: string | null;
          status: string;
          is_active: boolean;
        }>;
        Update: Partial<{
          full_name: string;
          phone: string | null;
          department: string | null;
          year_of_study: number | null;
        }>;
        Relationships: [];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          contact_email: string | null;
          status: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          contact_email: string | null;
          status: string;
          is_active: boolean;
          created_by: string | null;
        }>;
        Update: Partial<{
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          contact_email: string | null;
          status: string;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_global: boolean;
          is_system: boolean;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      role_permissions: {
        Row: { role_id: string; permission_id: string; created_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          club_id: string | null;
          assigned_by: string | null;
          created_at: string;
          assigned_at: string;
          status: string;
          is_active: boolean;
          deactivated_at: string | null;
          deactivated_by: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      club_memberships: {
        Row: { id: string; club_id: string; user_id: string; status: string };
        Insert: Partial<{ club_id: string; user_id: string; status: string }>;
        Update: Partial<{ status: string }>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          related_event_id: string | null;
          is_read: boolean;
          channels: string[];
          metadata: Json;
          status: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Partial<{ is_read: boolean; status: string; read_at: string | null }>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      events: {
        Row: {
          event_id: string;
          club_id: string;
          created_by: string;
          title: string;
          description: string | null;
          venue: string;
          category: string | null;
          start_time: string;
          end_time: string;
          registration_deadline: string;
          capacity: number;
          status: string;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          event_id: string;
          club_id: string;
          created_by: string;
          title: string;
          description: string | null;
          venue: string;
          category: string | null;
          start_time: string;
          end_time: string;
          registration_deadline: string;
          capacity: number;
          status: string;
          published_at: string | null;
        }>;
        Update: Partial<{
          title: string;
          description: string | null;
          venue: string;
          category: string | null;
          start_time: string;
          end_time: string;
          registration_deadline: string;
          capacity: number;
          status: string;
          published_at: string | null;
        }>;
        Relationships: [];
      };
      event_registrations: {
        Row: {
          registration_id: string;
          event_id: string;
          student_id: string;
          status: string;
          registered_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          registration_id: string;
          event_id: string;
          student_id: string;
          status: string;
        }>;
        Update: Partial<{ status: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_role: { Args: { p_role: string; p_club_id?: string | null }; Returns: boolean };
      has_permission: {
        Args: { p_permission: string; p_club_id?: string | null };
        Returns: boolean;
      };
      can_manage_club: { Args: { p_club_id: string }; Returns: boolean };
      create_event: {
        Args: {
          p_club_id: string;
          p_title: string;
          p_description: string | null;
          p_venue: string;
          p_category: string | null;
          p_start_time: string;
          p_end_time: string;
          p_registration_deadline: string;
          p_capacity: number;
        };
        Returns: string;
      };
      list_managed_events: {
        Args: { p_club_id?: string | null; p_limit?: number; p_offset?: number };
        Returns: Array<{
          event_id: string;
          club_id: string;
          created_by: string;
          title: string;
          description: string | null;
          venue: string;
          category: string | null;
          start_time: string;
          end_time: string;
          registration_deadline: string;
          capacity: number;
          status: string;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          registration_count: number;
        }>;
      };
      get_managed_event: {
        Args: { p_event_id: string };
        Returns: Array<{
          event_id: string;
          club_id: string;
          created_by: string;
          title: string;
          description: string | null;
          venue: string;
          category: string | null;
          start_time: string;
          end_time: string;
          registration_deadline: string;
          capacity: number;
          status: string;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          registration_count: number;
        }>;
      };
      update_event: {
        Args: {
          p_event_id: string;
          p_title: string;
          p_description: string | null;
          p_venue: string;
          p_category: string | null;
          p_start_time: string;
          p_end_time: string;
          p_registration_deadline: string;
          p_capacity: number;
        };
        Returns: string;
      };
      publish_event: { Args: { p_event_id: string }; Returns: string };
      postpone_event: {
        Args: {
          p_event_id: string;
          p_start_time?: string | null;
          p_end_time?: string | null;
          p_registration_deadline?: string | null;
        };
        Returns: string;
      };
      cancel_event: { Args: { p_event_id: string }; Returns: string };
      assign_club_head: {
        Args: { p_user_id: string; p_club_id: string };
        Returns: string;
      };
      revoke_club_head: {
        Args: { p_user_id: string; p_club_id: string };
        Returns: boolean;
      };
      set_user_role: {
        Args: { p_user_id: string; p_role: string };
        Returns: string;
      };
      assign_role: {
        Args: { p_user_id: string; p_role_id: string; p_club_id?: string | null };
        Returns: string;
      };
      revoke_role: {
        Args: { p_user_id: string; p_role_id: string; p_club_id?: string | null };
        Returns: boolean;
      };
      create_role: {
        Args: { p_code: string; p_name: string; p_description?: string | null };
        Returns: string;
      };
      update_role: {
        Args: {
          p_role_id: string;
          p_name: string;
          p_code?: string | null;
          p_description?: string | null;
        };
        Returns: string;
      };
      update_role_permissions: {
        Args: { p_role_id: string; p_permission_ids: string[] };
        Returns: boolean;
      };
      delete_role: { Args: { p_role_id: string }; Returns: boolean };
      is_club_member: { Args: { p_club_id: string }; Returns: boolean };
      log_audit: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id: string | null;
          p_metadata: Json;
        };
        Returns: number;
      };
      send_notification: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title: string;
          p_message: string;
          p_related_event_id?: string | null;
        };
        Returns: string;
      };
      send_notification_bulk: {
        Args: {
          p_user_ids: string[];
          p_type: string;
          p_title: string;
          p_message: string;
          p_related_event_id?: string | null;
        };
        Returns: number;
      };
      get_active_student_ids: { Args: Record<string, never>; Returns: string[] };
      mark_notification_read: { Args: { p_id: string }; Returns: boolean };
      mark_all_notifications_read: { Args: Record<string, never>; Returns: number };
      create_club: {
        Args: {
          p_name: string;
          p_description?: string | null;
          p_category?: string | null;
          p_contact_email?: string | null;
        };
        Returns: string;
      };
      update_club: {
        Args: {
          p_club_id: string;
          p_name: string;
          p_description?: string | null;
          p_category?: string | null;
          p_contact_email?: string | null;
        };
        Returns: string;
      };
      set_club_active: { Args: { p_club_id: string; p_is_active: boolean }; Returns: boolean };
      get_club_heads: {
        Args: { p_club_id: string };
        Returns: Array<{ id: string; full_name: string }>;
      };
      list_audit_logs: {
        Args: {
          p_action?: string | null;
          p_entity_type?: string | null;
          p_actor?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Array<{
          actor_id: string | null;
          actor_name: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
          total_count: number;
        }>;
      };
      get_admin_dashboard_stats: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
