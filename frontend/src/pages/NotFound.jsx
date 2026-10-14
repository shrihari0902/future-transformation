import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <ShieldAlert size={64} color="var(--primary)" style={{ marginBottom: '1.25rem', opacity: 0.8 }} />
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>404 - Page Not Found</h1>
      <p style={{ maxWidth: '420px', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        The requested offline payment resource or security portal page does not exist.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        <ArrowLeft size={16} /> Return to Dashboard
      </Link>
    </div>
  );
}
