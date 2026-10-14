import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { AuthRequiredPage, PlaceholderPage } from './pages/PlaceholderPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth-required" element={<AuthRequiredPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="clubs" element={<PlaceholderPage title="Clubs" />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
