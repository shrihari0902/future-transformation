import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useNetwork } from '../context/NetworkContext';
import { Smartphone, ShieldCheck, Key, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { ErrorMessage } from '../components/UIComponents';

export function DeviceRegistration() {
  const { device, isRegistered, registerDevice, loading } = useDevice();
  const { isOnline } = useNetwork();
  const [deviceName, setDeviceName] = useState('Browser Chrome Device');
  const [registering, setRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const dev = await registerDevice(deviceName);
      setSuccessMsg(`Device registered successfully with ID: ${dev.device_id}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Device registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1>Device Registration & Web Crypto Keys</h1>
        <p>Generate cryptographic key pairs in the browser using the Web Crypto API.</p>
      </div>

      <ErrorMessage error={errorMsg} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid-2">
        {/* Device Status & Key Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Browser Device Identity</span>
            <Smartphone size={20} color="var(--primary)" />
          </div>

          {isRegistered && device ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge badge-settled">
                  <CheckCircle size={12} /> Active & Registered
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  ECDSA P-256 (SHA-256)
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Registered Device ID</label>
                <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }} className="font-mono">
                  {device.device_id}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Current Strict Counter</label>
                <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                  <strong>{device.counter || 0}</strong> (Increments strictly on every signed payment)
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Device Public Key (SPKI Base64)</label>
                <textarea
                  className="form-control font-mono"
                  rows={4}
                  value={device.public_key_spki || ''}
                  readOnly
                  style={{ fontSize: '0.75rem', resize: 'none' }}
                />
                <div className="form-helper">
                  Shared with the server and offline merchants to verify your digital signatures.
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Private Key Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.875rem', fontWeight: 600 }}>
                  <ShieldCheck size={18} />
                  <span>Held strictly in browser IndexedDB (Never exported or transmitted)</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <AlertTriangle size={36} color="var(--warning)" style={{ marginBottom: '1rem' }} />
              <h3>No Keypair Registered</h3>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                This browser does not yet have an active cryptographic device identity. Generate a new keypair below.
              </p>
            </div>
          )}
        </div>

        {/* Generate / Re-generate Keypair Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isRegistered ? 'Rotate / Re-generate Keypair' : 'Register New Device Key'}
            </span>
            <Key size={20} color="var(--accent)" />
          </div>

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Device Label / Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. My Laptop Chrome Browser"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
              />
              <div className="form-helper">
                Friendly name for identifying this device.
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                Cryptographic Protocol Guarantees:
              </div>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                <li>Generates an asymmetric NIST P-256 elliptic curve key pair in hardware/browser memory.</li>
                <li>Private key is non-extractable from this machine.</li>
                <li>Public key is synchronized to the backend to authenticate your offline payments.</li>
              </ul>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={registering}
            >
              {registering ? (
                <>
                  <RefreshCw size={16} className="spin" /> Generating & Registering...
                </>
              ) : isRegistered ? (
                'Re-generate New Device Keypair'
              ) : (
                'Generate & Register Device Keypair'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
