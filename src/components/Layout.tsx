import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Monitor, ScanLine } from 'lucide-react';
import './Layout.css';

const navItems = [
  { path: '/', label: 'Alerts', icon: LayoutDashboard },
  { path: '/devices', label: 'Devices', icon: Monitor },
  { path: '/scanner', label: 'Scanner', icon: ScanLine },
];

export function Layout() {
  return (
    <div className="layout-container">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: '0 1rem 2rem' }}>
          <h2>EDU Laiterekisteri</h2>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-content-wrapper">
        <main className="main-content">
          <Outlet />
        </main>
        
        {/* Footer with GDPR Privacy Link */}
        <footer className="footer">
          Lappeenranta EDU &copy; {new Date().getFullYear()} |{' '}
          <a href="https://www.lappeenranta.fi/fi/tietosuoja" target="_blank" rel="noopener noreferrer">
            Tietosuojaseloste
          </a>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={24} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
