import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home, Wallet, ArrowUpRight, ArrowDownLeft, ReceiptText, MoreHorizontal,
  Smartphone, RefreshCw, FileQuestion, ShieldAlert, AlertTriangle, ChevronDown,
} from 'lucide-react';

const linkBase = {
  display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.72rem 0.85rem',
  borderRadius: '10px', color: '#536174', fontWeight: 600, textDecoration: 'none',
  fontSize: '0.9rem', marginBottom: '0.25rem', transition: 'background .15s ease',
};

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || 'customer';
  const [moreOpen, setMoreOpen] = useState(['/device', '/sync-queue', '/disputes'].includes(location.pathname));
  const isAnalyst = role === 'analyst';
  const linkStyle = ({ isActive }) => ({
    ...linkBase,
    color: isActive ? '#173f78' : '#536174',
    background: isActive ? '#eaf2ff' : 'transparent',
  });
  const item = (to, label, Icon) => (
    <NavLink key={to} to={to} style={linkStyle}>
      <Icon size={18} strokeWidth={2} /><span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="simple-sidebar atlas-nav">
      <div>
        <div className="sidebar-brand"><span className="sidebar-brand-icon"><Wallet size={20} /></span><span>OfflinePay <em>ATLAS</em></span></div>
        <p className="sidebar-caption">YOUR MONEY, IN MOTION</p>
        {item('/dashboard', 'Home', Home)}
        {isAnalyst ? (
          <>
            {item('/analyst', 'Review overview', ShieldAlert)}
            {item('/analyst/flags', 'Flagged payments', AlertTriangle)}
            {item('/analyst/disputes', 'Disputes to review', FileQuestion)}
          </>
        ) : (
          <>
            {role === 'customer' && item('/pay', 'Pay someone', ArrowUpRight)}
            {role === 'merchant' && item('/receive', 'Receive payment', ArrowDownLeft)}
            {item('/wallet', 'My wallet', Wallet)}
            {item('/history', 'Payment activity', ReceiptText)}
            <button className="sidebar-more" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen}>
              <MoreHorizontal size={18} /><span>More options</span><ChevronDown size={15} className={moreOpen ? 'chevron-open' : ''} />
            </button>
            {moreOpen && <div className="sidebar-submenu">
              {item('/device', 'Set up this device', Smartphone)}
              {item('/sync-queue', 'Pending sync', RefreshCw)}
              {item('/disputes', 'Report a problem', FileQuestion)}
            </div>}
          </>
        )}
      </div>
      <div className="sidebar-help"><ShieldAlert size={17} /><div><strong>Continuity by design</strong><p>Offline payments remain protected until the next sync.</p></div></div>
    </aside>
  );
}
