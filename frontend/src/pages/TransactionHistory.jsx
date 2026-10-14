import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import { History, Search, Filter, ExternalLink, ArrowRight } from 'lucide-react';

export function TransactionHistory() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadTransactions();
    const refreshAfterFunding = () => loadTransactions();
    window.addEventListener('wallet-funded', refreshAfterFunding);
    return () => window.removeEventListener('wallet-funded', refreshAfterFunding);
  }, [isOnline, user]);

  async function loadTransactions() {
    setLoading(true);
    setErrorMsg('');
    try {
      let combined = [];

      // 1. Fetch server records if online
      if (isOnline) {
        const res = await apiService.getTransactions();
        combined = res.data || [];
      }

      // 2. Fetch local queue items to display pending offline transactions
      try {
        const localItems = await getSyncQueue();
        const visibleLocalItems = localItems.filter((local) => {
          const payload = local.token_payload || {};
          if (!user) return false;
          if (user.role === 'merchant') {
            return String(payload.payee_id) === String(user.id)
              || String(payload.payee_id) === user.username;
          }
          return String(payload.payer_user_id) === String(user.id)
            || String(payload.payee_id) === String(user.id)
            || String(payload.payee_id) === user.username;
        });
        for (const local of visibleLocalItems) {
          // If not already in server list, add as local provisional record
          if (!combined.some((t) => t.transaction_id === local.transaction_id)) {
            combined.unshift({
              transaction_id: local.transaction_id,
              certificate_id: local.token_payload?.certificate_id,
              amount: local.token_payload?.amount || 0,
              counter: local.token_payload?.counter,
              nonce: local.token_payload?.nonce,
              status: local.local_status || 'ACCEPTED_OFFLINE',
              flag_reason: local.flag_reason || null,
              created_at: local.created_at,
              is_local_only: true,
            });
          }
        }
      } catch (e) {
        console.error('Error loading local queue items:', e);
      }

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to load transaction history:', err);
      setErrorMsg(err.response?.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }

  // Filter & Search logic
  const filteredData = transactions.filter((tx) => {
    // Status filter
    if (filter === 'SETTLED' && tx.status !== 'SETTLED') return false;
    if (filter === 'FLAGGED' && tx.status !== 'FLAGGED') return false;
    if (filter === 'OFFLINE' && tx.status !== 'ACCEPTED_OFFLINE') return false;

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = (tx.transaction_id || '').toLowerCase().includes(term);
      const matchCert = (tx.certificate_id || '').toLowerCase().includes(term);
      const matchNonce = (tx.nonce || '').toLowerCase().includes(term);
      return matchId || matchCert || matchNonce;
    }
    return true;
  });

  const columns = [
    {
      header: 'Transaction ID',
      accessor: 'transaction_id',
      render: (tx) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 600 }}>
            {tx.transaction_id.slice(0, 10)}...
          </span>
          {tx.is_local_only && (
            <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginLeft: '0.5rem' }}>
              (Local)
            </span>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Counter #{tx.counter}
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'transaction_type',
      render: (tx) => tx.transaction_type || (tx.is_local_only ? 'OUTGOING' : '—'),
    },
    {
      header: 'Counterparty',
      accessor: 'counterparty_username',
      render: (tx) => tx.counterparty_username || '—',
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (tx) => (
        <strong>₹{(tx.amount / 100).toFixed(2)}</strong>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (tx) => (
        <div>
          <StatusBadge status={tx.status} />
          {tx.flag_reason && (
            <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.2rem', maxWidth: '280px' }}>
              {tx.flag_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Timestamp',
      accessor: 'created_at',
      render: (tx) => (
        <span style={{ fontSize: '0.825rem' }}>
          {new Date(tx.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (tx) => (
        <Link
          to={`/transaction/${tx.transaction_id}`}
          className="btn btn-sm btn-outline"
          style={{ padding: '0.3rem 0.65rem' }}
        >
          <span>Details</span>
          <ArrowRight size={14} />
        </Link>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading transactions..." />;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1>Transaction History</h1>
          <History size={24} color="var(--primary)" />
        </div>
        <p>Comprehensive audit record of settled, offline provisional, and flagged transactions.</p>
      </div>

      <ErrorMessage error={errorMsg} onRetry={loadTransactions} />

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ALL', 'SETTLED', 'FLAGGED', 'OFFLINE'].map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setFilter(statusKey)}
                className={`btn btn-sm ${filter === statusKey ? 'btn-primary' : 'btn-outline'}`}
              >
                {statusKey === 'ALL' ? 'All Transactions' : statusKey}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              className="form-control"
              placeholder="Search by ID or Nonce..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filteredData}
          emptyMessage="No matching transactions found."
        />
      </div>
    </div>
  );
}
