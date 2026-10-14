import { useEffect, useState } from 'react';
import { hasPermission, hasRole } from '@club-management/shared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePermission(permission: string, clubId?: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState({ allowed: false, loading: true });

  useEffect(() => {
    let active = true;
    if (!user) {
      setState({ allowed: false, loading: false });
      return () => {
        active = false;
      };
    }
    setState((current) => ({ ...current, loading: true }));
    void hasPermission(supabase, permission, clubId)
      .then((allowed) => active && setState({ allowed, loading: false }))
      .catch(() => active && setState({ allowed: false, loading: false }));
    return () => {
      active = false;
    };
  }, [permission, clubId, user]);

  return state;
}

export function useRole(role: string, clubId?: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState({ allowed: false, loading: true });
  useEffect(() => {
    let active = true;
    if (!user) {
      setState({ allowed: false, loading: false });
      return () => {
        active = false;
      };
    }
    void hasRole(supabase, role, clubId)
      .then((allowed) => active && setState({ allowed, loading: false }))
      .catch(() => active && setState({ allowed: false, loading: false }));
    return () => {
      active = false;
    };
  }, [role, clubId, user]);
  return state;
}
