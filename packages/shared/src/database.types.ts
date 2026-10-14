export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          department: string | null;
          year_of_study: number | null;
          bio: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          department: string | null;
          year_of_study: number | null;
          bio: string | null;
          status: string;
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
        Row: { id: string; name: string; slug: string; description: string | null; status: string };
        Insert: Partial<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          status: string;
        }>;
        Update: Partial<{ name: string; slug: string; description: string | null; status: string }>;
        Relationships: [];
      };
      roles: {
        Row: { id: string; code: string; name: string; is_global: boolean };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      permissions: {
        Row: { id: string; code: string; name: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      user_roles: {
        Row: { id: string; user_id: string; role_id: string; club_id: string | null };
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
          type: string;
          title: string;
          message: string;
          status: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Partial<{ status: string; read_at: string | null }>;
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
          p_channels: string[];
          p_metadata: Json;
        };
        Returns: string;
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
