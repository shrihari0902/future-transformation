import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { StatusBadge, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Key,
  Calendar,
  FileQuestion,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';

export function TransactionDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      setErrorMsg('');
      try {
        if (isOnline) {
          try {
            const res = await apiService.getTransactionDetails(id);
            setTx(res.data);
            return;
          } catch (e) {
            console.warn('Server fetch failed, checking local storage:', e);
          }
        }

        // Fallback: search IndexedDB queue
        const queue = await getSyncQueue();
        const local = queue.find((q) => q.transaction_id === id);
        const payload = local?.token_payload || {};
        const canViewLocal = local && user && (
          user.role === 'merchant'
            ? String(payload.payee_id) === String(user.id)
              || String(payload.payee_id) === user.username
            : String(payload.payer_user_id) === String(user.id)
              || String(payload.payee_id) === String(user.id)
              || String(payload.payee_id) === user.username
        );
        if (canViewLocal) {
          setTx({
            transaction_id: local.transaction_id,
            certificate_id: local.token_payload?.certificate_id,
            payer: { id: local.token_payload?.payer_user_id, username: 'Local Payer' },
            payee: { id: local.token_payload?.payee_id, username: String(local.token_payload?.payee_id) },
            payer_device_id: local.token_payload?.payer_device_id,
            amount: local.token_payload?.amount,
            nonce: local.token_payload?.nonce,
            counter: local.token_payload?.counter,
            status: local.local_status,
            flag_reason: local.flag_reason || null,
            issued_at: local.token_payload?.issued_at,
            expires_at: local.token_payload?.expires_at,
            created_at: local.created_at,
            settled_at: local.synced_at || null,
            evidence: {
              token_signature: local.token_signature,
              raw_token_json: JSON.stringify(local.token_payload, null, 2),
              payer_public_key: local.payer_public_key,
            },
            receipt: local.receipt || null,
          });
        } else {
          setErrorMsg('Transaction details not found on server or local storage.');
        }
      } catch (err) {
        setErrorMsg('Failed to load transaction details.');
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [id, isOnline]);

  if (loading) return <LoadingSpinner message="Loading transaction details..." />;
  if (errorMsg) return <div className="page-container"><ErrorMessage error={errorMsg} /></div>;
  if (!tx) return null;

  return (
    <div className="page-container">
      {/* Top Navigation */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/history" className="btn btn-sm btn-outline">
          <ArrowLeft size={16} /> Back to History
        </Link>

        {user?.role !== 'analyst' && tx.status !== 'REJECTED' && (
          <Link to={`/dispute/${tx.transaction_id}`} className="btn btn-sm btn-outline">
            <FileQuestion size={16} /> Raise Dispute
          </Link>
        )}
      </div>

      {/* Main Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Transaction Evidence & Settlement
            </div>
            <h1 style={{ fontSize: '1.6rem', marginTop: '0.2rem' }}>
              ₹{(tx.amount / 100).toFixed(2)}{' '}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                ({tx.amount.toLocaleString()} paise)
              </span>
            </h1>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <StatusBadge status={tx.status} />
              <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ID: {tx.transaction_id}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date Created:</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{new Date(tx.created_at).toLocaleString()}</div>
            {tx.settled_at && (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                Settled: {new Date(tx.settled_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Flag Reason Alert if present */}
        {tx.flag_reason && (
          <div className="alert alert-danger" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Security Flag Triggered:</strong>
              <div style={{ fontSize: '0.875rem', marginTop: '0.2rem' }}>{tx.flag_reason}</div>
            </div>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Parties & Counter Binding */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Parties & Protocol State</span>
            <ShieldCheck size={20} color="var(--primary)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payer:</span>
              <strong>{tx.payer?.username || `User #${tx.payer_user_id || 'N/A'}`}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payee (Merchant):</span>
              <strong>{tx.payee?.username || `User #${tx.payee_user_id || 'N/A'}`}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payer Device ID:</span>
              <span className="font-mono">{tx.payer_device_id}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Certificate ID:</span>
              <span className="font-mono">{tx.certificate_id}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sequence Counter:</span>
              <strong>#{tx.counter}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cryptographic Nonce:</span>
              <span className="font-mono" style={{ fontSize: '0.8rem' }}>{tx.nonce}</span>
            </div>
          </div>
        </div>

        {/* Merchant Signed Receipt */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Merchant Receipt Evidence</span>
            <Receipt size={20} color="var(--accent)" />
          </div>

          {tx.receipt ? (
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontWeight: 700, marginBottom: '0.75rem' }}>
                <ShieldCheck size={18} />
                <span>Signed with Merchant Registered Device Key</span>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Token SHA-256 Digest</label>
                <div style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }} className="font-mono">
                  {tx.receipt.token_hash}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Merchant Receipt Signature (ECDSA)</label>
                <textarea
                  className="form-control font-mono"
                  rows={2}
                  value={tx.receipt.receipt_signature || ''}
                  readOnly
                  style={{ fontSize: '0.75rem', resize: 'none' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Terminal: <span className="font-mono">{tx.receipt.merchant_device_id}</span> | Accepted: {new Date(tx.receipt.accepted_at).toLocaleString()}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No merchant receipt attached (Token uploaded directly by customer or synced before receipt was generated).
            </div>
          )}
        </div>
      </div>

      {/* Cryptographic Signatures & Raw Evidence */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Cryptographic Token Evidence</span>
          <Key size={20} color="var(--primary)" />
        </div>

        {tx.evidence ? (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Payer Digital Signature (ECDSA P-256 SHA-256 Base64)</label>
              <textarea
                className="form-control font-mono"
                rows={2}
                value={tx.evidence.token_signature || ''}
                readOnly
                style={{ fontSize: '0.75rem', resize: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Payer Public Key (SubjectPublicKeyInfo DER Base64)</label>
              <textarea
                className="form-control font-mono"
                rows={2}
                value={tx.evidence.payer_public_key || ''}
                readOnly
                style={{ fontSize: '0.75rem', resize: 'none' }}
              />
            </div>

            <div>
              <label className="form-label">Canonical Token Payload (JSON)</label>
              <pre
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                }}
              >
                {tx.evidence.raw_token_json}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No raw token evidence payload available.
          </div>
        )}
      </div>
    </div>
  );
}
