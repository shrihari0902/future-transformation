import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import { FileQuestion, AlertCircle, CheckCircle, ShieldAlert, ArrowLeft } from 'lucide-react';

export function RaiseDispute() {
  const { id: txIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [transactionId, setTransactionId] = useState(txIdParam || '');
  const [reason, setReason] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadDisputes();
  }, [isOnline]);

  async function loadDisputes() {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isOnline) {
        const res = await apiService.getDisputes();
        setDisputes(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load disputes:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isOnline) {
      setErrorMsg('Raising a dispute requires an active server connection.');
      return;
    }

    if (!transactionId.trim() || !reason.trim()) {
      setErrorMsg('Please enter both Transaction ID and Dispute Reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiService.createDispute({
        transaction_id: transactionId.trim(),
        reason: reason.trim(),
      });

      setSuccessMsg(`Dispute #${res.data.dispute_id.slice(0, 8)} successfully submitted for analyst review.`);
      setReason('');
      if (!txIdParam) setTransactionId('');
      await loadDisputes();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit dispute.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Dispute ID',
      accessor: 'dispute_id',
      render: (d) => <span className="font-mono">{d.dispute_id.slice(0, 8)}...</span>,
    },
    {
      header: 'Transaction ID',
      accessor: 'transaction_id',
      render: (d) => <span className="font-mono">{d.transaction_id.slice(0, 10)}...</span>,
    },
    {
      header: 'Reason',
      accessor: 'reason',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (d) => {
        let badgeType = 'pending';
        if (d.status === 'RESOLVED_REFUNDED') badgeType = 'settled';
        if (d.status === 'RESOLVED_REJECTED') badgeType = 'rejected';
        return <span className={`badge badge-${badgeType}`}>{d.status}</span>;
      },
    },
    {
      header: 'Analyst Notes',
      accessor: 'decision_notes',
      render: (d) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {d.decision_notes || 'Pending evaluation'}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (d) => new Date(d.created_at).toLocaleDateString(),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading disputes..." />;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1>Dispute Management</h1>
        <p>Raise disputes against suspicious or contested offline transactions with cryptographic evidence.</p>
      </div>

      <ErrorMessage error={errorMsg} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Raise Dispute Form */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <span className="card-title">Submit a Transaction Dispute</span>
          <FileQuestion size={20} color="var(--primary)" />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Transaction ID</label>
            <input
              type="text"
              className="form-control font-mono"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              required
            />
            <div className="form-helper">
              The UUID of the settled or contested payment transaction.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Dispute Reason & Circumstances</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Describe the issue (e.g. Goods not delivered by merchant, duplicate debit, wrong amount charged...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div className="form-helper">
              The server will automatically attach the allowance certificate, token signature, and signed receipt evidence bundle.
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !isOnline}
          >
            {submitting ? 'Submitting Dispute...' : 'File Formal Dispute for Analyst'}
          </button>
        </form>
      </div>

      {/* User's Disputes Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">My Filed Disputes</span>
        </div>
        <DataTable
          columns={columns}
          data={disputes}
          emptyMessage="You have not filed any transaction disputes."
        />
      </div>
    </div>
  );
}
