import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useDevice } from '../context/DeviceContext';
import { apiService } from '../api/client';
import { saveCertificate, getAllCertificates } from '../db/indexedDB';
import { BalanceCard, StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import { Wallet, Lock, PlusCircle, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

export function WalletReserve() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { device, isRegistered } = useDevice();

  const [wallet, setWallet] = useState(null);
  const [riskLimit, setRiskLimit] = useState(null);
  const [reserves, setReserves] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [amountInput, setAmountInput] = useState('');
  const [demoFundingInput, setDemoFundingInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [funding, setFunding] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWalletData();
  }, [isOnline]);

  async function loadWalletData() {
    setLoading(true);
    setError(null);
    try {
      if (isOnline) {
        const [walletRes, riskRes, reservesRes, ledgerRes] = await Promise.all([
          apiService.getWallet(),
          apiService.getMyRiskLimit(),
          apiService.getReserves(),
          apiService.getLedger(),
        ]);
        setWallet(walletRes.data);
        setRiskLimit(riskRes.data);
        setReserves(reservesRes.data);
        setLedger(ledgerRes.data);
      } else {
        // Load local certificates from IndexedDB
        const localCerts = await getAllCertificates();
        setReserves(
          localCerts.map((c) => ({
            reserve_id: c.payload?.certificate_id,
            amount: c.payload?.reserve_amount,
            remaining_allowance: c.payload?.reserve_amount,
            status: 'OFFLINE_CACHED',
            certificate: {
              certificate_id: c.certificate_id,
              signature: c.signature,
              expires_at: c.payload?.expires_at,
            },
          }))
        );
      }
    } catch (err) {
      console.error('Wallet data load error:', err);
      setError('Failed to fetch wallet data from server.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddDemoFunds = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isOnline) {
      setError('Simulated demo funding requires an online connection.');
      return;
    }

    const inr = parseFloat(demoFundingInput);
    if (!Number.isFinite(inr) || inr <= 0) {
      setError('Please enter a valid positive funding amount.');
      return;
    }

    const paise = Math.round(inr * 100);
    setFunding(true);
    try {
      await apiService.addDemoFunds(paise, crypto.randomUUID());
      setMessage(`Successfully added simulated demo funds of ₹${inr.toFixed(2)}.`);
      setDemoFundingInput('');
      await loadWalletData();
      window.dispatchEvent(new Event('wallet-funded'));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add simulated demo funds.');
    } finally {
      setFunding(false);
    }
  };

  const handleCreateReserve = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isOnline) {
      setError('Creating an offline reserve requires an online connection to the Bank server.');
      return;
    }

    if (!isRegistered || !device) {
      setError('You must register your browser device before creating an offline reserve.');
      return;
    }

    const inr = parseFloat(amountInput);
    if (isNaN(inr) || inr <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const paise = Math.round(inr * 100);

    if (wallet && paise > wallet.available_balance) {
      setError(`Cannot reserve more than available balance (₹${(wallet.available_balance / 100).toFixed(2)}).`);
      return;
    }

    if (riskLimit && paise > riskLimit.risk_tier.max_reserve_amount) {
      setError(
        `Requested reserve ₹${inr.toFixed(2)} exceeds your ${riskLimit.risk_tier.name} limit of ₹${(riskLimit.risk_tier.max_reserve_amount / 100).toFixed(2)}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiService.createReserve(paise, device.device_id);
      const createdReserve = res.data;
      const cert = createdReserve.certificate;

      if (cert) {
        // Save certificate into IndexedDB for offline signing & verification!
        const certPayload = JSON.parse(cert.raw_payload_json);
        await saveCertificate({
          certificate_id: cert.certificate_id,
          payload: certPayload,
          signature: cert.signature,
          remaining_amount: cert.reserve_amount,
        });
      }

      setMessage(`Successfully locked ₹${inr.toFixed(2)} into offline reserve! Bank issued signed certificate.`);
      setAmountInput('');
      await loadWalletData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create reserve.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading wallet and reserves..." />;

  const reservesColumns = [
    {
      header: 'Reserve ID',
      accessor: 'reserve_id',
      render: (r) => <span className="font-mono">{r.reserve_id.slice(0, 8)}...</span>,
    },
    {
      header: 'Total Locked',
      accessor: 'amount',
      render: (r) => <strong>₹{(r.amount / 100).toFixed(2)}</strong>,
    },
    {
      header: 'Remaining Allowance',
      accessor: 'remaining_allowance',
      render: (r) => <span>₹{(r.remaining_allowance / 100).toFixed(2)}</span>,
    },
    {
      header: 'Certificate ID',
      accessor: 'cert',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: '0.8rem' }}>
          {r.certificate?.certificate_id ? `${r.certificate.certificate_id.slice(0, 8)}...` : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const ledgerColumns = [
    {
      header: 'Date',
      accessor: 'created_at',
      render: (l) => new Date(l.created_at).toLocaleString(),
    },
    {
      header: 'Type',
      accessor: 'entry_type',
      render: (l) => (
        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: l.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {l.entry_type}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (l) => (
        <strong style={{ color: l.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {l.amount >= 0 ? '+' : ''}₹{(l.amount / 100).toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Balance After',
      accessor: 'balance_after',
      render: (l) => <span>₹{(l.balance_after / 100).toFixed(2)}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
    },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Wallet & Offline Reserve Management</h1>
        <p>Allocate funds to cryptographically signed offline certificates with ledger integrity.</p>
      </div>

      <ErrorMessage error={error} onRetry={loadWalletData} />

      {message && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid-3" style={{ marginBottom: '1.75rem' }}>
        <BalanceCard
          title="Total Balance"
          amountPaise={wallet?.total_balance || 0}
          subtitle="Authoritative server ledger balance"
          icon={Wallet}
        />
        <BalanceCard
          title="Available Balance"
          amountPaise={wallet?.available_balance || 0}
          subtitle="Funds available to lock into reserves"
          icon={PlusCircle}
        />
        <BalanceCard
          title="Reserved Balance"
          amountPaise={wallet?.reserved_balance || 0}
          subtitle="Secured offline allowances"
          icon={Lock}
        />
      </div>

      {user?.role === 'customer' && (
        <div className="card" style={{ marginBottom: '1.75rem' }}>
          <div className="card-header">
            <span className="card-title">Add Money (Simulated Demo Funding)</span>
            <PlusCircle size={20} color="var(--accent)" />
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Development-only demo funds. This increases your wallet balance and available balance,
            but does not change your offline reserve.
          </p>
          <form onSubmit={handleAddDemoFunds}>
            <div className="form-group">
              <label className="form-label">Amount in INR (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                placeholder="e.g. 500"
                value={demoFundingInput}
                onChange={(e) => setDemoFundingInput(e.target.value)}
                disabled={funding || !isOnline}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={funding || !isOnline}
            >
              {funding ? 'Adding demo funds...' : 'Add Money'}
            </button>
          </form>
        </div>
      )}

      {/* Add Reserve & Risk Tier */}
      <div className="grid-2" style={{ marginBottom: '1.75rem' }}>
        {/* Add to Reserve Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Add to Offline Reserve</span>
            <Lock size={20} color="var(--primary)" />
          </div>

          <form onSubmit={handleCreateReserve}>
            <div className="form-group">
              <label className="form-label">Amount in INR (₹)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                className="form-control"
                placeholder="e.g. 500"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={submitting || !isOnline}
                required
              />
              <div className="form-helper">
                {amountInput && !isNaN(parseFloat(amountInput))
                  ? `Equivalent to ${(parseFloat(amountInput) * 100).toLocaleString()} paise`
                  : 'Enter amount to lock into digitally signed allowance certificate'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Binding Device</label>
              <input
                type="text"
                className="form-control"
                value={device ? `${device.device_name || 'Browser'} (${device.device_id.slice(0, 16)}...)` : 'No Device Registered'}
                disabled
              />
              <div className="form-helper">
                The allowance certificate will be cryptographically bound to this device public key.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting || !isOnline || !isRegistered}
            >
              {submitting ? 'Signing Certificate...' : 'Lock Amount & Issue Certificate'}
            </button>
            {!isOnline && (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
                Offline: Must connect to bank server to lock reserve and issue certificate.
              </div>
            )}
          </form>
        </div>

        {/* Risk Limits Information */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Risk Configuration & Policy</span>
            <ShieldCheck size={20} color="var(--accent)" />
          </div>

          {riskLimit ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {riskLimit.risk_tier.name}
                </span>
                <span className="badge badge-settled">Evaluated Tier</span>
              </div>
              <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                {riskLimit.explanation}
              </p>

              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Max Offline Reserve Limit:</span>
                  <strong>₹{(riskLimit.risk_tier.max_reserve_amount / 100).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Max Per-Payment Limit:</span>
                  <strong>₹{(riskLimit.risk_tier.max_per_payment_limit / 100).toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Limits are enforced on both the client (during offline token creation & verification) and by the server during settlement.
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem' }}>Connect to backend to retrieve risk tier limits.</p>
          )}
        </div>
      </div>

      {/* Reserves History Table */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <span className="card-title">Allowance Certificates & Reserves</span>
        </div>
        <DataTable columns={reservesColumns} data={reserves} emptyMessage="No reserves created yet." />
      </div>

      {/* Immutable Financial Ledger Movements */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Immutable Financial Ledger Movements</span>
        </div>
        <DataTable columns={ledgerColumns} data={ledger} emptyMessage="No ledger entries found." />
      </div>
    </div>
  );
}
