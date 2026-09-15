// Sidebar navigation component
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, Clock, ExternalLink, FileText, LayoutDashboard, LogOut,
  Settings, TriangleAlert, Users, Wind,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { WorkerSummary } from '../../types/api';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [danger, setDanger] = useState(0);

  useEffect(() => {
    api.listWorkers('', 'DANGER')
      .then((rows: WorkerSummary[]) => setDanger(rows.length))
      .catch(() => setDanger(0));
  }, []);

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Workers', to: '/workers', icon: <Users size={20} /> },
    { label: 'Exposure Readings', to: '/exposure', icon: <Activity size={20} /> },
    { label: 'Shift Monitoring', to: '/shifts', icon: <Clock size={20} /> },
    { label: 'Danger Workers', to: '/danger', icon: <TriangleAlert size={20} />, badge: danger || undefined },
    { label: 'Reports', to: '/reports', icon: <FileText size={20} /> },
    { label: 'Settings', to: '/settings', icon: <Settings size={20} /> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Wind size={22} color="white" />
        </div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">HydroNexus</div>
          <div className="sidebar-logo-sub">H₂S Dosimeter Admin</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-section-label">MONITORING</div>
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            aria-label={item.label}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-text">{item.label}</span>
            {item.badge ? <span className="sidebar-link-badge">{item.badge}</span> : null}
          </NavLink>
        ))}

        <div className="sidebar-section-label" style={{ marginTop: '0.5rem' }}>ADMIN</div>
        {navItems.slice(5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            aria-label={item.label}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <a className="sidebar-worker-link" href="/worker/login" target="_blank"
          rel="noreferrer">
          <ExternalLink size={15} /> Open worker app
        </a>
        <div style={{ marginBottom: '0.75rem', padding: '0 0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          Logged in as <strong style={{ color: 'var(--color-text-dim)' }}>{user?.name ?? 'Admin'}</strong>
        </div>
        <button className="sidebar-logout-btn" onClick={handleLogout}
          id="sidebar-logout-btn" aria-label="Logout">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
