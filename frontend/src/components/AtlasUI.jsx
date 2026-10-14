import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, CheckCircle, Clock3, LockKeyhole, Wifi, WifiOff } from 'lucide-react';

export function AtlasBalancePanel({ wallet }) {
  const money = (value) => `₹${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <section className="atlas-balance-panel">
      <div className="atlas-panel-kicker">Atlas wallet / live balance</div>
      <div className="atlas-balance-value">{wallet ? money(wallet.total_balance) : '—'}</div>
      <p>Money you can move, send, or set aside for offline continuity.</p>
      <div className="atlas-balance-metrics">
        <div><span>Available now</span><strong>{wallet ? money(wallet.available_balance) : '—'}</strong></div>
        <div><span>Offline reserve</span><strong>{wallet ? money(wallet.reserved_balance) : '—'}</strong></div>
      </div>
    </section>
  );
}

export function AtlasActionRail({ merchant }) {
  return (
    <div className="atlas-action-rail">
      {!merchant && <Link to="/pay" className="atlas-action atlas-action-primary"><ArrowUpRight size={18} /><span>Send money<small>Pay someone offline</small></span></Link>}
      {merchant && <Link to="/receive" className="atlas-action atlas-action-primary"><ArrowDownLeft size={18} /><span>Receive payment<small>Verify a customer token</small></span></Link>}
      <Link to="/wallet" className="atlas-action"><LockKeyhole size={18} /><span>Manage reserve<small>Keep money ready offline</small></span></Link>
      <Link to="/history" className="atlas-action"><Clock3 size={18} /><span>View activity<small>Follow every movement</small></span></Link>
    </div>
  );
}

export function AtlasReadiness({ isOnline, isRegistered, pendingCount }) {
  return (
    <aside className="atlas-readiness">
      <div className="atlas-panel-kicker">Readiness signal</div>
      <div className="atlas-readiness-status">
        {isOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
        <strong>{isOnline ? 'Connected to Atlas' : 'Offline continuity active'}</strong>
      </div>
      <div className="atlas-readiness-row"><span>Device certificate</span><b>{isRegistered ? 'Ready' : 'Set up needed'}</b></div>
      <div className="atlas-readiness-row"><span>Pending sync</span><b>{pendingCount ? `${pendingCount} waiting` : 'Clear'}</b></div>
      <div className="atlas-readiness-line"><span style={{ width: `${isRegistered ? 100 : 42}%` }} /></div>
    </aside>
  );
}

export function AtlasTimeline({ items = [], money }) {
  return (
    <div className="atlas-timeline">
      {items.length === 0 ? (
        <div className="atlas-empty"><Clock3 size={22} /><strong>Your payment trail starts here</strong><span>Completed and offline payments will appear in this timeline.</span></div>
      ) : items.map((tx) => (
        <div className="atlas-timeline-item" key={tx.transaction_id}>
          <div className="atlas-timeline-dot"><CheckCircle size={14} /></div>
          <div className="atlas-timeline-copy"><strong>{tx.transaction_type || 'Payment'}</strong><span>{tx.counterparty_username || `Reference ${String(tx.transaction_id || '').slice(0, 10)}`}</span></div>
          <div className="atlas-timeline-amount"><strong>{money(tx.amount)}</strong><span>{tx.status}</span></div>
        </div>
      ))}
    </div>
  );
}
