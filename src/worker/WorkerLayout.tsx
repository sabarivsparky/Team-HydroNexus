import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Camera, Clock3, House, LogOut, Moon, Sun, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function WorkerLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/worker/login', { replace: true });
  };

  return (
    <div className="wk-shell">
      <header className="wk-header">
        <div className="wk-header-brand">
          <div className="wk-header-icon"><Wind size={18} color="#fff" /></div>
          <div>
            <div className="wk-header-title">H₂S Dosimeter</div>
            <div className="wk-header-sub">{user?.name ?? 'Worker'} · {user?.employee_id}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="wk-header-logout"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={isDark ? "Light theme" : "Dark theme"}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="wk-header-logout" onClick={handleLogout} aria-label="Logout" title="Logout">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="wk-content">
        <Outlet />
      </main>

      <nav className="wk-bottomnav" aria-label="Worker navigation">
        <NavLink to="/worker/dashboard" className="wk-navitem">
          <House size={22} /><span>Home</span>
        </NavLink>
        <NavLink to="/worker/scan" className="wk-navitem wk-navitem-scan">
          <span className="wk-nav-scan-btn"><Camera size={26} /></span>
          <span>Scan</span>
        </NavLink>
        <NavLink to="/worker/history" className="wk-navitem">
          <Clock3 size={22} /><span>History</span>
        </NavLink>
      </nav>
    </div>
  );
}
