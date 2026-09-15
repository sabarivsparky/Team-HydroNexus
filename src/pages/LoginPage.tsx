// ─── Admin Login Page ──────────────────────────────────────
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, logout, ready } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      // Login stores the user; role is read synchronously from localStorage
      // until context re-renders.
      const raw = localStorage.getItem('hydronexus_user');
      const user = raw ? JSON.parse(raw) : null;
      if (user?.role === 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        logout();
        setError('This is a worker account. Please use the Worker app sign-in.');
      }
    } else {
      setError(result.error ?? 'Login failed.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden="true" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Wind size={26} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              HydroNexus H₂S
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Admin Portal
            </div>
          </div>
        </div>

        <h1 className="login-title">Welcome Back</h1>
        <p className="login-subtitle">Sign in to the exposure monitoring dashboard.</p>

        {error && (
          <div className="form-error" role="alert" aria-live="assertive">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Email Address</label>
            <div className="form-input-wrap">
              <Mail size={16} className="form-input-icon" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="admin@hydronexus.io"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !ready}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password</label>
            <div className="form-input-wrap">
              <Lock size={16} className="form-input-icon" />
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || !ready}
              />
              <button
                type="button"
                className="form-input-toggle"
                onClick={() => setShowPw((p) => !p)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button id="login-submit-btn" type="submit" className="login-btn"
            disabled={loading || !ready}>
            {loading ? (<><span className="spinner" />Authenticating…</>) : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="login-hint">
          <strong>Demo administrator</strong><br />
          Email: <strong>admin@hydronexus.io</strong><br />
          Password: <strong>admin@1234</strong>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.85rem',
                      color: 'var(--color-text-muted)' }}>
          Field worker? <Link to="/worker/login" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
            Open the worker app
          </Link>
        </div>
      </div>
    </div>
  );
}
