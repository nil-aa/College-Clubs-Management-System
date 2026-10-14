import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-lavender text-slateDark">
        Loading session…
      </div>
    );
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
