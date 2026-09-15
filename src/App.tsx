import {
  BrowserRouter, Navigate, Route, Routes,
} from 'react-router-dom';
import { Loader2, Wind } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';

import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkersPage from './pages/WorkersPage';
import WorkerDetailPage from './pages/WorkerDetailPage';
import ExposurePage from './pages/ExposurePage';
import ShiftsPage from './pages/ShiftsPage';
import DangerPage from './pages/DangerPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

import WorkerLayout from './worker/WorkerLayout';
import WorkerLoginPage from './worker/WorkerLoginPage';
import WorkerDashboardPage from './worker/WorkerDashboardPage';
import ScanPage from './worker/ScanPage';
import CapturePage from './worker/CapturePage';
import ResultPage from './worker/ResultPage';
import HistoryPage from './worker/HistoryPage';

function FullScreenLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      color: 'var(--color-text-muted)', background: 'var(--color-bg)',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, background: 'var(--color-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Wind size={24} color="#fff" />
      </div>
      <Loader2 className="wk-spin" size={22} />
    </div>
  );
}

function RequireRole({ role, children }: { role: 'admin' | 'worker'; children: React.ReactNode }) {
  const { isAuthenticated, user, ready } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (!isAuthenticated) {
    return <Navigate to={role === 'admin' ? '/login' : '/worker/login'} replace />;
  }
  if (role === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/worker/dashboard" replace />;
  }
  return <>{children}</>;
}

function PublicOnly({ role, children }: { role: 'admin' | 'worker'; children: React.ReactNode }) {
  const { isAuthenticated, user, ready } = useAuth();
  void role;
  if (!ready) return <FullScreenLoader />;
  if (isAuthenticated) {
    const target = user?.role === 'admin' ? '/dashboard' : '/worker/dashboard';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

function IndexRedirect() {
  const { isAuthenticated, user, ready } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.role === 'admin' ? '/dashboard' : '/worker/dashboard'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route index element={<IndexRedirect />} />

      {/* Auth */}
      <Route path="/login" element={<PublicOnly role="admin"><LoginPage /></PublicOnly>} />
      <Route path="/worker/login" element={<PublicOnly role="worker"><WorkerLoginPage /></PublicOnly>} />

      {/* Admin dashboard */}
      <Route element={<RequireRole role="admin"><AppLayout /></RequireRole>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workers" element={<WorkersPage />} />
        <Route path="/workers/:workerId" element={<WorkerDetailPage />} />
        <Route path="/exposure" element={<ExposurePage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/danger" element={<DangerPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Worker mobile app */}
      <Route element={<RequireRole role="worker"><WorkerLayout /></RequireRole>}>
        <Route path="/worker/dashboard" element={<WorkerDashboardPage />} />
        <Route path="/worker/scan" element={<ScanPage />} />
        <Route path="/worker/capture" element={<CapturePage />} />
        <Route path="/worker/result" element={<ResultPage />} />
        <Route path="/worker/history" element={<HistoryPage />} />
      </Route>

      <Route path="*" element={<IndexRedirect />} />
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
