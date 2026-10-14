import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogIn, Key, UserCheck, AlertCircle } from 'lucide-react';
import { apiService } from '../api/client';

export function Login() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        await apiService.register({
          full_name: fullName,
          username,
          email,
          password,
          confirm_password: confirmPassword,
        });
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
        setSuccess('Account created. You can now sign in.');
        return;
      }
      const user = await login(username, password);
      if (user.role === 'analyst') {
        navigate('/analyst');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (uname, pwd) => {
    setUsername(uname);
    setPassword(pwd);
    setError('');
    setLoading(true);
    login(uname, pwd)
      .then((user) => {
        if (user.role === 'analyst') {
          navigate('/analyst');
        } else {
          navigate('/dashboard');
        }
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Quick login failed');
        setLoading(false);
      });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        padding: '1.5rem',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '0.75rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={36} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)' }}>
            OfflinePay
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Offline Payment System with Cryptographic Double-Spend Protection
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ boxShadow: 'var(--shadow-md)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <LogIn size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {isRegistering ? 'Create your customer account' : 'Sign in to your wallet'}
            </h2>
            </div>

            {success && (
              <div className="alert alert-success" style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                <span>{success}</span>
              </div>
            )}
            {error && (
            <div className="alert alert-danger" style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegistering && (
              <>
                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. customer1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {isRegistering && (
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isRegistering && (
              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (isRegistering ? 'Creating account...' : 'Signing in...') : (isRegistering ? 'Create account' : 'Sign In')}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccess('');
            }}
            className="btn btn-link"
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            {isRegistering ? 'Already have an account? Sign in' : 'Create account'}
          </button>

          {/* Quick Demo Logins */}
          {!isRegistering && <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Try a demo account
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.65rem' }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('customer1', 'DemoPass123!')}
                className="btn btn-sm btn-outline"
                style={{ justifyContent: 'flex-start' }}
              >
                <UserCheck size={14} color="var(--accent)" />
                <span>Customer 1</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('customer2', 'DemoPass123!')}
                className="btn btn-sm btn-outline"
                style={{ justifyContent: 'flex-start' }}
              >
                <UserCheck size={14} color="var(--accent)" />
                <span>Customer 2</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('merchant', 'DemoPass123!')}
                className="btn btn-sm btn-outline"
                style={{ justifyContent: 'flex-start' }}
              >
                <Key size={14} color="var(--success)" />
                <span>Merchant</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('analyst', 'DemoPass123!')}
                className="btn btn-sm btn-outline"
                style={{ justifyContent: 'flex-start' }}
              >
                <ShieldCheck size={14} color="var(--danger)" />
                <span>Analyst</span>
              </button>
            </div>
          </div>}
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)' }}>
          Demo password for every account: <code className="font-mono">DemoPass123!</code>
        </div>
      </div>
    </div>
  );
}
