import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { useNetwork } from '../context/NetworkContext';
import {
  getCachedBankPublicKey,
  checkAndRecordMerchantNonce,
  checkAndRecordMerchantCounter,
  addToSyncQueue,
  dbPut,
} from '../db/indexedDB';
import { verifySignature, signPayload, computeSha256Hex } from '../crypto/webCrypto';
import { ErrorMessage, StatusBadge } from '../components/UIComponents';
import {
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Clock,
  Key,
} from 'lucide-react';

export function ReceivePayment() {
  const { user } = useAuth();
  const { device, isRegistered } = useDevice();
  const { isOnline } = useNetwork();

  const [tokenInput, setTokenInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerifyAndAccept = async (e) => {
    e.preventDefault();
    setResult(null);
    setErrorMsg('');

    if (!tokenInput.trim()) {
      setErrorMsg('Please paste a payment token JSON bundle.');
      return;
    }

    if (!isRegistered || !device || !device.keyPair?.privateKey) {
      setErrorMsg('Merchant device key not registered in this browser. Please register in "Device Key" first to sign receipts.');
      return;
    }

    let bundle;
    try {
      bundle = JSON.parse(tokenInput.trim());
    } catch (err) {
      setErrorMsg('Invalid token format: could not parse JSON. Please paste a valid token bundle.');
      return;
    }

    setVerifying(true);
    const checks = [];

    try {
      const { token_payload, token_signature, payer_public_key, certificate } = bundle;

      if (!token_payload || !token_signature || !payer_public_key || !certificate) {
        throw new Error('Malformed token bundle: missing required fields (payload, signature, public key, or certificate).');
      }

      // CHECK 1: Certificate Payload & Bank Signature
      const bankSpki = await getCachedBankPublicKey();
      let bankSigValid = false;
      if (bankSpki && certificate.signature && certificate.payload) {
        bankSigValid = await verifySignature(bankSpki, certificate.payload, certificate.signature);
      } else {
        // Fallback or warning if bank key missing in cache
        console.warn('Bank public key not found in cache.');
      }

      checks.push({
        title: 'Bank Digital Signature on Certificate',
        passed: bankSigValid,
        detail: bankSigValid
          ? 'Cryptographically verified with Bank ECDSA P-256 key'
          : 'Failed: Bank signature invalid or bank public key unverified',
      });

      // CHECK 2: Certificate Expiration
      let certNotExpired = false;
      try {
        const certExpiry = new Date(certificate.payload.expires_at);
        certNotExpired = new Date() <= certExpiry;
      } catch (e) {
        certNotExpired = false;
      }
      checks.push({
        title: 'Allowance Certificate Expiration',
        passed: certNotExpired,
        detail: certNotExpired ? 'Certificate is within validity period' : 'Certificate has expired',
      });

      // CHECK 3: Token Expiration
      let tokenNotExpired = false;
      try {
        const tokenExpiry = new Date(token_payload.expires_at);
        tokenNotExpired = new Date() <= tokenExpiry;
      } catch (e) {
        tokenNotExpired = false;
      }
      checks.push({
        title: 'Payment Token Expiration',
        passed: tokenNotExpired,
        detail: tokenNotExpired ? 'Token is within validity period' : 'Payment token has expired',
      });

      // CHECK 4: Positive Amount
      const isPositive = token_payload.amount > 0;
      checks.push({
        title: 'Positive Amount',
        passed: isPositive,
        detail: isPositive ? `Amount is positive (${token_payload.amount} paise)` : 'Amount must be positive',
      });

      // CHECK 5: Per-Payment Limit
      const certLimit = certificate.payload?.max_per_payment || 0;
      const withinLimit = token_payload.amount <= certLimit;
      checks.push({
        title: 'Per-Payment Certificate Limit',
        passed: withinLimit,
        detail: withinLimit
          ? `₹${(token_payload.amount / 100).toFixed(2)} is within certificate limit of ₹${(certLimit / 100).toFixed(2)}`
          : `Amount exceeds certificate limit of ₹${(certLimit / 100).toFixed(2)}`,
      });

      // CHECK 6: Payee / Merchant ID Binding
      const myUsername = (user?.username || '').toLowerCase();
      const myId = String(user?.id || '');
      const tokenPayee = String(token_payload.payee_id || '').toLowerCase();
      const payeeMatches = tokenPayee === myUsername || tokenPayee === myId;
      checks.push({
        title: 'Payee Merchant Binding',
        passed: payeeMatches,
        detail: payeeMatches
          ? `Token payee '${token_payload.payee_id}' matches this merchant`
          : `Mismatch: Token payee '${token_payload.payee_id}' does not match your merchant identifier`,
      });

      // CHECK 7: Certificate & Payer Device Association
      const deviceMatches = certificate.payload?.device_id === token_payload.payer_device_id;
      checks.push({
        title: 'Certificate & Device Binding',
        passed: deviceMatches,
        detail: deviceMatches
          ? 'Certificate device matches payer device'
          : 'Certificate was issued to a different device',
      });

      // CHECK 8: Payer Signature on Payment Token
      const tokenSigValid = await verifySignature(payer_public_key, token_payload, token_signature);
      checks.push({
        title: 'Payer ECDSA Digital Signature on Token',
        passed: tokenSigValid,
        detail: tokenSigValid
          ? 'Cryptographically verified with payer device public key'
          : 'Failed: Token signature does not match canonical payload or key',
      });

      // CHECK 9: Local Nonce Replay Check
      const nonceCheck = await checkAndRecordMerchantNonce(token_payload.nonce, token_payload.transaction_id);
      checks.push({
        title: 'Local Nonce Replay Protection',
        passed: nonceCheck.valid,
        detail: nonceCheck.valid
          ? 'Nonce has not been previously accepted on this terminal'
          : nonceCheck.message,
      });

      // CHECK 10: Strictly Increasing Counter Check
      const counterCheck = await checkAndRecordMerchantCounter(token_payload.payer_device_id, token_payload.counter);
      checks.push({
        title: 'Strictly Increasing Counter Sequence',
        passed: counterCheck.valid,
        detail: counterCheck.valid
          ? `Counter #${token_payload.counter} is strictly higher than previous (${counterCheck.previous_counter})`
          : counterCheck.message,
      });

      // Overall Acceptance
      const allPassed = checks.every((c) => c.passed);

      if (allPassed) {
        // Generate Digitally Signed Merchant Receipt
        const tokenHash = await computeSha256Hex(token_payload);
        const acceptedAt = new Date().toISOString();

        const receiptPayload = {
          transaction_id: token_payload.transaction_id,
          token_hash: tokenHash,
          merchant_id: String(user.id),
          merchant_device_id: device.device_id,
          amount: token_payload.amount,
          accepted_at: acceptedAt,
        };

        const receiptSignature = await signPayload(device.keyPair.privateKey, receiptPayload);

        const signedReceipt = {
          ...receiptPayload,
          receipt_signature: receiptSignature,
        };

        // Store Token & Receipt in IndexedDB for syncing!
        await addToSyncQueue({
          transaction_id: token_payload.transaction_id,
          token_payload,
          token_signature,
          payer_public_key,
          certificate,
          receipt: signedReceipt,
          local_status: 'ACCEPTED_OFFLINE',
          created_at: acceptedAt,
        });

        // Store in merchant receipts store
        await dbPut('merchant_receipts', {
          transaction_id: token_payload.transaction_id,
          receipt: signedReceipt,
          token_payload,
          accepted_at: acceptedAt,
        });

        setResult({
          status: 'ACCEPTED',
          amount: token_payload.amount,
          transaction_id: token_payload.transaction_id,
          receipt: signedReceipt,
          checks,
        });
      } else {
        setResult({
          status: 'REJECTED',
          amount: token_payload.amount,
          transaction_id: token_payload.transaction_id,
          checks,
        });
      }
    } catch (err) {
      console.error('Verification failed:', err);
      setErrorMsg(err.message || 'Verification process encountered an unhandled error.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1>Receive Payment (Merchant POS)</h1>
          {!isOnline && <span className="badge badge-pending">Offline POS Mode</span>}
        </div>
        <p>
          Verify offline payment tokens locally and generate digitally signed receipts.
        </p>
      </div>

      <ErrorMessage error={errorMsg} />

      <div className="grid-2">
        {/* Token Input Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Paste Payment Token</span>
            <ArrowDownLeft size={20} color="var(--primary)" />
          </div>

          <form onSubmit={handleVerifyAndAccept}>
            <div className="form-group">
              <label className="form-label">Payment Token Bundle (JSON)</label>
              <textarea
                className="form-control font-mono"
                rows={9}
                placeholder='Paste token JSON bundle from customer ({"token_payload": ...})'
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                required
                style={{ fontSize: '0.8rem' }}
              />
              <div className="form-helper">
                Merchant terminal runs full Web Crypto verification locally without contacting the bank server.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={verifying || !tokenInput.trim() || !isRegistered}
            >
              {verifying ? 'Verifying Cryptography Locally...' : 'Verify & Provisionally Accept'}
            </button>
          </form>
        </div>

        {/* Verification Result Display */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Verification Outcome</span>
            <ShieldCheck size={20} color="var(--accent)" />
          </div>

          {result ? (
            <div>
              {/* Outcome Banner */}
              {result.status === 'ACCEPTED' ? (
                <div
                  style={{
                    backgroundColor: 'var(--success-bg)',
                    border: '1px solid var(--success-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', marginBottom: '0.4rem' }}>
                    <CheckCircle size={22} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      ACCEPTED (PROVISIONAL)
                    </span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    ₹{(result.amount / 100).toFixed(2)}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#065f46', lineHeight: 1.4 }}>
                    <strong>Notice:</strong> Offline acceptance is provisional. Cryptographic verification confirms token authenticity and local sequence validity, but final settlement occurs upon synchronization with the bank.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', marginBottom: '0.4rem' }}>
                    <XCircle size={22} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      PAYMENT REJECTED
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                    One or more cryptographic or protocol validation checks failed. Do not deliver goods.
                  </p>
                </div>
              )}

              {/* Checks Checklist */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Verification Checks (10-Point Guard)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {result.checks.map((chk, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        fontSize: '0.825rem',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {chk.passed ? (
                        <CheckCircle size={15} color="var(--success)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      ) : (
                        <XCircle size={15} color="var(--danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      )}
                      <div>
                        <strong>{chk.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chk.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Merchant Receipt if accepted */}
              {result.receipt && (
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    <Receipt size={16} /> Digitally Signed Merchant Receipt Generated
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Signature: <span className="font-mono">{result.receipt.receipt_signature.slice(0, 24)}...</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Token Hash: <span className="font-mono">{result.receipt.token_hash.slice(0, 24)}...</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <Receipt size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <div>Paste a token bundle from a customer to execute local offline verification.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
