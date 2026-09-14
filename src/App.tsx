import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import AppLayout       from './components/layout/AppLayout';
import LoginPage       from './pages/LoginPage';
import DashboardPage   from './pages/DashboardPage';
import WorkersPage     from './pages/WorkersPage';
import WorkerDetailPage from './pages/WorkerDetailPage';
import ExposurePage    from './pages/ExposurePage';
import ShiftsPage      from './pages/ShiftsPage';
import DangerPage      from './pages/DangerPage';
import ReportsPage     from './pages/ReportsPage';
import SettingsPage    from './pages/SettingsPage';

// ─── Protected route wrapper ───────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Public route — redirect if already logged in ──────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* Protected — wrapped in AppLayout */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workers"   element={<WorkersPage />} />
        <Route path="/workers/:workerId" element={<WorkerDetailPage />} />
        <Route path="/exposure"  element={<ExposurePage />} />
        <Route path="/shifts"    element={<ShiftsPage />} />
        <Route path="/danger"    element={<DangerPage />} />
        <Route path="/reports"   element={<ReportsPage />} />
        <Route path="/settings"  element={<SettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
