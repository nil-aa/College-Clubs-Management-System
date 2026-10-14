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
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
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
                  path="events"
                  element={<PlaceholderPage title="Events" owner="Teammate 2" />}
                />
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
