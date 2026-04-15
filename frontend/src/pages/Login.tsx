import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.post('/api/auth/login', { email, password });
      login(data.token, data.user, data.teamId, data.teamName);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="page-center">
      <div className="page-container">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A56DB' }}>ReadyCheck</span>
          <p style={{ marginTop: '0.5rem' }}>Sign in to your supervisor dashboard</p>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem' }}>
            No account? <Link to="/register" style={{ color: '#1A56DB' }}>Start a free pilot</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
