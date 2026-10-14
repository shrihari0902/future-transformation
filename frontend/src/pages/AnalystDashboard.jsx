import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { BalanceCard, StatusBadge, LoadingSpinner } from '../components/UIComponents';
import {
  ShieldAlert,
  AlertOctagon,
  FileQuestion,
  Layers,
  ArrowRight,
  TrendingDown,
  CheckCircle,
} from 'lucide-react';

export function AnalystDashboard() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [stats, setStats] = useState({
    totalTransactions: 0,
    flaggedCount: 0,
    openDisputes: 0,
    riskTiers: [],
  });
  const [recentFlags, setRecentFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalystStats() {
      setLoading(true);
      try {
        if (isOnline) {
          const [txRes, flagsRes, disputesRes, tiersRes] = await Promise.all([
            apiService.getAnalystTransactions(),
            apiService.getAnalystFlags(),
            apiService.getAnalystDisputes(),
            apiService.getRiskTiers(),
          ]);

          const txs = txRes.data || [];
          const flags = flagsRes.data || [];
          const disputes = disputesRes.data || [];
          const tiers = tiersRes.data || [];

          setStats({
            totalTransactions: txs.length,
            flaggedCount: flags.length,
            openDisputes: disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length,
            riskTiers: tiers,
          });

          setRecentFlags(flags.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load analyst stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalystStats();
  }, [isOnline]);

  if (loading) return <LoadingSpinner message="Loading analyst intelligence dashboard..." />;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={28} color="var(--danger)" />
          <h1>Risk & Security Analyst Operations</h1>
        </div>
        <p>Monitor double-spend anomalies, investigate cryptographic replay attacks, and adjudicate disputes.</p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid-3" style={{ marginBottom: '1.75rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Flagged & Suspicious Claims
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.25rem' }}>
                {stats.flaggedCount}
              </div>
            </div>
            <AlertOctagon size={28} color="var(--danger)" />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Double-spends, counter reuse, replay nonces
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Pending Disputes
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.25rem' }}>
                {stats.openDisputes}
              </div>
            </div>
            <FileQuestion size={28} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Awaiting forensic adjudication and refund decision
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                System Transactions
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                {stats.totalTransactions}
              </div>
            </div>
            <Layers size={28} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Settled, pending, and flagged across all wallets
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid-2">
        {/* Recent Flagged Transactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Suspicious / Flagged Claims</span>
            <Link to="/analyst/flags" className="btn btn-sm btn-outline">
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {recentFlags.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle size={32} color="var(--success)" style={{ marginBottom: '0.5rem' }} />
              <div>No flagged or suspicious transactions detected. System operates with clean integrity.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentFlags.map((f) => (
                <div
                  key={f.transaction_id}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong className="font-mono" style={{ fontSize: '0.85rem' }}>
                      {f.transaction_id.slice(0, 12)}...
                    </strong>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                      ₹{(f.amount / 100).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#991b1b' }}>
                    {f.flag_reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configured Risk Tiers Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Configured Risk Tiers</span>
            <Layers size={20} color="var(--primary)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.riskTiers.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Max Reserve: ₹{(t.max_reserve_amount / 100).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Per-Payment Limit: ₹{(t.max_per_payment_limit / 100).toFixed(2)} | {t.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
