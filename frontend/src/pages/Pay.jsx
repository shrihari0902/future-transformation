import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { useNetwork } from '../context/NetworkContext';
import { getAllCertificates, saveCertificate, addToSyncQueue } from '../db/indexedDB';
import { signPayload } from '../crypto/webCrypto';
import { apiService } from '../api/client';
import { ErrorMessage } from '../components/UIComponents';
import {
  ArrowUpRight,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Clock,
  Zap,
  Smartphone,
} from 'lucide-react';

export function Pay() {
  const { user } = useAuth();
  const { device, isRegistered, registerDevice, getNextCounter } = useDevice();
  const { isOnline } = useNetwork();

  const [certificates, setCertificates] = useState([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [payeeId, setPayeeId] = useState('merchant');
  const [amountInput, setAmountInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickSettingUp, setQuickSettingUp] = useState(false);

  useEffect(() => {
    loadCerts();
  }, [isOnline, device?.device_id]);

  async function loadCerts() {
    try {
      // 1. Load from IndexedDB
      let certs = await getAllCertificates();

      // 2. If online, fetch any certificates from server and sync to IndexedDB
      if (isOnline) {
        try {
          const serverRes = await apiService.getCertificates();
          const serverCerts = serverRes.data || [];
          for (const sc of serverCerts) {
            const payload = JSON.parse(sc.raw_payload_json);
            await saveCertificate({
              certificate_id: sc.certificate_id,
              payload,
              signature: sc.signature,
              remaining_amount: sc.reserve_amount,
            });
          }
          if (serverCerts.length > 0) {
            certs = await getAllCertificates();
          }
        } catch (e) {
          console.warn('Could not sync certificates from server:', e);
        }
      }

      setCertificates(certs || []);
      if (certs && certs.length > 0) {
        // Prefer certificate matching current registered device
        const match = certs.slice().reverse().find((c) => c.payload?.device_id === device?.device_id);
        setSelectedCertId(match ? match.certificate_id : certs[certs.length - 1].certificate_id);
      }
    } catch (e) {
      console.error('Error loading certificates from IndexedDB:', e);
    }
  }

  // 1-Click quick setup helper
  const handleQuickSetup = async () => {
    setQuickSettingUp(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let activeDev = device;
      // 1. Register device if not registered
      if (!isRegistered || !device) {
        activeDev = await registerDevice('Browser Device');
      }

      // 2. Lock ₹500 (50,000 paise) reserve
      const reserveRes = await apiService.createReserve(50000, activeDev.device_id);
      const createdReserve = reserveRes.data;
      const cert = createdReserve.certificate;

      if (cert) {
        const certPayload = JSON.parse(cert.raw_payload_json);
        await saveCertificate({
          certificate_id: cert.certificate_id,
          payload: certPayload,
          signature: cert.signature,
          remaining_amount: cert.reserve_amount,
        });
      }

      setSuccessMsg('Quick setup complete! Generated device key and issued signed ₹500 allowance certificate.');
      await loadCerts();
    } catch (err) {
      console.error('Quick setup error:', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Quick setup failed.');
    } finally {
      setQuickSettingUp(false);
    }
  };

  const activeCert = certificates.find((c) => c.certificate_id === selectedCertId);
  const maxPerPayment = activeCert ? (activeCert.payload?.max_per_payment || 0) : 0;
  const reserveAmount = activeCert ? (activeCert.payload?.reserve_amount || 0) : 0;
  const isDeviceMatch = Boolean(activeCert && device && activeCert.payload?.device_id === device.device_id);

  const handleGeneratePayment = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setGeneratedToken(null);
    setCopied(false);

    if (!isRegistered || !device || !device.keyPair?.privateKey) {
      setErrorMsg('No active device private key available in this browser to sign the payment. Register your device key first.');
      return;
    }

    if (!activeCert) {
      setErrorMsg('Please select a valid offline allowance certificate. If none exist, click Quick Setup or go to Wallet & Reserve.');
      return;
    }

    // Check device binding
    if (activeCert.payload?.device_id && activeCert.payload.device_id !== device.device_id) {
      setErrorMsg(
        `Device Mismatch: The selected certificate was issued to device "${activeCert.payload.device_id}", but your active browser device is "${device.device_id}". Please click ⚡ 1-Click Setup or go to Wallet to lock a reserve for this device.`
      );
      return;
    }

    const inr = parseFloat(amountInput);
    if (isNaN(inr) || inr <= 0) {
      setErrorMsg('Please enter a valid positive payment amount.');
      return;
    }

    const amountPaise = Math.round(inr * 100);

    // Limit enforcement
    if (amountPaise > maxPerPayment) {
      setErrorMsg(
        `Amount ₹${inr.toFixed(2)} exceeds maximum per-payment limit of ₹${(maxPerPayment / 100).toFixed(2)} specified in certificate.`
      );
      return;
    }

    // Check certificate expiry
    try {
      const expiresAt = new Date(activeCert.payload.expires_at);
      if (new Date() > expiresAt) {
        setErrorMsg('Selected allowance certificate has expired. Please create a fresh reserve online.');
        return;
      }
    } catch (e) {
      // Ignore
    }

    setLoading(true);
    try {
      // 1. Get next strictly incrementing counter for this device
      const counter = await getNextCounter(device.device_id);

      const now = new Date();
      const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours validity

      // 2. Construct canonical payment token payload
      const token_payload = {
        transaction_id: crypto.randomUUID(),
        certificate_id: activeCert.certificate_id,
        payer_device_id: device.device_id,
        payer_user_id: user.id,
        payee_id: payeeId.trim(),
        amount: amountPaise,
        nonce: crypto.randomUUID(),
        counter: counter,
        issued_at: now.toISOString(),
        expires_at: expires.toISOString(),
      };

      // 3. Digitally sign canonical token payload using device private key
      const token_signature = await signPayload(device.keyPair.privateKey, token_payload);

      // 4. Create complete token bundle
      const tokenBundle = {
        token_payload,
        token_signature,
        payer_public_key: device.public_key_spki,
        certificate: {
          payload: activeCert.payload,
          signature: activeCert.signature,
        },
      };

      // 5. Store pending transaction in IndexedDB sync queue
      await addToSyncQueue({
        transaction_id: token_payload.transaction_id,
        token_payload,
        token_signature,
        payer_public_key: device.public_key_spki,
        certificate: tokenBundle.certificate,
        local_status: 'ACCEPTED_OFFLINE',
        created_at: now.toISOString(),
      });

      setGeneratedToken(tokenBundle);
      setSuccessMsg('Offline payment token successfully signed and stored locally!');
    } catch (err) {
      console.error('Payment generation error:', err);
      setErrorMsg(err.message || 'Failed to sign payment token.');
    } finally {
      setLoading(false);
    }
  };

  const tokenString = generatedToken ? JSON.stringify(generatedToken) : '';

  const handleCopy = () => {
    if (tokenString) {
      navigator.clipboard.writeText(tokenString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1>Pay Offline</h1>
          {!isOnline && <span className="badge badge-pending">Offline Ready</span>}
        </div>
        <p>
          Generate a cryptographically signed payment token without needing an internet connection.
        </p>
      </div>

      <ErrorMessage error={errorMsg} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Guide Banner if no certificate is ready */}
      {certificates.length === 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.75rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Zap size={24} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>
                  Offline Allowance Required
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#1e3a8a', marginBottom: '0.5rem' }}>
                  To pay offline, your device requires an <strong>Allowance Certificate</strong> issued by the bank that pre-authorizes offline spending against your wallet reserve.
                </p>
                <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>
                  {!isRegistered && '• Register your browser device key\n'}
                  • Lock funds into an offline reserve
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {isOnline ? (
                <button
                  type="button"
                  onClick={handleQuickSetup}
                  className="btn btn-primary"
                  disabled={quickSettingUp}
                >
                  <Zap size={16} />
                  <span>{quickSettingUp ? 'Setting Up...' : '⚡ 1-Click Setup (Register Key & Lock ₹500)'}</span>
                </button>
              ) : (
                <div style={{ color: 'var(--warning)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Reconnect online to create a reserve
                </div>
              )}
              <Link to="/wallet" className="btn btn-outline">
                <Lock size={16} /> Custom Reserve
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Payment Creation Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Create Offline Payment</span>
            <ArrowUpRight size={20} color="var(--primary)" />
          </div>

          <form onSubmit={handleGeneratePayment}>
            {/* Select Certificate */}
            <div className="form-group">
              <label className="form-label">Allowance Certificate</label>
              {certificates.length === 0 ? (
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No active certificate in local storage. Click the 1-Click Setup button above to create one.
                </div>
              ) : (
                <select
                  className="form-control"
                  value={selectedCertId}
                  onChange={(e) => setSelectedCertId(e.target.value)}
                  required
                >
                  {certificates.map((c) => {
                    const isDev = Boolean(device && c.payload?.device_id === device.device_id);
                    return (
                      <option key={c.certificate_id} value={c.certificate_id}>
                        {isDev ? '✓ [Current Device] ' : '⚠ [Different Device] '}
                        Cert {c.certificate_id.slice(0, 8)}... (Max ₹{((c.payload?.max_per_payment || 0) / 100).toFixed(2)}/tx)
                      </option>
                    );
                  })}
                </select>
              )}
              {activeCert && (
                <div className="form-helper" style={{ color: isDeviceMatch ? 'inherit' : 'var(--danger)' }}>
                  {isDeviceMatch ? (
                    <>Certificate bound to this device. Limit: ₹{(maxPerPayment / 100).toFixed(2)} / payment | Reserve: ₹{(reserveAmount / 100).toFixed(2)}</>
                  ) : (
                    <>⚠ Warning: This certificate was issued to device <code>{activeCert.payload?.device_id || 'unknown'}</code>. Use ⚡ 1-Click Setup to lock a reserve for your current device.</>
                  )}
                </div>
              )}
            </div>

            {/* Merchant ID */}
            <div className="form-group">
              <label className="form-label">Merchant / Payee ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. merchant or user ID"
                value={payeeId}
                onChange={(e) => setPayeeId(e.target.value)}
                required
              />
              <div className="form-helper">
                The payment token will be cryptographically bound to this payee.
              </div>
            </div>

            {/* Payment Amount */}
            <div className="form-group">
              <label className="form-label">Payment Amount in INR (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max={maxPerPayment ? maxPerPayment / 100 : undefined}
                className="form-control"
                placeholder="e.g. 150"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
              />
              <div className="form-helper">
                {amountInput && !isNaN(parseFloat(amountInput))
                  ? `Equivalent to ${(parseFloat(amountInput) * 100).toLocaleString()} paise`
                  : `Max permitted for this payment: ₹${(maxPerPayment / 100).toFixed(2)}`}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading || certificates.length === 0 || !isRegistered}
            >
              {loading ? 'Signing Token Locally...' : 'Sign Offline Payment Token'}
            </button>
          </form>
        </div>

        {/* Generated Token & QR Display */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payment Token & QR Code</span>
            <QrCode size={20} color="var(--accent)" />
          </div>

          {generatedToken ? (
            <div>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <QRCodeSVG
                  value={tokenString}
                  size={190}
                  level="M"
                  includeMargin={true}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Present this QR to the merchant or copy the token text below
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Signed Token Bundle (JSON)
                  </label>
                  <button onClick={handleCopy} className="btn btn-sm btn-outline">
                    {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Token'}</span>
                  </button>
                </div>
                <textarea
                  className="form-control font-mono"
                  rows={5}
                  value={tokenString}
                  readOnly
                  style={{ fontSize: '0.75rem', resize: 'none' }}
                />
              </div>

              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Transaction ID:</span>
                  <span className="font-mono">{generatedToken.token_payload.transaction_id.slice(0, 10)}...</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Counter:</span>
                  <strong>#{generatedToken.token_payload.counter}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amount:</span>
                  <strong>₹{(generatedToken.token_payload.amount / 100).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <QrCode size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <div>Fill out the payment details on the left and click <strong>"Sign Offline Payment Token"</strong>.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                The QR code and copyable token bundle will appear here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
