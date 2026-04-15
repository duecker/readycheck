import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, CheckCircle, AlertTriangle, XCircle, Volume2, Loader } from 'lucide-react';
import { analyzeAudio } from '../lib/audioScoring';
import type { ScoringResult, IssueCode } from '../lib/audioScoring';
import { api } from '../lib/api';
import { remediationContent } from '../lib/remediationContent';

type FlowState =
  | 'loading'
  | 'already_passed'
  | 'landing'
  | 'permission'
  | 'device_confirm'
  | 'prompt_play'
  | 'recording'
  | 'processing'
  | 'pass'
  | 'warn'
  | 'fail'
  | 'remediation'
  | 'escalation'
  | 'error_permission'
  | 'error_no_device'
  | 'error_browser'
  | 'error_generic';

const STEP_COUNT = 4;
const RECORD_SECONDS = 6;
const MAX_ATTEMPTS = 3;
const TEST_PHRASE = 'The quick brown fox jumps over the lazy dog';

function ProgressSteps({ step }: { step: number }) {
  return (
    <div className="progress-steps">
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <div key={i} className={`progress-step ${i < step ? 'done' : i === step ? 'active' : ''}`} />
      ))}
    </div>
  );
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A56DB' }}>ReadyCheck</span>
    </div>
  );
}

export function CheckFlow() {
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [agentInfo, setAgentInfo] = useState<{ name: string; id: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ it?: string; supervisor?: string }>({});
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string>('');
  const [meterLevel, setMeterLevel] = useState(0);
  const [recordCountdown, setRecordCountdown] = useState(RECORD_SECONDS);
  const [isDemo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Initialize: resolve agent from token
  useEffect(() => {
    if (isDemo) {
      setAgentInfo({ name: 'Demo Agent', id: 'demo' });
      setFlowState('landing');
      return;
    }
    if (!token) { setFlowState('error_browser'); return; }

    api.post('/api/sessions/start', {
      token,
      deviceOs: navigator.platform || 'unknown',
      browser: navigator.userAgent.substring(0, 100),
      deviceLabel: ''
    }).then(data => {
      if (data.alreadyPassed) {
        setSessionId(data.session.id);
        setAgentInfo(data.agent);
        setContacts(data.contacts || {});
        setFlowState('already_passed');
      } else {
        setSessionId(data.session.id);
        setAgentInfo(data.agent);
        setContacts(data.contacts || {});
        setFlowState('landing');
      }
    }).catch(() => setFlowState('landing'));
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const requestMic = useCallback(async () => {
    setFlowState('permission');
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        setFlowState('error_browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
      });
      streamRef.current = stream;
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);

      // Set selected device info
      const activeTrack = stream.getAudioTracks()[0];
      const label = activeTrack?.label || '';
      setSelectedDeviceLabel(label);
      setSelectedDevice(activeTrack?.getSettings().deviceId || '');
      setFlowState('device_confirm');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setFlowState('error_permission');
      else if (err.name === 'NotFoundError') setFlowState('error_no_device');
      else { setError(err.message); setFlowState('error_generic'); }
    }
  }, [selectedDevice]);

  const switchDevice = useCallback(async (deviceId: string) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
    streamRef.current = stream;
    const label = stream.getAudioTracks()[0]?.label || '';
    setSelectedDevice(deviceId);
    setSelectedDeviceLabel(label);
  }, []);

  const startAudioMeter = useCallback(() => {
    if (!streamRef.current) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(streamRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setMeterLevel(avg / 128);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const playPrompt = useCallback(() => {
    setFlowState('prompt_play');
    const utterance = new SpeechSynthesisUtterance(`Please say the following phrase clearly: ${TEST_PHRASE}`);
    utterance.rate = 0.9;
    utterance.onend = () => {
      setTimeout(() => startRecording(), 300);
    };
    utterance.onerror = () => startRecording(); // Fall back silently
    window.speechSynthesis.speak(utterance);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    setFlowState('recording');
    setRecordCountdown(RECORD_SECONDS);
    startAudioMeter();
    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm;codecs=opus' });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => processRecording();
    recorderRef.current = recorder;
    recorder.start();

    let count = RECORD_SECONDS;
    const timer = setInterval(() => {
      count--;
      setRecordCountdown(count);
      if (count <= 0) { clearInterval(timer); recorder.stop(); cancelAnimationFrame(animFrameRef.current); }
    }, 1000);
  }, []);

  const processRecording = useCallback(async () => {
    setFlowState('processing');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const result = await analyzeAudio(audioBuffer, selectedDeviceLabel);
      setScoringResult(result);

      const newAttempt = attemptCount + 1;
      setAttemptCount(newAttempt);

      // Log attempt to server
      if (sessionId && !isDemo) {
        await api.post(`/api/sessions/${sessionId}/attempt`, {
          token,
          result: result.result,
          issueCode: result.issueCode,
          rmsScore: result.scores.rmsDb,
          clippingScore: result.scores.clippingRate,
          noiseScore: result.scores.noiseFloorDb,
          echoScore: result.scores.echoScore
        });
      }

      if (result.result === 'pass') {
        await completeSession('pass', null, false);
        setFlowState('pass');
      } else if (result.result === 'warn') {
        setFlowState('warn');
      } else {
        if (newAttempt >= MAX_ATTEMPTS) {
          await completeSession('fail', result.issueCode, false);
          setFlowState('fail');
        } else {
          setFlowState('fail');
        }
      }
    } catch (err: any) {
      setError(err.message);
      setFlowState('error_generic');
    }
  }, [selectedDeviceLabel, attemptCount, sessionId, token]);

  const completeSession = useCallback(async (result: string, issue: IssueCode, escalated: boolean) => {
    if (sessionId && !isDemo) {
      await api.post(`/api/sessions/${sessionId}/complete`, {
        token, finalResult: result, primaryIssue: issue, escalated
      }).catch(() => {});
    }
  }, [sessionId, token]);

  const retest = useCallback(() => {
    setScoringResult(null);
    playPrompt();
  }, [playPrompt]);

  const escalate = useCallback(async () => {
    await completeSession('fail', scoringResult?.issueCode || null, true);
    if (sessionId && !isDemo) await api.post(`/api/sessions/${sessionId}/escalate`, { token }).catch(() => {});
    setFlowState('escalation');
  }, [scoringResult, sessionId, token]);

  // ─── Render states ───────────────────────────────────────────────────

  if (flowState === 'loading') {
    return (
      <div className="page-center">
        <div style={{ textAlign: 'center' }}>
          <Loader size={32} color="#1A56DB" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '1rem' }}>Loading your check...</p>
        </div>
      </div>
    );
  }

  // Already passed today
  if (flowState === 'already_passed') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <div className="card" style={{ textAlign: 'center' }}>
            <CheckCircle size={56} color="#057A55" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ color: '#057A55', marginBottom: '0.5rem' }}>Already checked today</h2>
            <p style={{ marginBottom: '1.5rem' }}>You already passed your audio check for today's shift.</p>
            <div className="badge badge-pass" style={{ margin: '0 auto 1.5rem' }}>PASS</div>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Your supervisor can see your ready status on their dashboard.</p>
            <button className="btn btn-ghost btn-sm btn-full" onClick={() => setFlowState('landing')}>
              Recheck if needed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Landing
  if (flowState === 'landing') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={0} />
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, background: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Mic size={36} color="#1A56DB" />
            </div>
            <h1 style={{ marginBottom: '0.5rem' }}>Pre-Shift Audio Check</h1>
            {agentInfo && <p style={{ marginBottom: '0.5rem', color: '#374151', fontWeight: 500 }}>Hello, {agentInfo.name}</p>}
            <p style={{ marginBottom: '2rem' }}>Takes about 90 seconds. Let's make sure your audio is ready before your first call.</p>
            <button className="btn btn-primary btn-lg btn-full" onClick={requestMic}>
              Start Audio Check
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#9CA3AF' }}>
              Your audio is analyzed locally. No recordings are stored.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Permission loading
  if (flowState === 'permission') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={1} />
          <div className="card" style={{ textAlign: 'center' }}>
            <Loader size={48} color="#1A56DB" style={{ margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
            <h2>Requesting microphone access...</h2>
            <p style={{ marginTop: '0.75rem' }}>Click <strong>Allow</strong> when your browser asks for permission.</p>
          </div>
        </div>
      </div>
    );
  }

  // Device confirm
  if (flowState === 'device_confirm') {
    const isLaptopMic = selectedDeviceLabel.toLowerCase().match(/internal|built-in|laptop|macbook|integrated/);
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={1} />
          <div className="card">
            <h2 style={{ marginBottom: '0.5rem' }}>Confirm your microphone</h2>
            <p style={{ marginBottom: '1.5rem' }}>Make sure your headset is selected, not your laptop's built-in mic.</p>

            {isLaptopMic && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                <AlertTriangle size={20} color="#B45309" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: '#B45309', display: 'block', marginBottom: '0.25rem' }}>This looks like your laptop mic</strong>
                  <span style={{ fontSize: '0.875rem', color: '#92400E' }}>Laptop microphones pick up too much background noise for customer calls. Select your headset below.</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Selected microphone</label>
              <select value={selectedDevice} onChange={e => {
                const device = devices.find(d => d.deviceId === e.target.value);
                setSelectedDeviceLabel(device?.label || '');
                switchDevice(e.target.value);
              }}>
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary btn-lg btn-full" onClick={playPrompt}>
              This is my headset — Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AI prompt playing
  if (flowState === 'prompt_play') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={2} />
          <div className="card" style={{ textAlign: 'center' }}>
            <Volume2 size={48} color="#1A56DB" style={{ margin: '0 auto 1.25rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <h2 style={{ marginBottom: '0.5rem' }}>Listen, then repeat</h2>
            <p style={{ marginBottom: '1.5rem' }}>The AI is reading the phrase. Then say it clearly into your microphone.</p>
            <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '1rem 1.5rem', fontSize: '1.1rem', fontWeight: 500, color: '#1e40af', letterSpacing: '0.01em' }}>
              "{TEST_PHRASE}"
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#9CA3AF' }}>Recording starts automatically after the prompt</p>
          </div>
        </div>
      </div>
    );
  }

  // Recording
  if (flowState === 'recording') {
    const bars = 20;
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={2} />
          <div className="card" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Say the phrase now</h2>
            <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 500, color: '#1e40af', marginBottom: '1.5rem' }}>
              "{TEST_PHRASE}"
            </div>

            {/* Audio meter */}
            <div className="audio-meter" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
              {Array.from({ length: bars }, (_, i) => {
                const threshold = (i / bars);
                const isActive = meterLevel > threshold;
                const isHigh = meterLevel > 0.85 && isActive;
                return (
                  <div key={i} className={`audio-meter-bar ${isActive ? (isHigh ? 'high' : 'active') : ''}`}
                    style={{ height: `${8 + i * 1.8}px` }} />
                );
              })}
            </div>

            <div style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '0.75rem' }}>
              {meterLevel < 0.05 ? '🔇 No sound detected — check your mute switch' :
               meterLevel > 0.9 ? '⚠️ Too loud — move mic away slightly' :
               '🎤 Good level — keep talking'}
            </div>

            {/* Countdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <div style={{ width: `${(recordCountdown / RECORD_SECONDS) * 100}%`, height: 6, background: '#1A56DB', borderRadius: 3, transition: 'width 0.9s linear', maxWidth: 240 }} />
              <span style={{ fontSize: '0.875rem', color: '#6B7280', minWidth: 40 }}>{recordCountdown}s</span>
            </div>

            {attemptCount > 0 && (
              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#9CA3AF' }}>Attempt {attemptCount + 1} of {MAX_ATTEMPTS}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Processing
  if (flowState === 'processing') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={3} />
          <div className="card" style={{ textAlign: 'center' }}>
            <Loader size={48} color="#1A56DB" style={{ margin: '0 auto 1.25rem', animation: 'spin 1s linear infinite' }} />
            <h2>Analyzing your audio...</h2>
            <p style={{ marginTop: '0.5rem' }}>This takes just a second.</p>
          </div>
        </div>
      </div>
    );
  }

  // Pass
  if (flowState === 'pass') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={STEP_COUNT} />
          <div className="card" style={{ textAlign: 'center', background: '#F0FFF8', border: '1px solid #A7F3D0' }}>
            <CheckCircle size={64} color="#057A55" style={{ margin: '0 auto 1rem' }} />
            <h1 style={{ color: '#057A55', marginBottom: '0.5rem' }}>
              {attemptCount > 1 ? "Fixed! You're ready now." : "You're ready. Have a great shift."}
            </h1>
            <p style={{ marginBottom: '1.5rem' }}>
              {attemptCount > 1 ? "Great work — your audio sounds good now. Your fix has been logged." : "Your audio sounds great. Your supervisor can see you're ready."}
            </p>
            {scoringResult && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#065F46' }}>✓ Volume: Good</span>
                <span style={{ fontSize: '0.8rem', color: '#065F46' }}>✓ Background: Clear</span>
                <span style={{ fontSize: '0.8rem', color: '#065F46' }}>✓ No echo</span>
              </div>
            )}
            <div className="badge badge-pass" style={{ margin: '0 auto 1.5rem', fontSize: '0.9rem', padding: '0.375rem 1.25rem' }}>
              ✓ CERTIFIED READY
            </div>
            <button className="btn btn-primary btn-lg btn-full">
              Done — Start My Shift
            </button>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#6B7280' }}>
              Result recorded at {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Warn
  if (flowState === 'warn') {
    const remediation = scoringResult?.issueCode ? remediationContent[scoringResult.issueCode] : null;
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={STEP_COUNT} />
          <div className="card" style={{ textAlign: 'center', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <AlertTriangle size={56} color="#B45309" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ color: '#B45309', marginBottom: '0.5rem' }}>You can proceed — but there's a note.</h2>
            <p style={{ marginBottom: '1rem' }}>
              {scoringResult?.message || 'Marginal audio quality detected.'}
            </p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Your supervisor has been notified about this advisory.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary btn-lg" onClick={() => { completeSession('warn', scoringResult?.issueCode || null, false); setFlowState('pass'); }}>
                Proceed to My Shift
              </button>
              {remediation && (
                <button className="btn btn-secondary" onClick={() => setFlowState('remediation')}>
                  Try to fix it
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fail
  if (flowState === 'fail') {
    const isLastAttempt = attemptCount >= MAX_ATTEMPTS;
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <ProgressSteps step={2} />
          <div className="card" style={{ textAlign: 'center', background: '#FFF5F5', border: '1px solid #FCA5A5' }}>
            <XCircle size={56} color="#C81E1E" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ color: '#C81E1E', marginBottom: '0.5rem' }}>Let's fix your audio before your shift.</h2>
            <p style={{ fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
              Issue detected: {scoringResult?.issueCode ? remediationContent[scoringResult.issueCode]?.title : 'Audio quality issue'}
            </p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {isLastAttempt
                ? "After multiple attempts we haven't been able to fix this. Let's get you some help."
                : "No worries — this happens. Here's how to fix it. Usually takes 1–2 minutes."
              }
            </p>
            {isLastAttempt ? (
              <button className="btn btn-primary btn-full" onClick={escalate}>
                Get Help from Supervisor / IT
              </button>
            ) : (
              <button className="btn btn-primary btn-lg btn-full" onClick={() => setFlowState('remediation')}>
                Show Me How to Fix This
              </button>
            )}
            <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '0.5rem' }} onClick={retest}>
              Skip — retest anyway ({attemptCount}/{MAX_ATTEMPTS})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Remediation
  if (flowState === 'remediation' && scoringResult?.issueCode) {
    const content = remediationContent[scoringResult.issueCode];
    return (
      <div className="page-center">
        <div className="page-container" style={{ maxWidth: 560 }}>
          <Logo />
          <div className="card">
            <h2 style={{ marginBottom: '0.25rem' }}>{content?.title || 'Fix the issue'}</h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Follow these steps, then click to retest. Attempt {attemptCount} of {MAX_ATTEMPTS}.
            </p>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '2rem' }}>
              {(content?.steps || []).map((step, i) => (
                <li key={i} style={{ color: '#374151', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  <strong style={{ color: '#111827' }}>Step {i + 1}:</strong> {step}
                </li>
              ))}
            </ol>
            <button className="btn btn-primary btn-lg btn-full" onClick={retest}>
              I've made the changes — Test Again
            </button>
            <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '0.5rem' }} onClick={escalate}>
              These steps didn't help — Get assistance
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Escalation
  if (flowState === 'escalation') {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <div className="card" style={{ textAlign: 'center' }}>
            <AlertTriangle size={56} color="#B45309" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ marginBottom: '0.5rem' }}>We weren't able to fix the issue.</h2>
            <p style={{ marginBottom: '1.5rem' }}>Your audio check has not passed after {MAX_ATTEMPTS} attempts. You need help from your supervisor or IT.</p>
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '1.25rem', textAlign: 'left', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.875rem', color: '#111827' }}>What to do now:</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {contacts.supervisor && <li style={{ fontSize: '0.9rem', color: '#374151' }}>📞 Contact your supervisor: <strong>{contacts.supervisor}</strong></li>}
                {contacts.it && <li style={{ fontSize: '0.9rem', color: '#374151' }}>🖥️ Contact IT: <strong>{contacts.it}</strong></li>}
                <li style={{ fontSize: '0.9rem', color: '#374151' }}>🎧 Try connecting a different headset if available</li>
                <li style={{ fontSize: '0.9rem', color: '#374151' }}>📋 Your check history has been logged for your supervisor</li>
              </ul>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Issue escalated and logged at {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  const errorContent = {
    error_permission: {
      title: 'Microphone access blocked',
      body: "Your browser has blocked microphone access. Here's how to allow it:",
      steps: ['Chrome/Edge: Click the lock or camera icon in the address bar → Allow microphone → Reload this page', 'Firefox: Click the lock icon → Permissions → Microphone → Allow → Reload this page']
    },
    error_no_device: {
      title: 'No microphone detected',
      body: "We couldn't find a microphone. Please check that your headset is plugged in.",
      steps: ['Plug in your headset firmly, or reconnect your Bluetooth device', 'Try unplugging and re-plugging the connector', 'Open Windows Sound Settings and check the Input devices list', 'If no device appears, contact IT — your driver may need reinstalling']
    },
    error_browser: {
      title: 'Browser not supported',
      body: 'Please open this check in one of these browsers:',
      steps: ['Google Chrome (recommended)', 'Microsoft Edge', 'Firefox (latest version)']
    },
    error_generic: {
      title: 'Something went wrong',
      body: `${error || 'An unexpected error occurred.'} Please reload the page and try again.`,
      steps: ['Reload this page and try again', 'If the problem persists, contact IT and share this error']
    }
  };

  const ec = errorContent[flowState as keyof typeof errorContent];
  if (ec) {
    return (
      <div className="page-center">
        <div className="page-container">
          <Logo />
          <div className="card" style={{ textAlign: 'center' }}>
            <XCircle size={48} color="#C81E1E" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ marginBottom: '0.5rem' }}>{ec.title}</h2>
            <p style={{ marginBottom: '1.25rem' }}>{ec.body}</p>
            <ul style={{ textAlign: 'left', paddingLeft: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ec.steps.map((s, i) => <li key={i} style={{ fontSize: '0.9rem', color: '#374151' }}>{s}</li>)}
            </ul>
            <button className="btn btn-primary btn-full" onClick={() => { setFlowState('landing'); requestMic(); }}>
              {flowState === 'error_browser' ? 'I\'m using a supported browser — try again' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
