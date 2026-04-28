import { useEffect, useState, useRef } from 'react';
import { getAllocations, startDemo, stopDemo, getDemoStatus, predictPrePositioning, compareScenario, SOCKET_URL } from '../services/api';
import { Brain, PackageCheck, AlertCircle, RefreshCw, Camera, Globe, BookOpen, Package, Play, Square, Clock, Radar, Target, ChevronDown, ChevronUp, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { io } from 'socket.io-client';

export default function AdminDashboard() {
  const [data, setData] = useState({ allocations: [], remainingInventory: {} });
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState({ running: false, scenarioName: null, phase: null, eventIndex: 0, totalEvents: 0, hoursFromLandfall: null, compressedDurationMs: 0, startedAt: null });
  const [demoBusy, setDemoBusy] = useState(false);
  const [, setTick] = useState(0);
  const [predictOpen, setPredictOpen] = useState(false);
  const [predictForm, setPredictForm] = useState({
    region: 'Kutch, Gujarat',
    threat: 'Extremely Severe Cyclonic Storm expected to make landfall near Jakhau coast with sustained winds 125-140 km/h and 2-3m storm surge.',
    horizonHours: 72
  });
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState(null);
  const [predictResult, setPredictResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const spokenIdsRef = useRef(new Set());

  // Background Audio Engine Watcher
  useEffect(() => {
    if (!('speechSynthesis' in window) || data.allocations.length === 0) return;

    data.allocations.forEach(req => {
      if (req.autoDispatched && !spokenIdsRef.current.has(req.id)) {
        // Construct standard AI text alert
        const text = `Critical Alert. Priority ${req.score} emergency in ${req.location}. Resource needed: ${req.type}. AI Assessment: ${req.reasoning}`;
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Push to browser's audio queue
        window.speechSynthesis.speak(utterance);
        
        // Track as spoken to prevent loop
        spokenIdsRef.current.add(req.id);
      }
    });

    return () => {
      // Clean up in case user leaves page while AI is talking
      window.speechSynthesis.cancel();
    };
  }, [data.allocations]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getAllocations();
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    getDemoStatus().then(s => {
      if (s && s.running) {
        setDemo(d => ({ ...d, running: true, scenarioName: s.scenarioName, startedAt: s.startedAt }));
      }
    }).catch(() => {});

    // Hook into backend via WebSockets
    const socket = io(SOCKET_URL);

    socket.on('new_allocation', () => {
      console.log('Realtime socket ping received! Instantly auto-fetching fresh allocations.');
      fetchData();
    });

    socket.on('sim_event', (evt) => {
      if (evt.kind === 'start') {
        setDemo({
          running: true,
          scenarioName: evt.scenarioName,
          phase: 'Scenario starting…',
          eventIndex: 0,
          totalEvents: evt.totalEvents,
          hoursFromLandfall: null,
          compressedDurationMs: evt.compressedDurationMs,
          startedAt: Date.now()
        });
      } else if (evt.kind === 'event') {
        setDemo(d => ({
          ...d,
          running: true,
          phase: evt.phase,
          eventIndex: (evt.eventIndex ?? 0) + 1,
          totalEvents: evt.totalEvents ?? d.totalEvents,
          hoursFromLandfall: evt.hoursFromLandfall
        }));
      } else if (evt.kind === 'complete' || evt.kind === 'stop') {
        setDemo(d => ({ ...d, running: false, phase: evt.kind === 'complete' ? 'Scenario complete' : null }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Progress-bar ticker while demo is running
  useEffect(() => {
    if (!demo.running || !demo.startedAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(interval);
  }, [demo.running, demo.startedAt]);

  const handleStartDemo = async () => {
    if (demoBusy || demo.running) return;
    setDemoBusy(true);
    try {
      await startDemo('cyclone-biparjoy');
    } catch (err) {
      console.error('Failed to start demo:', err);
    } finally {
      setDemoBusy(false);
    }
  };

  const handleStopDemo = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      await stopDemo();
      setDemo({ running: false, scenarioName: null, phase: null, eventIndex: 0, totalEvents: 0, hoursFromLandfall: null, compressedDurationMs: 0, startedAt: null });
    } catch (err) {
      console.error('Failed to stop demo:', err);
    } finally {
      setDemoBusy(false);
    }
  };

  const progressPct = (() => {
    if (!demo.running || !demo.startedAt || !demo.compressedDurationMs) return 0;
    return Math.min(100, Math.round(((Date.now() - demo.startedAt) / demo.compressedDurationMs) * 100));
  })();

  const handlePredict = async () => {
    if (predictLoading) return;
    setPredictLoading(true);
    setPredictError(null);
    setPredictResult(null);
    setCompareResult(null);
    setCompareError(null);
    try {
      const result = await predictPrePositioning(predictForm);
      setPredictResult(result);
    } catch (err) {
      console.error('Prediction failed:', err);
      setPredictError(err.response?.data?.error || err.message || 'Prediction failed');
    } finally {
      setPredictLoading(false);
    }
  };

  const handleCompare = async () => {
    if (compareLoading || !predictResult?.stagingPlan) return;
    setCompareLoading(true);
    setCompareError(null);
    setCompareResult(null);
    try {
      const result = await compareScenario({ stagingPlan: predictResult.stagingPlan });
      setCompareResult(result);
    } catch (err) {
      console.error('Compare failed:', err);
      setCompareError(err.response?.data?.error || err.message || 'Comparison failed');
    } finally {
      setCompareLoading(false);
    }
  };

  const formatDeliveryHours = (h) => {
    if (h === null || h === undefined) return '—';
    if (h < 1) return `${Math.round(h * 60)} min`;
    return `${h.toFixed(1)} h`;
  };

  const priorityColor = (p) => {
    if (p === 'Critical') return '#fb7185';
    if (p === 'High') return '#fbbf24';
    if (p === 'Medium') return '#60a5fa';
    return '#94a3b8';
  };

  const getStatusColor = (status) => {
    if (status === 'Fully Fulfilled') return 'var(--success)';
    if (status === 'Partially Fulfilled') return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>Operations Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>AI-driven resource allocation overview.</p>
        </div>
        <button onClick={fetchData} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      {/* Scenario Simulator control bar */}
      <div className="glass-panel" style={{
        marginBottom: '24px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderColor: demo.running ? 'rgba(239, 68, 68, 0.5)' : undefined,
        background: demo.running ? 'rgba(239, 68, 68, 0.05)' : undefined
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
              🎬 Scenario Simulator
            </div>
            {demo.running ? (
              <span className="animate-fade-in" style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fb7185',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                letterSpacing: '0.05em'
              }}>
                ● LIVE — {demo.scenarioName || 'Replay in progress'}
              </span>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Replay real historical disasters in compressed time.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!demo.running ? (
              <button
                onClick={handleStartDemo}
                disabled={demoBusy}
                className="btn btn-primary"
                style={{ opacity: demoBusy ? 0.6 : 1 }}
              >
                <Play size={16} /> Play Cyclone Biparjoy (2023)
              </button>
            ) : (
              <button
                onClick={handleStopDemo}
                disabled={demoBusy}
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fb7185', border: '1px solid rgba(239, 68, 68, 0.4)', opacity: demoBusy ? 0.6 : 1 }}
              >
                <Square size={16} /> Stop &amp; Reset
              </button>
            )}
          </div>
        </div>

        {demo.running && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} color="var(--accent-color)" />
                <span>{demo.phase || 'Waiting for next event…'}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {demo.eventIndex}/{demo.totalEvents} events{demo.hoursFromLandfall !== null && demo.hoursFromLandfall !== undefined ? ` • T${demo.hoursFromLandfall >= 0 ? '+' : ''}${demo.hoursFromLandfall}h from landfall` : ''}
              </div>
            </div>
            <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--accent-color), #fb7185)', transition: 'width 0.25s linear' }} />
            </div>
          </div>
        )}
      </div>

      {/* Predictive Pre-Positioning Engine */}
      <div className="glass-panel" style={{
        marginBottom: '24px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderColor: predictResult ? 'rgba(56, 189, 248, 0.4)' : undefined,
        background: predictResult ? 'rgba(56, 189, 248, 0.04)' : undefined
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
              🔮 Predictive Pre-Positioning Engine
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Gemini + RAG + weather → staging plan before impact.
            </span>
          </div>
          <button
            onClick={() => setPredictOpen(o => !o)}
            className="btn"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          >
            {predictOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {predictOpen ? 'Hide' : 'Open'}
          </button>
        </div>

        {predictOpen && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Region</label>
                <input
                  type="text"
                  value={predictForm.region}
                  onChange={e => setPredictForm(f => ({ ...f, region: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incoming Threat</label>
                <input
                  type="text"
                  value={predictForm.threat}
                  onChange={e => setPredictForm(f => ({ ...f, threat: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horizon (hrs)</label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={predictForm.horizonHours}
                  onChange={e => setPredictForm(f => ({ ...f, horizonHours: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                />
              </div>
            </div>
            <div>
              <button
                onClick={handlePredict}
                disabled={predictLoading || !predictForm.region || !predictForm.threat}
                className="btn btn-primary"
                style={{ opacity: predictLoading || !predictForm.region || !predictForm.threat ? 0.6 : 1 }}
              >
                <Radar size={16} /> {predictLoading ? 'Generating plan…' : 'Generate Pre-Positioning Plan'}
              </button>
            </div>

            {predictError && (
              <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#fb7185', fontSize: '0.85rem' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {predictError}
              </div>
            )}

            {predictResult && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                      📡 Threat Assessment
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overall confidence:</span>
                      <span style={{ fontWeight: 'bold', color: predictResult.overallConfidence >= 80 ? '#34d399' : predictResult.overallConfidence >= 60 ? '#fbbf24' : '#fb7185' }}>
                        {predictResult.overallConfidence}/100
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>{predictResult.threatAssessment}</p>
                </div>

                {predictResult.ragPrecedent && predictResult.ragPrecedent !== 'No applicable historical precedent.' && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: '6px', display: 'flex', gap: '10px' }}>
                    <BookOpen size={18} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '2px' }}>📚 RAG Precedent Shaping This Plan</div>
                      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{predictResult.ragPrecedent}</p>
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', marginBottom: '8px' }}>
                    🎯 Staging Plan ({predictResult.stagingPlan?.length || 0} districts)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                    {(predictResult.stagingPlan || []).map((d, idx) => (
                      <div key={idx} style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${priorityColor(d.priority)}40`,
                        borderLeft: `4px solid ${priorityColor(d.priority)}`,
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Target size={14} color={priorityColor(d.priority)} />
                            <strong style={{ fontSize: '0.95rem' }}>{d.district}</strong>
                          </div>
                          <span style={{
                            background: `${priorityColor(d.priority)}20`,
                            color: priorityColor(d.priority),
                            border: `1px solid ${priorityColor(d.priority)}50`,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            {d.priority}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span>Confidence: <strong style={{ color: 'var(--text-primary)' }}>{d.confidence}/100</strong></span>
                          <span>Ready by: <strong style={{ color: 'var(--text-primary)' }}>T-{d.readinessByHour}h</strong></span>
                        </div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{d.rationale}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {(d.resources || []).map((r, rIdx) => (
                            <div key={rIdx} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '0.78rem', paddingLeft: '8px', borderLeft: '2px solid rgba(236, 72, 153, 0.4)' }}>
                              <Package size={11} color="#f472b6" />
                              <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#f472b6', letterSpacing: '0.03em' }}>{r.resourceType}</span>
                              <span>× <strong>{r.quantity}</strong></span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>— {r.reasoning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {predictResult.keyRisks && predictResult.keyRisks.length > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#fb7185', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '6px' }}>⚠️ Key Risks If Plan Is NOT Executed</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                      {predictResult.keyRisks.map((r, idx) => <li key={idx}>{r}</li>)}
                    </ul>
                  </div>
                )}

                {/* Chain actions: compare + run simulator */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
                  <button
                    onClick={handleCompare}
                    disabled={compareLoading}
                    className="btn"
                    style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', opacity: compareLoading ? 0.6 : 1 }}
                  >
                    <Scale size={16} /> {compareLoading ? 'Computing comparison…' : '📊 Compare: Without AI vs. With AI'}
                  </button>
                  <button
                    onClick={handleStartDemo}
                    disabled={demoBusy || demo.running}
                    className="btn"
                    style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.4)', opacity: (demoBusy || demo.running) ? 0.6 : 1 }}
                  >
                    <Play size={16} /> {demo.running ? 'Scenario running…' : 'Run this scenario now'}
                  </button>
                </div>

                {compareError && (
                  <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#fb7185', fontSize: '0.85rem' }}>
                    <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    {compareError}
                  </div>
                )}

                {compareResult && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                      📊 Side-by-Side: Without AI Pre-Staging vs. With AI Pre-Staging
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {[
                        { label: 'Without AI Pre-Staging', side: compareResult.baseline, accent: '#fb7185', bg: 'rgba(239, 68, 68, 0.05)', border: 'rgba(239, 68, 68, 0.3)', subtitle: 'Reactive dispatch from central depot' },
                        { label: 'With AI Pre-Staging', side: compareResult.withAI, accent: '#34d399', bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.3)', subtitle: 'Resources staged locally per AI plan' }
                      ].map(({ label, side, accent, bg, border, subtitle }) => (
                        <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderLeft: `4px solid ${accent}`, borderRadius: '8px', padding: '14px' }}>
                          <div style={{ fontSize: '0.85rem', color: accent, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>{subtitle}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fulfillment Rate</div>
                              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: accent }}>{side.fulfillmentRate}%</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{side.fulfilled} of {side.totalEvents} fulfilled</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Avg. First Delivery</div>
                              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: accent }}>{formatDeliveryHours(side.avgDeliveryHours)}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>first = {formatDeliveryHours(side.firstDeliveryHours)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Critical (≥80) Starved</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: side.criticalStarved === 0 ? '#34d399' : '#fb7185' }}>{side.criticalStarved}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{side.criticalFulfilled} critical fulfilled</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Partial / Pending</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{side.partial} / {side.pending}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{side.totalUnitsAllocated} units allocated</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TrendingUp size={18} color="#34d399" />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold' }}>Additional Fulfilled</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>+{compareResult.delta.additionalFulfilled} requests</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TrendingDown size={18} color="#34d399" />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold' }}>Critical Starved Reduced By</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>−{compareResult.delta.criticalStarvedReduction} lives at risk</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={18} color="#34d399" />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold' }}>Avg. Delivery Speedup</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{formatDeliveryHours(compareResult.delta.avgDeliveryHoursReduction)} faster</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        {/* Main List */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading AI allocations...</p>
            ) : data.allocations.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
                <PackageCheck size={48} color="var(--text-secondary)" style={{ marginBottom: '16px' }} />
                <h3>No active requests</h3>
                <p style={{ color: 'var(--text-secondary)' }}>All emergency requests have been resolved.</p>
              </div>
            ) : (
              data.allocations.map((req) => (
                <div key={req.id} className="glass-panel animate-fade-in" style={{ position: 'relative', overflow: 'hidden' }}>
                  {/* Score Indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    bottom: '0',
                    width: '6px',
                    backgroundColor: req.score >= 80 ? 'var(--danger)' : req.score >= 50 ? 'var(--warning)' : 'var(--success)'
                  }} />
                  
                  <div style={{ paddingLeft: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      {req.detectedLanguage && req.detectedLanguage.toLowerCase() !== 'english' && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          letterSpacing: '0.05em',
                          marginBottom: '12px',
                          textTransform: 'uppercase'
                        }}>
                          <Globe size={12} /> AUTOTRANSLATED FROM {req.detectedLanguage}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          background: 'rgba(255, 255, 255, 0.1)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          textTransform: 'uppercase'
                        }}>
                          {req.type}
                        </span>
                        <h3 style={{ margin: 0 }}>📍 {req.location}</h3>
                        {req.autoDispatched && (
                          <span className="animate-fade-in" style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fb7185',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            letterSpacing: '0.05em'
                          }}>
                            🚨 NGO COMM DISPATCHED
                          </span>
                        )}
                        {req.simulated && (
                          <span style={{
                            background: 'rgba(236, 72, 153, 0.15)',
                            color: '#f472b6',
                            border: '1px solid rgba(236, 72, 153, 0.4)',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            letterSpacing: '0.05em'
                          }}>
                            🎬 SIMULATED {req.hoursFromLandfall !== null && req.hoursFromLandfall !== undefined ? `• T${req.hoursFromLandfall >= 0 ? '+' : ''}${req.hoursFromLandfall}h` : ''}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '24px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                        <span>👥 People: <strong>{req.peopleCount}</strong></span>
                        <span>⚠️ Urgency: <strong>{req.urgency}</strong></span>
                      </div>

                      {/* Base AI Explainability Box */}
                      <div style={{ 
                        background: 'rgba(99, 102, 241, 0.1)', 
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: req.forecast ? '12px' : '16px',
                        display: 'flex',
                        gap: '12px'
                      }}>
                        <Brain size={24} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>
                            Base AI Assessment (Score: {req.score}/100)
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>{req.reasoning}</p>
                        </div>
                      </div>

                      {/* Advanced Predictive Forecast Box */}
                      {req.forecast && (
                        <div className="animate-fade-in" style={{ 
                          background: 'rgba(234, 179, 8, 0.05)', 
                          border: '1px dashed rgba(234, 179, 8, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          display: 'flex',
                          gap: '12px'
                        }}>
                          <AlertCircle size={24} color="var(--warning)" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--warning)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em' }}>
                              ⚡ Temporal Forecast (+24 HRS)
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{req.forecast}</p>
                          </div>
                        </div>
                      )}

                      {/* AI Vision Verification Box */}
                      {req.imageVerification && req.imageVerification !== "No visual data submitted for AI verification." && req.imageVerification !== "No visual data processed." && req.imageVerification !== "Verification unavailable due to system fault." && (
                        <div className="animate-fade-in" style={{ 
                          background: 'rgba(124, 58, 237, 0.05)', 
                          border: '1px solid rgba(124, 58, 237, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          display: 'flex',
                          gap: '16px',
                          alignItems: 'flex-start'
                        }}>
                          {req.imageBase64 && (
                            <img src={req.imageBase64} alt="Disaster Damage" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                          )}
                          <div>
                            <div style={{ fontSize: '0.8rem', color: '#a78bfa', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Camera size={14} /> AI Visual Verification
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{req.imageVerification}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* RAG Knowledge Database Precedent Box */}
                      {req.ragPrecedent && (
                        <div className="animate-fade-in" style={{
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          display: 'flex',
                          gap: '12px'
                        }}>
                          <BookOpen size={24} color="#34d399" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.8rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em' }}>
                              📚 RAG Organizational Precedent Applied
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{req.ragPrecedent}</p>
                          </div>
                        </div>
                      )}

                      {/* Agentic Allocation Plan (Gemini Function Calling) */}
                      {Array.isArray(req.recommendedResources) && req.recommendedResources.length > 0 && (
                        <div className="animate-fade-in" style={{
                          background: 'rgba(236, 72, 153, 0.05)',
                          border: '1px solid rgba(236, 72, 153, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#f472b6', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                            <Package size={14} /> 🤖 Agentic Allocation Plan (Gemini Function Calling)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {req.recommendedResources.map((r, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '8px 10px',
                                background: 'rgba(236, 72, 153, 0.08)',
                                borderRadius: '6px',
                                border: '1px solid rgba(236, 72, 153, 0.15)'
                              }}>
                                <div style={{
                                  minWidth: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: 'rgba(236, 72, 153, 0.2)',
                                  color: '#f472b6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  flexShrink: 0
                                }}>{idx + 1}</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px', flexWrap: 'wrap' }}>
                                    <span style={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem', color: '#f472b6', letterSpacing: '0.05em' }}>{r.resourceType}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>× <strong>{r.quantity}</strong> units</span>
                                  </div>
                                  {r.reasoning && (
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{r.reasoning}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {req.notes && (
                         <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                           &quot;{req.notes}&quot;
                         </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '150px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: getStatusColor(req.status),
                        background: `${getStatusColor(req.status)}20`,
                        border: `1px solid ${getStatusColor(req.status)}50`
                      }}>
                        {req.status === 'Pending (No Resources)' ? <AlertCircle size={14} /> : <PackageCheck size={14} />}
                        {req.status}
                      </div>

                      {req.allocatedAmount > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Allocated: <strong style={{ color: 'white' }}>{req.allocatedAmount}</strong> units
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inventory Sidebar */}
        <div>
          <div className="glass-panel" style={{ position: 'sticky', top: '24px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--surface-border)', paddingBottom: '12px' }}>
              Resource Inventory
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(data.remainingInventory).map(([item, qty]) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{item}</span>
                  <span style={{ 
                    fontSize: '1.2rem', 
                    fontWeight: 'bold',
                    color: qty === 0 ? 'var(--danger)' : qty < 20 ? 'var(--warning)' : 'var(--success)'
                  }}>
                    {qty}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Inventory is tracked in real-time and allocated strictly by AI priority score.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
