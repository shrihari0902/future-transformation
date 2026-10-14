import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { getSyncQueue, updateSyncQueueItem, removeFromSyncQueue } from '../db/indexedDB';
import { apiService } from '../api/client';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export function OfflineSyncQueue() {
  const { isOnline } = useNetwork();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const items = await getSyncQueue();
      // Sort newest first
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setQueue(items);
    } catch (err) {
      console.error('Error reading sync queue:', err);
      setErrorMsg('Failed to read IndexedDB sync queue.');
    } finally {
      setLoading(false);
    }
  }

  const handleSyncAll = async () => {
    if (!isOnline) {
      setErrorMsg('Cannot synchronize while in offline mode. Please reconnect or disable simulation.');
      return;
    }

    const pendingItems = queue.filter((item) => item.local_status !== 'SETTLED');
    if (pendingItems.length === 0) {
      setErrorMsg('No pending transactions to synchronize.');
      return;
    }

    setSyncing(true);
    setErrorMsg('');
    setSyncResults(null);

    // Format items for backend /api/transactions/sync
    const payloadItems = pendingItems.map((item) => ({
      token_payload: item.token_payload,
      token_signature: item.token_signature,
      payer_public_key: item.payer_public_key,
      certificate: item.certificate,
      receipt: item.receipt || null,
    }));

    try {
      const response = await apiService.syncTransactions(payloadItems);
      const data = response.data;
      setSyncResults(data);

      // Update statuses in local IndexedDB based on server response
      for (const res of data.results) {
        const localItem = queue.find((q) => q.transaction_id === res.transaction_id);
        if (localItem) {
          localItem.local_status = res.status;
          localItem.server_message = res.message;
          localItem.flag_reason = res.flag_reason;
          localItem.settled_amount = res.settled_amount;
          localItem.synced_at = new Date().toISOString();
          await updateSyncQueueItem(localItem);
        }
      }

      await loadQueue();
    } catch (err) {
      console.error('Synchronization error:', err);
      setErrorMsg(err.response?.data?.detail || 'Network error during synchronization. Queued items are preserved.');
    } finally {
      setSyncing(false);
    }
  };

  const handleRemove = async (txId) => {
    await removeFromSyncQueue(txId);
    await loadQueue();
  };

  if (loading) return <LoadingSpinner message="Loading local offline queue..." />;

  const queueColumns = [
    {
      header: 'Transaction ID',
      accessor: 'transaction_id',
      render: (item) => (
        <div>
          <span className="font-mono" style={{ fontSize: '0.85rem' }}>
            {item.transaction_id.slice(0, 10)}...
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Nonce: <span className="font-mono">{item.token_payload?.nonce?.slice(0, 8)}...</span> | Counter: {item.token_payload?.counter}
          </div>
        </div>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (item) => (
        <strong>₹{((item.token_payload?.amount || 0) / 100).toFixed(2)}</strong>
      ),
    },
    {
      header: 'Created (Local)',
      accessor: 'created_at',
      render: (item) => new Date(item.created_at).toLocaleTimeString(),
    },
    {
      header: 'Has Receipt',
      accessor: 'receipt',
      render: (item) => (
        <span style={{ fontSize: '0.8rem', color: item.receipt ? 'var(--success)' : 'var(--text-muted)' }}>
          {item.receipt ? 'Signed Receipt' : 'Token Only'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'local_status',
      render: (item) => (
        <div>
          <StatusBadge status={item.local_status} />
          {item.server_message && (
            <div style={{ fontSize: '0.75rem', color: item.local_status === 'FLAGGED' ? 'var(--danger)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
              {item.server_message}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (item) => (
        item.local_status === 'SETTLED' ? (
          <button
            onClick={() => handleRemove(item.transaction_id)}
            className="btn btn-sm btn-outline"
            style={{ color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}
            title="Clear settled transaction from local queue"
          >
            <Trash2 size={14} />
          </button>
        ) : null
      ),
    },
  ];

  const pendingCount = queue.filter((q) => q.local_status !== 'SETTLED').length;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1>Offline Synchronization Queue</h1>
            <span className="badge badge-provisional font-mono">{queue.length} items</span>
          </div>
          <p>
            Locally preserved IndexedDB transactions ready to be synchronized with the bank server.
          </p>
        </div>

        <button
          onClick={handleSyncAll}
          className="btn btn-primary"
          disabled={syncing || pendingCount === 0 || !isOnline}
        >
          {syncing ? (
            <>
              <RefreshCw size={16} className="spin" /> Syncing with Server...
            </>
          ) : (
            <>
              <UploadCloud size={16} /> Sync Now ({pendingCount} Pending)
            </>
          )}
        </button>
      </div>

      <ErrorMessage error={errorMsg} />

      {/* Sync Summary Result Banner */}
      {syncResults && (
        <div className="alert alert-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <CheckCircle size={18} />
            <span>
              Synchronization Complete: {syncResults.settled} settled, {syncResults.flagged} flagged out of {syncResults.processed} processed.
            </span>
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            {syncResults.results.map((r, i) => (
              <div key={i} style={{ marginTop: '0.2rem' }}>
                • <strong className="font-mono">{r.transaction_id.slice(0, 8)}</strong>: {r.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Guide */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <StatusBadge status="ACCEPTED_OFFLINE" />
          <span>Locally verified in browser, awaiting upload</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <StatusBadge status="SETTLED" />
          <span>Final server ledger settlement complete</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <StatusBadge status="FLAGGED" />
          <span>Flagged by server (Double-spend, replay, overspend)</span>
        </div>
      </div>

      {/* Queue Table Card */}
      <div className="card">
        <DataTable
          columns={queueColumns}
          data={queue}
          emptyMessage="Your offline sync queue is currently empty. Generated payments will appear here."
        />
      </div>
    </div>
  );
}
