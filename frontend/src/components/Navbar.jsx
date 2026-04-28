import { Link, useLocation } from 'react-router-dom';
import { Activity, ShieldAlert, LayoutDashboard } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Activity color="var(--accent-color)" size={32} />
        <h2 className="text-gradient" style={{ margin: 0 }}>AI Rescue<span style={{ color: 'var(--text-primary)' }}>Net</span></h2>
      </div>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <Link 
          to="/" 
          style={{
            textDecoration: 'none',
            color: location.pathname === '/' ? 'white' : 'var(--text-secondary)',
            fontWeight: location.pathname === '/' ? '600' : '400',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldAlert size={18} />
          Submit Request
        </Link>
        <Link 
          to="/admin" 
          style={{
            textDecoration: 'none',
            color: location.pathname === '/admin' ? 'white' : 'var(--text-secondary)',
            fontWeight: location.pathname === '/admin' ? '600' : '400',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <LayoutDashboard size={18} />
          Admin Ops
        </Link>
      </div>
    </nav>
  );
}
