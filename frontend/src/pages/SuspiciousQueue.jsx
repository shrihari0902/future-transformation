import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import { AlertOctagon, Search, ArrowRight, ShieldAlert } from 'lucide-react';

export function SuspiciousQueue() {
  const { isOnline } = useNetwork();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadFlags();
  }, [isOnline]);

  async function loadFlags() {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isOnline) {
        const res = await apiService.getAnalystFlags();
        setFlags(res.data || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load suspicious transaction queue.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = flags.filter((f) => {
    if (filterType === 'DOUBLE_SPEND' && !f.flag_reason?.includes('DOUBLE-SPEND')) return false;
    if (filterType === 'REPLAY' && !f.flag_reason?.includes('REPLAY')) return false;
    if (filterType === 'COUNTER' && !f.flag_reason?.includes('COUNTER')) return false;

    if (search) {
      const term = search.toLowerCase();
      const matchId = (f.transaction_id || '').toLowerCase().includes(term);
      const matchReason = (f.flag_reason || '').toLowerCase().includes(term);
      return matchId || matchReason;
    }
    return true;
  });

  const columns = [
    {
      header: 'Transaction ID',
      accessor: 'transaction_id',
      render: (f) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 600 }}>{f.transaction_id.slice(0, 10)}...</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Device: <span className="font-mono">{f.payer_device_id?.slice(0, 8)}...</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Amount Claimed',
      accessor: 'amount',
      render: (f) => <strong>₹{(f.amount / 100).toFixed(2)}</strong>,
    },
    {
      header: 'Security Flag & Breach Reason',
      accessor: 'flag_reason',
      render: (f) => (
        <div style={{ color: '#991b1b', fontSize: '0.85rem', fontWeight: 600, maxWidth: '380px' }}>
          {f.flag_reason}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (f) => <StatusBadge status={f.status} />,
    },
    {
      header: 'Detected At',
      accessor: 'created_at',
      render: (f) => new Date(f.created_at).toLocaleString(),
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (f) => (
        <Link
          to={`/transaction/${f.transaction_id}`}
          className="btn btn-sm btn-outline"
        >
          <span>Evidence</span>
          <ArrowRight size={14} />
        </Link>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Scanning flagged transactions..." />;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertOctagon size={26} color="var(--danger)" />
          <h1>Suspicious Transaction Queue</h1>
        </div>
        <p>Investigate offline double-spend attempts, replay nonces, and counter sequencing anomalies.</p>
      </div>

      <ErrorMessage error={errorMsg} onRetry={loadFlags} />

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { id: 'ALL', label: 'All Flagged' },
              { id: 'DOUBLE_SPEND', label: 'Double-Spends' },
              { id: 'REPLAY', label: 'Replay Attacks' },
              { id: 'COUNTER', label: 'Counter Replays' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`btn btn-sm ${filterType === t.id ? 'btn-danger' : 'btn-outline'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              className="form-control"
              placeholder="Search by ID or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No flagged or suspicious transactions found matching filters."
        />
      </div>
    </div>
  );
}
