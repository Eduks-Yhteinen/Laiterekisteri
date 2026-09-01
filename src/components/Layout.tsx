import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Monitor, ScanLine, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../firebase';
import './Layout.css';

import eduksLogo from '../assets/eduks_logo.png';

const navItems = [
  { path: '/', label: 'Alerts', icon: LayoutDashboard },
  { path: '/devices', label: 'Devices', icon: Monitor },
  { path: '/scanner', label: 'Scanner', icon: ScanLine },
];

export function Layout() {
  const { user, role } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="layout-container">
      {/* * Pöytäkoneluokan sivupalkki (Desktop Sidebar) */}
      <aside className="sidebar">
        <div style={{ padding: '0 1rem 2rem', display: 'flex', justifyContent: 'center' }}>
          <img src={eduksLogo} alt="EDU Laiterekisteri Logo" style={{ maxWidth: '100%', height: 'auto', maxHeight: '60px' }} />
        </div>
        <nav style={{ flex: 1 }}>
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
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: isProfileOpen ? 'var(--color-bg)' : 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s',
                  width: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.displayName || user.email?.split('@')[0] || 'Käyttäjä'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {isProfileOpen ? '▼' : '▲'}
                </span>
              </button>

              {isProfileOpen && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: '0.25rem',
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.email || 'User'}>
                    {user.email || 'Käyttäjä'}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      backgroundColor: role === 'Global Admin' ? 'var(--color-primary)' : role === 'Admin' ? 'var(--color-warning)' : 'var(--color-border)',
                      color: role === 'Global Admin' ? 'white' : 'var(--color-text)',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}>
                      {role || 'User'}
                    </span>
                    
                    <button
                      onClick={() => auth.signOut()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-error)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '2px'
                      }}
                      title="Kirjaudu ulos"
                    >
                      <LogOut size={14} />
                      <span>Ulos</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              width: '100%', 
              padding: '0.5rem', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--color-text-muted)', 
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'Tumma teema' : 'Vaalea teema'}</span>
          </button>
        </div>
      </aside>

      <div className="main-content-wrapper">
        <main className="main-content">
          <Outlet />
        </main>
        
        <footer className="footer">
          Lappeenranta EDU &copy; {new Date().getFullYear()} |{' '}
          <a href="https://www.lappeenranta.fi/fi/tietosuoja" target="_blank" rel="noopener noreferrer">
            Tietosuojaseloste
          </a>
        </footer>
      </div>

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
