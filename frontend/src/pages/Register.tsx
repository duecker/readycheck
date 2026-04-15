import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ teamName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.post('/api/auth/register', form);
      login(data.token, data.user, data.teamId, data.teamName);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="page-center">
      <div className="page-container">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A56DB' }}>ReadyCheck</span>
          <p style={{ marginTop: '0.5rem' }}>Start your 30-day pilot</p>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Contact Center / Team Name</label>
              <input placeholder="e.g. Acme BPO — Team Phoenix" value={form.teamName} onChange={set('teamName')} required />
            </div>
            <div className="form-group">
              <label>Your Name</label>
              <input placeholder="Your full name" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label>Work Email</label>
              <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="Choose a strong password" value={form.password} onChange={set('password')} required minLength={8} />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}
            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account — Start Pilot'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#9CA3AF' }}>
            By registering you agree to our terms. Pilot fee invoiced separately.
          </p>
          <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Already registered? <Link to="/login" style={{ color: '#1A56DB' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
