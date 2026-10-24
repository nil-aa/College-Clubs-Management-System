import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthLayout } from './components/AuthLayout';
import { AppLayout } from './components/AppLayout';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignupPage } from './pages/SignupPage';
import { RoleManagementPage } from './pages/RoleManagementPage';
import { ManageClubsPage } from './pages/ManageClubsPage';
import { ClubDirectoryPage } from './pages/ClubDirectoryPage';
import { ClubDetailPage } from './pages/ClubDetailPage';
import { ManageClubPage } from './pages/ManageClubPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotificationsProvider } from './context/NotificationContext';
import { AuditLogPage } from './pages/AuditLogPage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { MyRegistrationsPage } from './pages/MyRegistrationsPage';
import { ManageEventsPage } from './pages/ManageEventsPage';
import { EventFormPage } from './pages/EventFormPage';
import { ManageEventDetailPage } from './pages/ManageEventDetailPage';
import { MyParticipationPage } from './pages/MyParticipationPage';
import { OdSheetsPage } from './pages/OdSheetsPage';
import { AttendanceReportsPage } from './pages/AttendanceReportsPage';
import { useRole } from './hooks/usePermission';
import { FacultyLoginPage } from './pages/FacultyLoginPage';
import { FacultyOdReviewPage } from './pages/FacultyOdReviewPage';

function HomeRoute() {
  const { allowed, loading } = useRole('global_admin');
  if (loading) return <div className="rounded-3xl bg-white p-8">Loading your workspace…</div>;
  return <Navigate to={allowed ? '/dashboard' : '/events'} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <Routes>
            <Route path="/auth-required" element={<Navigate to="/login" replace />} />
            <Route element={<AuthLayout />}>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>
            <Route element={<PublicOnlyRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/faculty/login" element={<FacultyLoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<HomeRoute />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:eventId" element={<EventDetailPage />} />
                <Route path="my-registrations" element={<MyRegistrationsPage />} />
                <Route path="participation-history" element={<MyParticipationPage />} />
                <Route path="od-sheets" element={<OdSheetsPage />} />
                <Route path="faculty/od-reviews" element={<FacultyOdReviewPage />} />
                <Route path="attendance-reports" element={<AttendanceReportsPage />} />
                <Route path="manage-events" element={<ManageEventsPage />} />
                <Route path="manage-events/new" element={<EventFormPage />} />
                <Route path="manage-events/:eventId/edit" element={<EventFormPage />} />
                <Route path="manage-events/:eventId" element={<ManageEventDetailPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="audit-logs" element={<AuditLogPage />} />
                <Route path="roles-permissions" element={<RoleManagementPage />} />
                <Route path="clubs" element={<ClubDirectoryPage />} />
                <Route path="clubs/:clubId/manage" element={<ManageClubPage />} />
                <Route path="clubs/:clubId" element={<ClubDetailPage />} />
                <Route path="manage-clubs" element={<ManageClubsPage />} />
                <Route path="memberships" element={<PlaceholderPage title="Memberships" />} />
                <Route path="recruitment" element={<PlaceholderPage title="Recruitment" />} />
                <Route path="committees" element={<PlaceholderPage title="Committees" />} />
                <Route path="volunteers" element={<PlaceholderPage title="Event volunteers" />} />
                <Route
                  path="bookings"
                  element={<PlaceholderPage title="Bookings & finance" owner="Teammate 3" />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
