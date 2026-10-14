import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { Wifi, WifiOff, LogOut } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const { isOnline, isSimulatedOffline, toggleSimulatedOffline } = useNetwork();
  return (
    <header className="simple-navbar atlas-topbar">
      <div className="navbar-status">
        <span className={`connection-pill ${isOnline ? 'is-online' : 'is-offline'}`}>
          {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
          {isOnline ? 'Connected' : 'Offline'}
        </span>
        <span className="atlas-context">PERSONAL WALLET / {user?.role || 'account'}</span>
        <button className="btn btn-sm btn-outline" onClick={toggleSimulatedOffline} title="Switch network mode for the offline payment demo">
          {isSimulatedOffline ? 'Reconnect' : 'Try offline mode'}
        </button>
      </div>
      {user && <div className="navbar-user"><div><strong>{user.username}</strong><span>{user.role === 'analyst' ? 'Payment reviewer' : user.role === 'merchant' ? 'Merchant account' : 'Customer account'}</span></div><button className="logout-button" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={17} /></button></div>}
    </header>
  );
}
