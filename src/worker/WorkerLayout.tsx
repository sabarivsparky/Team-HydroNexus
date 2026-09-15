// Mobile worker app shell: top bar + content + bottom navigation.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Camera, Clock3, House, LogOut, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WorkerLayout() {
  const { user, logout } = useAuth();
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
        <button className="wk-header-logout" onClick={handleLogout} aria-label="Logout">
          <LogOut size={18} />
        </button>
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
