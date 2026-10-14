/* eslint-disable no-unused-vars */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthError, AuthResponse, Session, User, UserResponse } from '@supabase/supabase-js';
import type { Database } from '@club-management/shared';
import { supabase } from '../lib/supabase';

export type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: Error | null;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (fullName: string, email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<UserResponse>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setProfileError(null);
      return null;
    }

    setProfileLoading(true);
    setProfileError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, roll_number, avatar_url, phone, department, year_of_study, bio, status, is_active, created_at, updated_at',
      )
      .eq('id', session.user.id)
      .single();
    setProfileLoading(false);
    if (error) {
      const nextError = new Error(error.message);
      setProfileError(nextError);
      throw nextError;
    }
    setProfile(data);
    return data;
  }, [session]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }
    void refreshProfile().catch(() => undefined);
  }, [refreshProfile, session]);

  const signIn = useCallback(
    (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
    [],
  );

  const signUp = useCallback(
    (fullName: string, email: string, password: string) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${origin()}/login`,
        },
      }),
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const resetPasswordForEmail = useCallback(
    (email: string) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin()}/reset-password`,
      }),
    [],
  );

  const updatePassword = useCallback(
    (password: string) => supabase.auth.updateUser({ password }),
    [],
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      profileError,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      profileError,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
