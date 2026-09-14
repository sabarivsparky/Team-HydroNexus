// App layout shell — wraps all authenticated pages
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <TopHeader />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
