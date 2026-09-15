import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole, Mail, ShieldCheck, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WorkerLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.success) navigate('/worker/dashboard', { replace: true });
    else setError(res.error ?? 'Login failed');
  };

  const fillDemo = () => {
    setEmail('w1024@hydronexus.io');
    setPassword('worker@1234');
  };

  return (
    <div className="wk-login">
      <div className="wk-login-card">
        <div className="wk-login-logo">
          <div className="wk-login-logo-icon"><Wind size={30} color="#fff" /></div>
        </div>
        <h1 className="wk-login-title">H₂S Dosimeter</h1>
        <p className="wk-login-sub">Worker sign in · Passive exposure band</p>

        <form onSubmit={submit} className="wk-form">
          <label className="form-label">Work email</label>
          <div className="wk-input-wrap">
            <Mail size={17} className="wk-input-icon" />
            <input
              className="form-input"
              type="email"
              required
              autoComplete="username"
              placeholder="w1024@hydronexus.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <label className="form-label" style={{ marginTop: 14 }}>Password</label>
          <div className="wk-input-wrap">
            <LockKeyhole size={17} className="wk-input-icon" />
            <input
              className="form-input"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

          <button className="btn btn-primary wk-login-btn" disabled={busy} type="submit">
            {busy ? <Loader2 size={18} className="wk-spin" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button className="wk-demo-fill" onClick={fillDemo} type="button">
          <ShieldCheck size={15} /> Use demo worker credentials
        </button>

        <p className="wk-login-alt">
          Administrator? <Link to="/login">Open admin dashboard</Link>
        </p>
      </div>
    </div>
  );
}
