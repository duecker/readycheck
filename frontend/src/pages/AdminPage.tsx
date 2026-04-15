import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Upload, Copy, ExternalLink, Settings, ChevronLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Agent { id: string; name: string; email: string; created_at: string; }

export function AdminPage() {
  const { teamName } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [, setTeam] = useState<any>(null);
  const [newAgent, setNewAgent] = useState({ name: '', email: '' });
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [agentLinks, setAgentLinks] = useState<Record<string, string>>({});
  const [itContact, setItContact] = useState('');
  const [supervisorContact, setSupervisorContact] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    api.get('/api/admin/agents').then(d => setAgents(d.agents));
    api.get('/api/admin/team').then(d => {
      setTeam(d.team);
      setItContact(d.team.it_contact || '');
      setSupervisorContact(d.team.supervisor_contact || '');
    });
  }, []);

  const inviteAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.post('/api/admin/agents', newAgent);
      setAgents(prev => [...prev, data.agent]);
      setAgentLinks(prev => ({ ...prev, [data.agent.id]: window.location.origin + data.checkUrl }));
      setNewAgent({ name: '', email: '' });
      setSuccess(`Invited ${data.agent.name}. Copy their check link below.`);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const importCsv = async () => {
    setError(''); setLoading(true);
    try {
      const lines = csvText.trim().split('\n').slice(1); // Skip header
      const agentList = lines.map(l => {
        const parts = l.split(',');
        return { name: parts[0]?.trim().replace(/"/g, ''), email: parts[1]?.trim().replace(/"/g, '') };
      }).filter(a => a.name && a.email);

      const data = await api.post('/api/admin/agents/import', { agents: agentList });
      setSuccess(`Imported: ${data.created} agents added, ${data.skipped} skipped.`);
      const refresh = await api.get('/api/admin/agents');
      setAgents(refresh.agents);
      setCsvText('');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const getLink = async (agentId: string) => {
    const data = await api.get(`/api/admin/agent-link/${agentId}`);
    const url = window.location.origin + data.checkUrl;
    setAgentLinks(prev => ({ ...prev, [agentId]: url }));
    return url;
  };

  const copyLink = async (agentId: string) => {
    const url = agentLinks[agentId] || await getLink(agentId);
    await navigator.clipboard.writeText(url);
    setCopiedLink(agentId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await api.patch('/api/admin/team', { itContact, supervisorContact });
    setSavingSettings(false);
    setSuccess('Settings saved.');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <nav className="nav">
        <span className="nav-logo">ReadyCheck</span>
        <div style={{ flex: 1, paddingLeft: '1rem', color: '#374151', fontWeight: 500 }}>{teamName} — Admin</div>
        <div className="nav-links">
          <Link to="/dashboard" className="btn btn-ghost btn-sm"><ChevronLeft size={15} /> Dashboard</Link>
        </div>
      </nav>

      <div className="page-container-wide" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {error && <div style={{ background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1rem', color: '#C81E1E' }}>{error}</div>}
        {success && <div style={{ background: '#F0FFF8', border: '1px solid #A7F3D0', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1rem', color: '#057A55' }}>{success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Invite single agent */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}><UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Invite an Agent</h3>
              <form onSubmit={inviteAgent}>
                <div className="form-group">
                  <label>Agent Name</label>
                  <input placeholder="Full name" value={newAgent.name} onChange={e => setNewAgent(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" placeholder="agent@company.com" value={newAgent.email} onChange={e => setNewAgent(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Agent & Get Link'}
                </button>
              </form>
            </div>

            {/* CSV import */}
            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}><Upload size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Bulk Import (CSV)</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Paste CSV with header: Name,Email</p>
              <textarea
                placeholder={'Name,Email\nJane Smith,jane@company.com\nJohn Doe,john@company.com'}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={6}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: 8, resize: 'vertical' }}
              />
              <button className="btn btn-secondary btn-full" style={{ marginTop: '0.75rem' }} onClick={importCsv} disabled={loading || !csvText.trim()}>
                {loading ? 'Importing...' : 'Import Agents'}
              </button>
            </div>

            {/* Settings */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}><Settings size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Team Settings</h3>
              <div className="form-group">
                <label>IT Contact (shown to agents on escalation)</label>
                <input placeholder="e.g. IT Support: itsupport@company.com or ext. 4567"
                  value={itContact} onChange={e => setItContact(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Supervisor Contact (shown to agents on escalation)</label>
                <input placeholder="e.g. Contact your supervisor via Teams or ext. 1234"
                  value={supervisorContact} onChange={e => setSupervisorContact(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-full" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Right column — agent list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #E5E7EB' }}>
              <h3>Agents ({agents.length})</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Copy each agent's check link and send it to them via email or chat.</p>
            </div>
            {agents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>No agents yet. Add one above.</div>
            ) : (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {agents.map(agent => (
                  <div key={agent.id} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{agent.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{agent.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => copyLink(agent.id)}
                        title="Copy check link">
                        {copiedLink === agent.id ? <span style={{ fontSize: '0.8rem', color: '#057A55' }}>Copied!</span> : <><Copy size={14} /> Link</>}
                      </button>
                      {agentLinks[agent.id] && (
                        <a href={agentLinks[agent.id]} target="_blank" rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm" title="Open check">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
