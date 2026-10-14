import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import { FileQuestion, CheckCircle, XCircle, Eye, AlertCircle, ShieldCheck } from 'lucide-react';

export function DisputeManagement() {
  const { isOnline } = useNetwork();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [activeDispute, setActiveDispute] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
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
        const res = await apiService.getAnalystDisputes();
        setDisputes(res.data || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load disputes list.');
    } finally {
      setLoading(false);
    }
  }

  const handleDecide = async (decision) => {
    if (!activeDispute) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiService.decideDispute(activeDispute.dispute_id, decision, decisionNotes);
      setSuccessMsg(`Dispute decided as ${decision}. Financial reversal and audit log applied.`);
      setActiveDispute(null);
      setDecisionNotes('');
      await loadDisputes();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = disputes.filter((d) => {
    if (filter === 'OPEN' && d.status !== 'OPEN') return false;
    if (filter === 'RESOLVED_REFUNDED' && d.status !== 'RESOLVED_REFUNDED') return false;
    if (filter === 'RESOLVED_REJECTED' && d.status !== 'RESOLVED_REJECTED') return false;
    return true;
  });

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
      header: 'Filed At',
      accessor: 'created_at',
      render: (d) => new Date(d.created_at).toLocaleDateString(),
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (d) => (
        <button
          onClick={() => {
            setActiveDispute(d);
            setDecisionNotes(d.decision_notes || '');
          }}
          className="btn btn-sm btn-outline"
        >
          <Eye size={14} />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading analyst disputes..." />;

  let parsedEvidence = null;
  if (activeDispute && activeDispute.evidence_bundle_json) {
    try {
      parsedEvidence = JSON.parse(activeDispute.evidence_bundle_json);
    } catch (e) {
      parsedEvidence = activeDispute.evidence_bundle_json;
    }
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileQuestion size={26} color="var(--primary)" />
          <h1>Dispute Adjudication & Reversals</h1>
        </div>
        <p>Inspect attached cryptographic evidence bundles and execute authoritative refund decisions.</p>
      </div>

      <ErrorMessage error={errorMsg} onRetry={loadDisputes} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ALL', 'OPEN', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No disputes matching selected filter."
        />
      </div>

      {/* Adjudication Modal */}
      {activeDispute && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <span className="card-title">Dispute #{activeDispute.dispute_id.slice(0, 8)}</span>
              <button
                onClick={() => setActiveDispute(null)}
                className="btn btn-sm btn-outline"
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dispute Reason:</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                {activeDispute.reason}
              </div>
            </div>

            {/* Evidence Bundle */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Attached Cryptographic Evidence Bundle
              </div>
              <pre
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {JSON.stringify(parsedEvidence, null, 2)}
              </pre>
            </div>

            {/* Adjudication Actions */}
            {activeDispute.status === 'OPEN' || activeDispute.status === 'UNDER_REVIEW' ? (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Analyst Decision Findings & Audit Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Provide justification for refund approval or rejection..."
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleDecide('RESOLVED_REJECTED')}
                    className="btn btn-danger"
                    disabled={submitting}
                  >
                    <XCircle size={16} /> Reject Dispute
                  </button>
                  <button
                    onClick={() => handleDecide('RESOLVED_REFUNDED')}
                    className="btn btn-success"
                    disabled={submitting}
                  >
                    <CheckCircle size={16} /> Approve & Refund Payer
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                <strong>Decision Recorded:</strong> {activeDispute.status}
                <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                  Notes: {activeDispute.decision_notes || 'None'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
