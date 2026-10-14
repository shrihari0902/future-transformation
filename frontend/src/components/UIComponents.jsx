import React from 'react';
import { CheckCircle, Clock, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';

export function StatusBadge({ status }) {
  const norm = (status || '').toUpperCase();

  if (norm === 'SETTLED') {
    return (
      <span className="badge badge-settled">
        <CheckCircle size={12} /> Settled
      </span>
    );
  }

  if (norm === 'ACCEPTED_OFFLINE' || norm === 'ACCEPTED') {
    return (
      <span className="badge badge-provisional">
        <Clock size={12} /> Accepted Offline (Provisional)
      </span>
    );
  }

  if (norm === 'FLAGGED') {
    return (
      <span className="badge badge-flagged">
        <AlertTriangle size={12} /> Flagged
      </span>
    );
  }

  if (norm === 'REJECTED') {
    return (
      <span className="badge badge-rejected">
        <XCircle size={12} /> Rejected
      </span>
    );
  }

  if (norm === 'SYNCING') {
    return (
      <span className="badge badge-provisional">
        <ArrowUpRight size={12} /> Syncing
      </span>
    );
  }

  return (
    <span className="badge badge-pending">
      <Clock size={12} /> {norm || 'Pending'}
    </span>
  );
}

export function BalanceCard({ title, amountPaise, subtitle, icon: Icon, color = 'primary' }) {
  const inrValue = (amountPaise || 0) / 100;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            ₹{inrValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {Icon && (
          <div
            style={{
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
            }}
          >
            <Icon size={22} />
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {subtitle || `${(amountPaise || 0).toLocaleString()} paise`}
      </div>
    </div>
  );
}

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{message}</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-outline">
          Retry
        </button>
      )}
    </div>
  );
}

export function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', isDanger = false }) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div className="card" style={{ maxWidth: '440px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>{title}</h3>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.925rem' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button onClick={onConfirm} className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  return null; // Handled dynamically in Navbar
}

export function DataTable({ columns, data, emptyMessage = 'No records found' }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {columns.map((col, colIdx) => (
                <td key={colIdx}>
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
