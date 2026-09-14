// Sidebar navigation component
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Activity, Clock, TriangleAlert,
  FileText, Settings, LogOut, Wind
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardSummary } from '../../data/mockDataService';

const summary = getDashboardSummary();

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',           to: '/dashboard',  icon: <LayoutDashboard size={20} /> },
  { label: 'Workers',             to: '/workers',    icon: <Users size={20} /> },
  { label: 'Exposure Monitoring', to: '/exposure',   icon: <Activity size={20} /> },
  { label: 'Shift Monitoring',    to: '/shifts',     icon: <Clock size={20} /> },
  { label: 'Danger Workers',      to: '/danger',     icon: <TriangleAlert size={20} />, badge: summary.dangerWorkers },
  { label: 'Reports',             to: '/reports',    icon: <FileText size={20} /> },
  { label: 'Settings',            to: '/settings',   icon: <Settings size={20} /> },
];

export default function Sidebar() {
  const { logout, adminName } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Wind size={22} color="white" />
        </div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">H₂S Monitor</div>
          <div className="sidebar-logo-sub">Safety Dashboard</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-section-label">MONITORING</div>
        {navItems.slice(0, 5).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            aria-label={item.label}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-text">{item.label}</span>
            {item.badge ? (
              <span className="sidebar-link-badge">{item.badge}</span>
            ) : null}
          </NavLink>
        ))}

        <div className="sidebar-section-label" style={{ marginTop: '0.5rem' }}>ADMIN</div>
        {navItems.slice(5).map(item => (
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

      {/* Footer / Logout */}
      <div className="sidebar-footer">
        <div style={{ marginBottom: '0.75rem', padding: '0 0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          Logged in as <strong style={{ color: 'var(--color-text-dim)' }}>{adminName}</strong>
        </div>
        <button
          className="sidebar-logout-btn"
          onClick={handleLogout}
          id="sidebar-logout-btn"
          aria-label="Logout"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
