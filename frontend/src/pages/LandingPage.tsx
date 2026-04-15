import { Link } from 'react-router-dom';
import { Mic, CheckCircle, Zap } from 'lucide-react';

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Nav */}
      <nav className="nav">
        <span className="nav-logo">ReadyCheck</span>
        <div className="nav-links">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Start Free Pilot</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', background: 'linear-gradient(180deg, #EFF6FF 0%, #fff 100%)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#DBEAFE', color: '#1A56DB', borderRadius: 999, padding: '0.375rem 1rem', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            <Zap size={14} /> Pre-shift audio readiness for contact centers
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#111827', marginBottom: '1.25rem', lineHeight: 1.15 }}>
            Catch audio problems<br />before the first call
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#6B7280', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            A 90-second browser check that detects bad audio, tells your agents exactly what's wrong, 
            walks them through fixing it, and certifies them ready — before any customer hears them.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary btn-lg">Start 30-Day Pilot — $2,500</Link>
            <Link to="/check?demo=1" className="btn btn-secondary btn-lg">
              <Mic size={18} /> Try the Agent Check
            </Link>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#9CA3AF' }}>
            No install required · Any CCaaS platform · Deploys in 2 days
          </p>
        </div>
      </section>

      {/* Problem statement */}
      <section style={{ padding: '4rem 1.5rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
            Your supervisors find out about audio problems from customers.
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#6B7280', marginBottom: '3rem', maxWidth: 620, margin: '0 auto 3rem' }}>
            By then it's too late — the call went badly, CSAT took a hit, maybe it escalated. 
            No existing tool catches bad agent audio <em>before</em> the first interaction.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {[
              { stat: '~10%', label: 'of remote agents start shifts with a diagnosable audio issue' },
              { stat: '$4,500', label: 'estimated monthly cost per 100 agents from audio problems' },
              { stat: '90 sec', label: "total time for a passing ReadyCheck — less than a coffee run" },
            ].map((item) => (
              <div key={item.stat} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1A56DB', marginBottom: '0.5rem' }}>{item.stat}</div>
                <p style={{ fontSize: '0.9rem' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>How ReadyCheck works</h2>
          <p style={{ textAlign: 'center', marginBottom: '3rem' }}>Agent opens a URL. 90 seconds later, they're certified ready.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            {[
              { icon: <Mic size={28} color="#1A56DB" />, title: 'Agent speaks a phrase', desc: 'No install. Agent opens a link, grants mic permission, and reads a short phrase to our AI.' },
              { icon: <Zap size={28} color="#1A56DB" />, title: 'AI scores the audio', desc: 'We detect low volume, clipping, background noise, echo, wrong mic, and Bluetooth quality issues in real time.' },
              { icon: <CheckCircle size={28} color="#057A55" />, title: 'Pass or guided fix', desc: 'Pass → certified ready. Fail → step-by-step instructions for the specific issue, then retest.' },
            ].map((item) => (
              <div key={item.title} style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, background: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  {item.icon}
                </div>
                <h3 style={{ marginBottom: '0.5rem' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9rem' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supervisor dashboard callout */}
      <section style={{ padding: '4rem 1.5rem', background: '#1A56DB', color: 'white' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Supervisors see team readiness in real time</h2>
            <p style={{ color: '#BFDBFE', marginBottom: '1.5rem' }}>
              At shift start, supervisors see exactly who is ready, who has an advisory, 
              and who failed — with the specific issue type. No guesswork. No reactive firefighting.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {['Real-time team readiness dashboard', 'Failed agent queue with issue type', 'Per-agent 30-day history', 'Compliance reporting and CSV export', 'Audit log for QA and client reporting'].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E0F2FE', fontSize: '0.95rem' }}>
                  <CheckCircle size={16} color="#34D399" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'white', fontWeight: 600 }}>Team Readiness — Today</span>
              <span style={{ color: '#93C5FD', fontSize: '0.85rem' }}>Live</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              {[{ n: 18, l: 'Ready', c: '#34D399' }, { n: 3, l: 'Advisory', c: '#FCD34D' }, { n: 2, l: 'Failed', c: '#F87171' }, { n: 1, l: 'Not Started', c: '#9CA3AF' }].map(s => (
                <div key={s.l} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center' }}>
              2 agents need attention before first call
            </div>
          </div>
        </div>
      </section>

      {/* Pilot offer */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Start with a 30-day paid pilot</h2>
          <p style={{ marginBottom: '2.5rem', fontSize: '1.05rem' }}>
            $2,500 flat for up to 100 agents. Deploys in 2 days. Includes setup, 
            supervisor training, and a 30-day readiness report.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: '2rem' }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                'Full platform access for 30 days',
                'Agent check flow + supervisor dashboard',
                'Onboard in 2 business days — no IT deployment',
                '30-day readiness report delivered at end of pilot',
                'Full refund if no audio issue detected and resolved in 30 days',
                'Converts to $5/agent/month if pilot succeeds'
              ].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.95rem', color: '#374151' }}>
                  <CheckCircle size={18} color="#057A55" style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/register" className="btn btn-primary btn-lg btn-full">Start Your Pilot</Link>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#9CA3AF' }}>
            Questions? Email <a href="mailto:detlefue@gmail.com" style={{ color: '#1A56DB' }}>detlefue@gmail.com</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '2rem 1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
          © 2026 ReadyCheck · Pre-shift audio readiness for contact centers · 
          <a href="mailto:detlefue@gmail.com" style={{ color: '#1A56DB', marginLeft: '0.5rem' }}>Contact us</a>
        </p>
      </footer>
    </div>
  );
}
