import type { ReactNode } from 'react';
import { usePermission } from '../hooks/usePermission';

type CanProps = {
  permission: string;
  clubId?: string | null;
  children: ReactNode;
  fallback?: ReactNode;
};

export function Can({ permission, clubId, children, fallback = null }: CanProps) {
  const { allowed, loading } = usePermission(permission, clubId);
  if (loading || !allowed) return <>{fallback}</>;
  return <>{children}</>;
}
