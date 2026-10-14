import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-slate-600">Loading session…</div>;
  if (!session) return <Navigate to="/auth-required" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
