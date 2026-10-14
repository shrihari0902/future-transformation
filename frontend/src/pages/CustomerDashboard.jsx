import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useDevice } from '../context/DeviceContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { LoadingSpinner } from '../components/UIComponents';
import { AtlasActionRail, AtlasBalancePanel, AtlasReadiness, AtlasTimeline } from '../components/AtlasUI';
import { RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';

const money = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CustomerDashboard() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { isRegistered } = useDevice();
  const [wallet, setWallet] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const merchant = user?.role === 'merchant';

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const queue = await getSyncQueue();
        if (active) setPendingCount((queue || []).filter(x => x.local_status !== 'SETTLED').length);
        if (isOnline) {
          const [walletResult, txResult] = await Promise.allSettled([apiService.getWallet(), apiService.getTransactions()]);
          if (!active) return;
          if (walletResult.status === 'fulfilled') setWallet(walletResult.value.data);
          if (txResult.status === 'fulfilled') setRecent((txResult.value.data || []).slice(0, 4));
        }
      } catch (error) {
        console.warn('Could not load dashboard data:', error);
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [isOnline]);

  if (loading) return <LoadingSpinner message="Loading your wallet..." />;

  return (
    <div className="page-container atlas-dashboard">
      <section className="atlas-dashboard-intro">
        <div>
          <p className="atlas-overline">OFFLINEPAY ATLAS / {merchant ? 'MERCHANT VIEW' : 'PERSONAL VIEW'}</p>
          <h1>Hello, {user?.username || 'there'}.</h1>
          <p>One clear view of the money you can move now and the money ready for offline continuity.</p>
        </div>
        <span className={`large-status ${isOnline ? 'is-online' : 'is-offline'}`}><span className="status-dot" />{isOnline ? 'Connected' : 'Offline mode'}</span>
      </section>

      <div className="atlas-dashboard-grid">
        <div>
          <AtlasBalancePanel wallet={wallet} />
          <div className="atlas-section-heading"><span>Move money</span><small>Choose a path</small></div>
          <AtlasActionRail merchant={merchant} />
          <section className="atlas-activity-panel">
            <div className="atlas-section-heading"><span>Activity timeline</span><Link to="/history">Open ledger ↗</Link></div>
            <AtlasTimeline items={recent} money={money} />
          </section>
        </div>
        <div className="atlas-dashboard-side">
          <AtlasReadiness isOnline={isOnline} isRegistered={isRegistered} pendingCount={pendingCount} />
          {!isRegistered && <div className="atlas-side-note"><Smartphone size={18} /><span><strong>One quick setup</strong>Register this browser to create protected offline payments.</span><Link to="/device">Set up</Link></div>}
          {pendingCount > 0 && <div className="atlas-side-note atlas-side-note-warn"><RefreshCw size={18} /><span><strong>{pendingCount} payment{pendingCount === 1 ? '' : 's'} pending</strong>Reconnect to settle your local queue.</span><Link to="/sync-queue">Review</Link></div>}
          <div className="atlas-trust-note"><ShieldCheck size={18} /><div><strong>Built for interruption</strong><p>Payments stay signed and traceable even when the network drops.</p></div></div>
        </div>
      </div>
    </div>
  );
}
