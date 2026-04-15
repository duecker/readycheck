import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, Clock, Download, RefreshCw, Users, Settings } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface AgentStatus {
  id: string; name: string; email: string;
  session_id?: string; final_result?: string; primary_issue?: string;
  completed_at?: string; attempt_count?: number; escalated?: boolean;
}
interface Summary { ready: number; advisory: number; notReady: number; notStarted: number; total: number; }

function StatusBadge({ result }: { result?: string }) {
  if (!result) return <span className="badge badge-pending"><Clock size={11} /> NOT STARTED</span>;
  if (result === 'pass') return <span className="badge badge-pass"><CheckCircle size={11} /> READY</span>;
  if (result === 'warn') return <span className="badge badge-warn"><AlertTriangle size={11} /> ADVISORY</span>;
  return <span className="badge badge-fail"><XCircle size={11} /> NOT READY</span>;
}

function issueName(code?: string) {
  const map: Record<string, string> = {
    low_volume: 'Low Volume', clipping: 'Clipping/Distortion',
    background_noise: 'Background Noise', echo: 'Echo',
    wrong_mic: 'Wrong Mic', bluetooth_quality: 'Bluetooth Issue', dropout: 'Dropouts'
  };
  return code ? (map[code] || code) : '—';
}

export function Dashboard() {
  const { teamName, logout } = useAuth();
  const [data, setData] = useState<{ summary: Summary; agents: AgentStatus[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (date: string) => {
    setRefreshing(true);
    try {
      const result = await api.get(`/api/dashboard/team?date=${date}`);
      setData(result);
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(selectedDate); }, [selectedDate]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => load(selectedDate), 60000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Name', 'Email', 'Status', 'Issue', 'Time', 'Attempts', 'Escalated']];
    data.agents.forEach(a => rows.push([
      a.name, a.email, a.final_result || 'not_started', issueName(a.primary_issue),
      a.completed_at ? new Date(a.completed_at).toLocaleTimeString() : '',
      String(a.attempt_count || 0), a.escalated ? 'Yes' : 'No'
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `readycheck-${selectedDate}.csv`; a.click();
  };

  const filteredAgents = data?.agents.filter(a => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'not_started') return !a.final_result;
    return a.final_result === filterStatus;
  }) || [];

  if (loading) return (
    <div className="page-center">
      <div style={{ textAlign: 'center' }}>
        <RefreshCw size={28} color="#1A56DB" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem' }}>Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <nav className="nav">
        <span className="nav-logo">ReadyCheck</span>
        <div style={{ fontWeight: 500, color: '#374151', flex: 1, textAlign: 'center' }}>
          {teamName} — Team Dashboard
        </div>
        <div className="nav-links">
          <Link to="/admin" className="btn btn-ghost btn-sm"><Settings size={15} /> Admin</Link>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <div className="page-container-wide" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ color: '#111827' }}>Team Readiness</h2>
            <p style={{ fontSize: '0.875rem' }}>
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ width: 'auto' }} />
            <button className="btn btn-ghost btn-sm" onClick={() => load(selectedDate)} disabled={refreshing}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="summary-cards">
            <div className="summary-card" style={{ borderTop: '3px solid #057A55' }}>
              <div className="count" style={{ color: '#057A55' }}>{data.summary.ready}</div>
              <div className="label">Ready</div>
            </div>
            <div className="summary-card" style={{ borderTop: '3px solid #B45309' }}>
              <div className="count" style={{ color: '#B45309' }}>{data.summary.advisory}</div>
              <div className="label">Advisory</div>
            </div>
            <div className="summary-card" style={{ borderTop: '3px solid #C81E1E' }}>
              <div className="count" style={{ color: '#C81E1E' }}>{data.summary.notReady}</div>
              <div className="label">Not Ready</div>
            </div>
            <div className="summary-card" style={{ borderTop: '3px solid #9CA3AF' }}>
              <div className="count" style={{ color: '#9CA3AF' }}>{data.summary.notStarted}</div>
              <div className="label">Not Started</div>
            </div>
          </div>
        )}

        {/* Needs attention banner */}
        {data && (data.summary.notReady + data.summary.notStarted) > 0 && (
          <div style={{ background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 8, padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <AlertTriangle size={20} color="#C81E1E" />
            <span style={{ color: '#C81E1E', fontWeight: 500 }}>
              {data.summary.notReady} agent{data.summary.notReady !== 1 ? 's' : ''} failed their check
              {data.summary.notStarted > 0 ? `, ${data.summary.notStarted} haven't started` : ''}.
              Contact them before they go on queue.
            </span>
          </div>
        )}

        {/* Agent table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table filters */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Users size={16} color="#6B7280" />
            <span style={{ fontWeight: 600, marginRight: '1rem', fontSize: '0.9rem' }}>{data?.summary.total} agents</span>
            {['all', 'pass', 'warn', 'fail', 'not_started'].map(s => (
              <button key={s} className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setFilterStatus(s)}>
                {s === 'all' ? 'All' : s === 'not_started' ? 'Not Started' : s === 'pass' ? 'Ready' : s === 'warn' ? 'Advisory' : 'Failed'}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Issue</th>
                  <th>Time</th>
                  <th>Attempts</th>
                  <th>Escalated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem' }}>No agents match this filter.</td></tr>
                ) : filteredAgents.map(agent => (
                  <tr key={agent.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{agent.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{agent.email}</div>
                    </td>
                    <td><StatusBadge result={agent.final_result} /></td>
                    <td style={{ fontSize: '0.875rem', color: agent.primary_issue ? '#374151' : '#9CA3AF' }}>
                      {issueName(agent.primary_issue)}
                    </td>
                    <td style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                      {agent.completed_at ? new Date(agent.completed_at).toLocaleTimeString() : '—'}
                    </td>
                    <td style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                      {agent.attempt_count || 0}
                    </td>
                    <td>
                      {agent.escalated && <span style={{ fontSize: '0.8rem', color: '#C81E1E', fontWeight: 600 }}>⚠ Escalated</span>}
                    </td>
                    <td>
                      <Link to={`/dashboard/agent/${agent.id}`} className="btn btn-ghost btn-sm">
                        History
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
