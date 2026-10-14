import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { errorMessage, type Club } from '../clubs/types';

export function useManagedClubs() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!user) {
      setClubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const role = await supabase.from('roles').select('id').eq('code', 'club_head').single();
    if (role.error) {
      setError(errorMessage(role.error));
      setLoading(false);
      return;
    }
    const assignments = await supabase
      .from('user_roles')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('role_id', role.data.id)
      .eq('status', 'active')
      .not('club_id', 'is', null);
    if (assignments.error) {
      setError(errorMessage(assignments.error));
      setLoading(false);
      return;
    }
    const clubIds = assignments.data
      .map(({ club_id }) => club_id)
      .filter((id): id is string => Boolean(id));
    if (!clubIds.length) {
      setClubs([]);
      setLoading(false);
      return;
    }
    const result = await supabase
      .from('clubs')
      .select('*')
      .in('id', clubIds)
      .eq('is_active', true)
      .order('name');
    if (result.error) setError(errorMessage(result.error));
    else setClubs((result.data ?? []) as Club[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { clubs, loading, error, reload };
}
