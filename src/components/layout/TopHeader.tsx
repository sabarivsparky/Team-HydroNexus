// Top header bar
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/workers':   'Worker Monitoring',
  '/exposure':  'Exposure Monitoring',
  '/shifts':    'Shift Monitoring',
  '/danger':    'Danger Workers',
  '/reports':   'Reports',
  '/settings':  'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/workers/')) return 'Worker Details';
  return PAGE_TITLES[pathname] ?? 'H₂S Monitor';
}

function useLiveTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

export default function TopHeader() {
  const { pathname } = useLocation();
  const { adminName } = useAuth();
  const now = useLiveTime();

  const initials = adminName
    ? adminName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });

  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });

  return (
    <header className="top-header">
      <div className="top-header-left">
        <div className="top-header-breadcrumb">
          H₂S Monitor &nbsp;/&nbsp; <span>{getPageTitle(pathname)}</span>
        </div>
      </div>

      <div className="top-header-right">
        <div className="header-live-badge">
          <div className="header-live-dot" />
          LIVE
        </div>

        <div className="header-datetime">
          {formattedDate} &nbsp;·&nbsp; {formattedTime}
        </div>

        <div className="header-admin-info">
          <div className="header-admin-avatar">{initials}</div>
          <span className="header-admin-name">{adminName || 'Admin'}</span>
        </div>
      </div>
    </header>
  );
}
