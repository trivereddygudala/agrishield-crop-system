import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Cpu, 
  Database, 
  Cloud, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Radio, 
  Play, 
  Pause, 
  RefreshCw, 
  Zap, 
  Sparkles, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Server,
  Layers,
  Terminal,
  Send,
  Eye,
  X,
  Download,
  Filter,
  Sliders,
  ShieldAlert,
  Target,
  Flame,
  FileJson,
  ArrowRight,
  TrendingUp,
  Gauge
} from 'lucide-react';
import API from '../../services/api';

// ── Node Coordinates in 1000 x 560 SVG coordinate space ───────────────────────
const NODE_COORDS = {
  client_web: { x: 130, y: 130, label: 'Farmer Web / PWA', tier: 'client', icon: Smartphone, color: '#10b981', angle: 210, radius: 210 },
  client_iot: { x: 130, y: 430, label: 'ESP32 IoT Fleet', tier: 'client', icon: Radio, color: '#06b6d4', angle: 150, radius: 210 },
  waf: { x: 380, y: 280, label: 'Security WAF & Rate Limiter', tier: 'gateway', icon: ShieldCheck, color: '#8b5cf6', angle: 180, radius: 120 },
  core_gateway: { x: 600, y: 280, label: 'FastAPI Core (Port 8000)', tier: 'core', icon: Server, color: '#10b981', angle: 0, radius: 40 },
  ai_cluster: { x: 880, y: 100, label: 'AI Prediction Cluster', tier: 'service', icon: Cpu, color: '#f59e0b', angle: 30, radius: 220 },
  db_mongodb: { x: 880, y: 220, label: 'MongoDB Atlas Database', tier: 'service', icon: Database, color: '#3b82f6', angle: 350, radius: 210 },
  cloud_voice: { x: 880, y: 350, label: 'Studio Neural TTS (te-IN)', tier: 'external', icon: Volume2, color: '#ec4899', angle: 320, radius: 220 },
  cloud_weather: { x: 880, y: 470, label: 'Regional Weather API', tier: 'external', icon: Cloud, color: '#14b8a6', angle: 290, radius: 220 },
};

// ── Pipeline Connections ───────────────────────────────────────────────────────
const CONNECTIONS = [
  { id: 'c1', from: 'client_web', to: 'waf', label: '/api/*' },
  { id: 'c2', from: 'client_iot', to: 'waf', label: '/api/v1/iot/*' },
  { id: 'c3', from: 'waf', to: 'core_gateway', label: 'Verified Traffic' },
  { id: 'c4', from: 'core_gateway', to: 'ai_cluster', label: '1,252-Class Inference' },
  { id: 'c5', from: 'core_gateway', to: 'db_mongodb', label: 'Async Read / Write' },
  { id: 'c6', from: 'core_gateway', to: 'cloud_voice', label: 'te-IN-Mohan Audio' },
  { id: 'c7', from: 'core_gateway', to: 'cloud_weather', label: 'Radar Sync' },
];

export default function ApiTrafficRadar() {
  // Visual Mode: 'mesh' (2D Service Mesh Graph) | 'sonar' (Tactical Polar Radar Sweep)
  const [visualMode, setVisualMode] = useState('mesh');
  
  // Animation & Speed Controls
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x, 2.5x, 5x
  
  // Audio Feedback (Web Audio API Synthesizer)
  const [audioEnabled, setAudioEnabled] = useState(() => {
    return localStorage.getItem('radar_audio_enabled') === 'true';
  });
  const audioCtxRef = useRef(null);

  // Inspector & Simulation State
  const [selectedNode, setSelectedNode] = useState(null);
  const [inspectPacket, setInspectPacket] = useState(null);
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [customInjectorOpen, setCustomInjectorOpen] = useState(false);
  const [customRoute, setCustomRoute] = useState('/api/market/prices');
  const [customMethod, setCustomMethod] = useState('GET');
  const [customPayload, setCustomPayload] = useState('{"mandal": "Prakasam", "crop": "Chilli"}');
  const [toastMsg, setToastMsg] = useState('');

  // Terminal Logs & Filters
  const [terminalSearch, setTerminalSearch] = useState('');
  const [terminalMethodFilter, setTerminalMethodFilter] = useState('all'); // 'all', 'GET', 'POST', '2xx', '4xx_5xx'
  const [autoScrollLocked, setAutoScrollLocked] = useState(false);
  const terminalEndRef = useRef(null);

  // Live Metrics & Telemetry State
  const [metrics, setMetrics] = useState({
    system_health: '100% OPERATIONAL',
    throughput_rps: 38.6,
    avg_latency_ms: 17.4,
    error_rate_pct: 0.0,
    active_websockets: 4,
    total_scans_processed: 128,
    bandwidth_kbps: { inbound: 52.4, outbound: 124.6 },
    percentiles_ms: { p50: 8.4, p95: 112.5, p99: 164.8 }
  });

  // Rolling 60s Sparkline History
  const [sparklineData, setSparklineData] = useState(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      sec: i,
      rps: 34 + Math.sin(i * 0.5) * 6,
      latency: 16 + Math.cos(i * 0.4) * 4
    }));
  });

  // Live Request Stream Buffer
  const [trafficLog, setTrafficLog] = useState([
    { id: 'l1', time: '13:18:01', method: 'GET', path: '/api/v1/health', status: 200, latency_ms: 4.8, from: 'client_web', to: 'core_gateway', desc: 'Heartbeat Health Probe' },
    { id: 'l2', time: '13:18:03', method: 'POST', path: '/api/v1/iot/telemetry', status: 200, latency_ms: 9.2, from: 'client_iot', to: 'db_mongodb', desc: 'ESP32 Soil Moisture (42%)' },
    { id: 'l3', time: '13:18:05', method: 'GET', path: '/api/intelligence/weather', status: 200, latency_ms: 22.4, from: 'client_web', to: 'cloud_weather', desc: 'Regional Precipitation Sync' },
    { id: 'l4', time: '13:18:08', method: 'POST', path: '/api/predict', status: 200, latency_ms: 118.0, from: 'client_web', to: 'ai_cluster', desc: 'Chilli Leaf Curl Inference' },
    { id: 'l5', time: '13:18:10', method: 'POST', path: '/api/v1/speech/synthesize', status: 200, latency_ms: 34.6, from: 'client_web', to: 'cloud_voice', desc: 'Telugu Audio Briefing' }
  ]);

  // Animated Particles along SVG lines
  const [particles, setParticles] = useState([]);
  const particleIdRef = useRef(200);

  // Active ripples on nodes
  const [ripples, setRipples] = useState({});

  // Tactical Sonar Sweep Beam Angle (0 to 360 deg)
  const [sonarAngle, setSonarAngle] = useState(0);

  // Web Audio Sonar Ping Generator
  const playSonarPing = useCallback((type = 'normal') => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (type === 'alert' || type === 'blocked') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === 'fast' || type === 'burst') {
        osc.frequency.setValueAtTime(1100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else {
        // Standard gentle sonar blip
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // AudioContext policy suppression fallback
    }
  }, [audioEnabled]);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    localStorage.setItem('radar_audio_enabled', String(next));
    if (next) {
      setTimeout(() => playSonarPing('fast'), 50);
      setToastMsg('Tactical Sonar Audio Enabled');
    } else {
      setToastMsg('Sonar Audio Muted');
    }
    setTimeout(() => setToastMsg(''), 2500);
  };

  const triggerRipple = useCallback((nodeKey) => {
    setRipples(prev => ({ ...prev, [nodeKey]: Date.now() }));
    playSonarPing('normal');
  }, [playSonarPing]);

  // Fetch Live Radar Telemetry from Backend
  const fetchRadarData = useCallback(async () => {
    try {
      const res = await API.get('/api/admin/traffic/radar');
      if (res.data) {
        if (res.data.metrics) setMetrics(res.data.metrics);
        if (res.data.sparkline_history) setSparklineData(res.data.sparkline_history);
        if (res.data.recent_traffic && res.data.recent_traffic.length > 0) {
          setTrafficLog(prev => {
            const incoming = res.data.recent_traffic.filter(
              inc => !prev.some(p => p.id === inc.id)
            );
            return [...incoming, ...prev].slice(0, 30);
          });
        }
      }
    } catch (err) {
      console.warn('Live traffic radar polling fallback:', err);
    }
  }, []);

  useEffect(() => {
    fetchRadarData();
    const interval = setInterval(() => {
      if (!isPaused && document.visibilityState === 'visible') {
        fetchRadarData();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchRadarData, isPaused]);

  // Tactical Sonar Sweep Animation Loop (360 degrees)
  useEffect(() => {
    if (isPaused || visualMode !== 'sonar') return;
    let animId;
    const sweep = () => {
      setSonarAngle(prev => (prev + 1.2 * speedMultiplier) % 360);
      animId = requestAnimationFrame(sweep);
    };
    animId = requestAnimationFrame(sweep);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, visualMode, speedMultiplier]);

  // Continuous Simulated Traffic Particle Stream Generator
  useEffect(() => {
    if (isPaused) return;

    const baseInterval = Math.max(300, 1800 / speedMultiplier);
    const interval = setInterval(() => {
      const routes = [
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'ai_cluster', color: '#10b981', method: 'POST', path: '/api/predict', desc: 'Neural Scan' },
        { from: 'client_iot', to: 'waf', next: 'core_gateway', end: 'db_mongodb', color: '#06b6d4', method: 'POST', path: '/api/v1/iot/telemetry', desc: 'Soil Ping' },
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'cloud_weather', color: '#14b8a6', method: 'GET', path: '/api/weather/current', desc: 'Weather Radar' },
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'cloud_voice', color: '#ec4899', method: 'POST', path: '/api/v1/speech/synthesize', desc: 'Telugu Audio' },
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'core_gateway', color: '#8b5cf6', method: 'GET', path: '/api/v1/health', desc: 'Liveness Check' },
      ];

      const r = routes[Math.floor(Math.random() * routes.length)];
      const pId = particleIdRef.current++;

      setParticles(prev => [
        ...prev.slice(-24),
        {
          id: `p-${pId}-1`,
          fromKey: r.from,
          toKey: r.to,
          progress: 0,
          color: r.color,
          nextStep: r.next,
          finalStep: r.end,
          method: r.method,
          path: r.path,
          desc: r.desc
        }
      ]);
    }, baseInterval);

    return () => clearInterval(interval);
  }, [isPaused, speedMultiplier]);

  // Animation Frame Loop for Flying Particles
  useEffect(() => {
    let animId;
    const animate = () => {
      setParticles(prev => {
        const stepRate = 0.022 * speedMultiplier;
        const nextParticles = [];
        for (const p of prev) {
          const nextProg = p.progress + stepRate;
          if (nextProg < 1) {
            nextParticles.push({ ...p, progress: nextProg });
          } else {
            triggerRipple(p.toKey);

            if (p.nextStep && p.toKey === 'waf') {
              nextParticles.push({
                id: `${p.id}-2`,
                fromKey: 'waf',
                toKey: p.nextStep,
                progress: 0,
                color: p.color,
                nextStep: p.finalStep !== p.nextStep ? p.finalStep : null,
                finalStep: null,
                method: p.method,
                path: p.path,
                desc: p.desc
              });
            } else if (p.nextStep && p.toKey === 'core_gateway') {
              nextParticles.push({
                id: `${p.id}-3`,
                fromKey: 'core_gateway',
                toKey: p.nextStep,
                progress: 0,
                color: p.color,
                nextStep: null,
                finalStep: null,
                method: p.method,
                path: p.path,
                desc: p.desc
              });
            }
          }
        }
        return nextParticles;
      });
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [triggerRipple, speedMultiplier]);

  // Interactive Simulation Dispatcher (Scenarios: crop_scan, iot_telemetry, voice_tts, ddos_attack, chaos_outage, custom_route)
  const handleSimulate = async (scenario, customOpts = {}) => {
    setSimulationLoading(true);
    try {
      let res;
      const payload = { scenario, ...customOpts };
      try {
        res = await API.post('/api/admin/traffic/simulate', payload);
      } catch {
        res = await API.post('/api/v1/admin/traffic/simulate', payload);
      }

      if (res.data) {
        setActiveSimulation(res.data);
        
        let color = '#10b981';
        let startNode = 'client_web';
        let endNode = 'core_gateway';

        if (scenario === 'crop_scan') {
          color = '#f59e0b';
          endNode = 'ai_cluster';
          playSonarPing('burst');
        } else if (scenario === 'iot_telemetry') {
          color = '#06b6d4';
          startNode = 'client_iot';
          endNode = 'db_mongodb';
          playSonarPing('burst');
        } else if (scenario === 'voice_tts') {
          color = '#ec4899';
          endNode = 'cloud_voice';
          playSonarPing('burst');
        } else if (scenario === 'ddos_attack') {
          color = '#ef4444'; // Red attack burst
          endNode = 'waf'; // Blocked at WAF!
          playSonarPing('alert');
          setToastMsg('🚨 Botnet Flood Intercepted by WAF! IP 198.51.100.42 Jailed.');
          setTimeout(() => setToastMsg(''), 4000);
        } else if (scenario === 'chaos_outage') {
          color = '#eab308'; // Amber degraded fallback
          endNode = 'cloud_weather';
          playSonarPing('alert');
          setToastMsg('⚠️ Weather API Outage Triggered: Circuit Breaker Activated (Cached Fallback).');
          setTimeout(() => setToastMsg(''), 4000);
        }

        const pId = particleIdRef.current++;
        setParticles(prev => [
          ...prev,
          {
            id: `sim-${pId}`,
            fromKey: startNode,
            toKey: 'waf',
            progress: 0,
            color,
            nextStep: scenario === 'ddos_attack' ? null : 'core_gateway',
            finalStep: endNode,
            method: res.data.scenario?.toUpperCase() || 'SIM',
            path: `/${scenario}`,
            desc: res.data.packet_id
          }
        ]);

        const timeNow = new Date().toTimeString().slice(0, 8);
        setTrafficLog(prev => [
          {
            id: `sim-log-${Date.now()}`,
            time: timeNow,
            method: customOpts.method || (scenario === 'crop_scan' || scenario === 'iot_telemetry' || scenario === 'voice_tts' ? 'POST' : 'GET'),
            path: customOpts.path || `/${scenario}`,
            status: res.data.http_status || 200,
            latency_ms: res.data.total_latency_ms || 12.0,
            from: startNode,
            to: endNode,
            desc: res.data.details?.diagnosis || res.data.details?.circuit_breaker || res.data.details?.blocked_by || 'Dispatched Probe'
          },
          ...prev
        ].slice(0, 30));
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setSimulationLoading(false);
      setCustomInjectorOpen(false);
    }
  };

  // Export Traffic Log
  const exportLog = (format = 'json') => {
    let content = '';
    let mimeType = 'application/json';
    let filename = `agrishield_traffic_audit_${Date.now()}.${format}`;

    if (format === 'csv') {
      mimeType = 'text/csv';
      const headers = ['Time', 'Method', 'Path', 'Status', 'Latency_ms', 'From', 'To', 'Description'];
      const rows = trafficLog.map(l => [
        l.time,
        l.method,
        `"${l.path}"`,
        l.status,
        l.latency_ms,
        l.from,
        l.to,
        `"${l.desc || ''}"`
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      content = JSON.stringify(trafficLog, null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMsg(`Traffic Audit Exported (${format.toUpperCase()})`);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Filtered Terminal Logs
  const filteredTrafficLog = useMemo(() => {
    return trafficLog.filter(item => {
      if (terminalSearch.trim()) {
        const q = terminalSearch.toLowerCase();
        const matches = (item.path && item.path.toLowerCase().includes(q)) ||
                        (item.desc && item.desc.toLowerCase().includes(q)) ||
                        (item.from && item.from.toLowerCase().includes(q)) ||
                        (item.to && item.to.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (terminalMethodFilter === 'GET' && item.method !== 'GET') return false;
      if (terminalMethodFilter === 'POST' && item.method !== 'POST') return false;
      if (terminalMethodFilter === '2xx' && (item.status < 200 || item.status >= 300)) return false;
      if (terminalMethodFilter === '4xx_5xx' && item.status < 400) return false;
      return true;
    });
  }, [trafficLog, terminalSearch, terminalMethodFilter]);

  return (
    <div className="space-y-6">
      {/* Toast Notification Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Top Status HUD Banner with Live Sparkline Chart ── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-[#06141c] to-slate-950 text-white border border-emerald-900/50 shadow-2xl relative overflow-hidden">
        {/* Background circuit grid watermark */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE MESH RADAR ACTIVE</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300 font-mono">WS: 127.0.0.1:8000</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <span>AgriShield Core Telemetry Radar</span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-mono font-bold">
                v2.4 Pro
              </span>
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              2D service mesh topology visualizer & polar radar scope. Monitors animated packet trajectories between mobile PWA clients, ESP32 IoT gateways, PyTorch cluster, and database engines.
            </p>
          </div>

          {/* Sparkline & Real-time Metrics Deck */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 60s Mini Sparkline Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner flex flex-col justify-between w-48 h-20">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  RPS TRAFFIC
                </span>
                <span className="font-mono text-emerald-400">{metrics.throughput_rps} r/s</span>
              </div>
              {/* SVG Sparkline Curve */}
              <div className="w-full h-8">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 120 30" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <polygon
                    fill="url(#sparkGrad)"
                    points={`0,30 ${sparklineData.map((d, i) => `${(i / (sparklineData.length - 1)) * 120},${30 - (d.rps / 50) * 28}`).join(' ')} 120,30`}
                  />
                  {/* Line */}
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklineData.map((d, i) => `${(i / (sparklineData.length - 1)) * 120},${30 - (d.rps / 50) * 28}`).join(' ')}
                  />
                </svg>
              </div>
            </div>

            {/* Mean Latency & Percentiles */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner flex flex-col justify-between min-w-[130px] h-20">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Gauge className="w-3 h-3 text-sky-400" />
                Mean Latency
              </span>
              <span className="text-xl font-mono font-black text-sky-400">{metrics.avg_latency_ms} ms</span>
              <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
                <span>p50:{metrics.percentiles_ms?.p50}</span>
                <span>p95:{metrics.percentiles_ms?.p95}</span>
              </div>
            </div>

            {/* Bandwidth Footprint */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner flex flex-col justify-between min-w-[130px] h-20">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3 text-purple-400" />
                Bandwidth
              </span>
              <span className="text-sm font-mono font-bold text-slate-200">
                ↓ {metrics.bandwidth_kbps?.inbound || 52} KB/s
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ↑ {metrics.bandwidth_kbps?.outbound || 124} KB/s
              </span>
            </div>

            {/* System Status Pill */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner flex flex-col justify-between min-w-[130px] h-20">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health Watchdog</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black text-emerald-400 uppercase">Operational</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">0.0% Error Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Canvas Control Deck (Mode Switcher, Speed, Audio, Pause) ── */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode Toggle (Topology vs Sonar) */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            <button
              onClick={() => setVisualMode('mesh')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visualMode === 'mesh'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Service Mesh Graph</span>
            </button>
            <button
              onClick={() => setVisualMode('sonar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visualMode === 'sonar'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Tactical Polar Sonar</span>
            </button>
          </div>
        </div>

        {/* Center: Speed Multiplier (1x, 2.5x, 5x) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase hidden sm:inline">Packet Flow:</span>
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            {[1, 2.5, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  speedMultiplier === spd
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Audio Synthesizer, Pause, Refresh */}
        <div className="flex items-center gap-2">
          {/* Audio Sonar Ping Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              audioEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}
            title={audioEnabled ? 'Mute Sonar Pings' : 'Enable Tactical Sonar Audio'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-[11px] hidden md:inline">{audioEnabled ? 'Sonar Audio ON' : 'Muted'}</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title={isPaused ? 'Resume live particle stream' : 'Pause animation stream'}
          >
            {isPaused ? <Play className="w-4 h-4 text-amber-500" /> : <Pause className="w-4 h-4" />}
            <span className="text-[11px] hidden md:inline">{isPaused ? 'Paused' : 'Active'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchRadarData}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Poll fresh telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Radar Canvas ── */}
      <div className="relative rounded-3xl bg-[#030712] border border-slate-800 shadow-2xl overflow-hidden min-h-[580px] select-none">
        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.3) 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* ═══ VIEW MODE 1: SERVICE MESH TOPOLOGY ═══ */}
        {visualMode === 'mesh' && (
          <svg className="w-full h-full min-h-[560px]" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Glow filter for optic cables */}
              <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Particle glow */}
              <filter id="packetGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4.5" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Connection Pipes (Base Static & Glow Underlay) */}
            {CONNECTIONS.map((conn) => {
              const from = NODE_COORDS[conn.from];
              const to = NODE_COORDS[conn.to];
              return (
                <g key={conn.id}>
                  {/* Outer laser glow trace */}
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#047857"
                    strokeWidth="4"
                    strokeOpacity="0.25"
                    filter="url(#laserGlow)"
                  />
                  {/* Crisp inner optic fiber line */}
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                    strokeDasharray="4 4"
                  />
                  {/* Connection Midpoint Label Badge */}
                  <g transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2})`}>
                    <rect
                      x="-42"
                      y="-10"
                      width="84"
                      height="20"
                      rx="6"
                      fill="#090d16"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      y="3.5"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {conn.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 2. Flying Request Packet Particles */}
            {particles.map((p) => {
              const from = NODE_COORDS[p.fromKey];
              const to = NODE_COORDS[p.toKey];
              if (!from || !to) return null;

              const currX = from.x + (to.x - from.x) * p.progress;
              const currY = from.y + (to.y - from.y) * p.progress;

              return (
                <g key={p.id}>
                  {/* Comet trail circle */}
                  <circle
                    cx={currX}
                    cy={currY}
                    r="5"
                    fill={p.color}
                    filter="url(#packetGlow)"
                  />
                  <circle
                    cx={currX}
                    cy={currY}
                    r="2.5"
                    fill="#ffffff"
                  />
                </g>
              );
            })}

            {/* 3. Node Representations */}
            {Object.entries(NODE_COORDS).map(([key, node]) => {
              const Icon = node.icon;
              const hasRipple = ripples[key] && Date.now() - ripples[key] < 800;
              const isSelected = selectedNode?.id === key;

              return (
                <g
                  key={key}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode({ id: key, ...node })}
                  className="cursor-pointer group"
                >
                  {/* Arrival Ripple Wave */}
                  {hasRipple && (
                    <circle
                      r="42"
                      fill="none"
                      stroke={node.color}
                      strokeWidth="2"
                      opacity="0.7"
                      className="animate-ping"
                    />
                  )}

                  {/* Outer Orbit Halo */}
                  <circle
                    r="32"
                    fill="#0f172a"
                    stroke={isSelected ? '#38bdf8' : node.color}
                    strokeWidth={isSelected ? '3' : '1.5'}
                    strokeDasharray={isSelected ? 'none' : '3 3'}
                    className="transition-all duration-300 group-hover:scale-110"
                  />

                  {/* Node Icon Core */}
                  <circle
                    r="22"
                    fill={node.color}
                    fillOpacity="0.2"
                  />

                  {/* Lucide SVG Icon rendered in center */}
                  <g transform="translate(-10, -10)">
                    <Icon className="w-5 h-5 text-white" stroke={node.color} strokeWidth="2.2" />
                  </g>

                  {/* Node Label Below */}
                  <text
                    y="46"
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="11"
                    fontWeight="bold"
                    className="transition-colors group-hover:fill-emerald-300"
                  >
                    {node.label}
                  </text>
                  <text
                    y="58"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {key.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* ═══ VIEW MODE 2: TACTICAL POLAR RADAR SCOPE (360° Sweep) ═══ */}
        {visualMode === 'sonar' && (
          <div className="relative w-full h-[560px] flex items-center justify-center overflow-hidden">
            {/* Polar Scope Container */}
            <div className="relative w-[500px] h-[500px] rounded-full border-2 border-emerald-500/40 bg-[#020b08] shadow-[0_0_50px_rgba(16,185,129,0.15)] flex items-center justify-center">
              {/* Concentric Range Rings */}
              <div className="absolute inset-8 rounded-full border border-emerald-500/30 border-dashed" />
              <div className="absolute inset-24 rounded-full border border-emerald-500/25" />
              <div className="absolute inset-40 rounded-full border border-emerald-500/20 border-dashed" />
              <div className="absolute inset-56 rounded-full border border-emerald-500/20" />
              
              {/* Center Bullseye Crosshairs */}
              <div className="absolute w-full h-[1px] bg-emerald-500/20" />
              <div className="absolute h-full w-[1px] bg-emerald-500/20" />
              
              {/* Cardinal Angle Labels */}
              <span className="absolute top-2 text-[10px] font-mono font-bold text-emerald-500">000° NORTH</span>
              <span className="absolute right-2 text-[10px] font-mono font-bold text-emerald-500">090° EAST</span>
              <span className="absolute bottom-2 text-[10px] font-mono font-bold text-emerald-500">180° SOUTH</span>
              <span className="absolute left-2 text-[10px] font-mono font-bold text-emerald-500">270° WEST</span>

              {/* 360° Rotating Radar Sweep Line */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `rotate(${sonarAngle}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                {/* Sweep Leading Line */}
                <div className="absolute top-0 left-1/2 w-1/2 h-[2px] bg-gradient-to-r from-emerald-300 via-emerald-400 to-transparent shadow-[0_0_12px_#10b981]" />
                {/* Sweep Phosphor Trail Wedge */}
                <div 
                  className="absolute top-0 right-1/2 w-1/2 h-1/2 origin-bottom-right"
                  style={{
                    background: 'conic-gradient(from 270deg at 100% 100%, rgba(16, 185, 129, 0.35) 0deg, transparent 55deg)',
                  }}
                />
              </div>

              {/* Radial Nodes Placed on Polar Rings */}
              {Object.entries(NODE_COORDS).map(([key, node]) => {
                const rad = (node.angle * Math.PI) / 180;
                const r = node.radius * 0.95;
                const x = 250 + r * Math.cos(rad);
                const y = 250 + r * Math.sin(rad);

                // Check if sweep beam is near this node (within 35 deg) for glowing phosphor blip
                const angleDiff = Math.abs((sonarAngle - node.angle + 360) % 360);
                const isLitBySweep = angleDiff < 35;

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedNode({ id: key, ...node })}
                    className="absolute cursor-pointer transition-transform hover:scale-125 z-20 group"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {/* Blip Ping Ring */}
                    {isLitBySweep && (
                      <span className="absolute -inset-3 rounded-full bg-emerald-400/30 animate-ping" />
                    )}
                    {/* Central Blip Marker */}
                    <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center shadow-md ${
                      isLitBySweep 
                        ? 'bg-emerald-300 border-white shadow-[0_0_15px_#10b981] scale-125' 
                        : 'bg-slate-900 border-emerald-500/60'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>

                    {/* Polar Node Tag */}
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 px-2 py-0.5 rounded border border-emerald-800 text-[9px] font-mono text-emerald-300 pointer-events-none">
                      {node.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Overlay Legend ── */}
        <div className="absolute bottom-4 left-4 z-20 p-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300 space-y-1.5 hidden md:block">
          <div className="flex items-center gap-2 font-bold text-[10px] text-slate-400 uppercase tracking-wider">
            <span>Mesh Pipeline Legend</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Mobile PWA & Core</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>ESP32 Hardware Nodes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Layer 7 WAF Security</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>PyTorch 1,252 Inference</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Simulation Control Deck (Phase 2 DevOps / Chaos Tools) ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Service Mesh Simulation & Chaos Engineering Deck</span>
            </h3>
            <p className="text-xs text-slate-500">
              Dispatch routed test packets, simulate cyberattacks against the WAF, or trip circuit breakers to verify zero-downtime agricultural fallback.
            </p>
          </div>
          
          <button
            onClick={() => setCustomInjectorOpen(!customInjectorOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-500" />
            <span>Custom Route Injector</span>
          </button>
        </div>

        {/* 1-Click Simulation Scenario Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Crop Scan */}
          <button
            onClick={() => handleSimulate('crop_scan')}
            disabled={simulationLoading}
            className="p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-left transition-all group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-amber-500 text-white">
                <Cpu className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">141ms</span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">AI Crop Scan</div>
            <div className="text-[11px] text-slate-500">Tomato Early Blight</div>
          </button>

          {/* 2. IoT Telemetry */}
          <button
            onClick={() => handleSimulate('iot_telemetry')}
            disabled={simulationLoading}
            className="p-3.5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-50/50 dark:bg-cyan-950/20 hover:bg-cyan-100/60 dark:hover:bg-cyan-950/40 text-left transition-all group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-cyan-500 text-white">
                <Radio className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400">12ms</span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">ESP32 IoT Sync</div>
            <div className="text-[11px] text-slate-500">Soil Moisture & ADC</div>
          </button>

          {/* 3. Telugu Voice TTS */}
          <button
            onClick={() => handleSimulate('voice_tts')}
            disabled={simulationLoading}
            className="p-3.5 rounded-2xl border border-pink-200/80 dark:border-pink-900/60 bg-pink-50/50 dark:bg-pink-950/20 hover:bg-pink-100/60 dark:hover:bg-pink-950/40 text-left transition-all group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-pink-500 text-white">
                <Volume2 className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold text-pink-600 dark:text-pink-400">38ms</span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">Telugu Voice TTS</div>
            <div className="text-[11px] text-slate-500">te-IN-MohanNeural</div>
          </button>

          {/* 4. DDoS / Cyberattack Simulator */}
          <button
            onClick={() => handleSimulate('ddos_attack')}
            disabled={simulationLoading}
            className="p-3.5 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-left transition-all group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-rose-500 text-white">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">429 Jailed</span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">Simulate DDoS Burst</div>
            <div className="text-[11px] text-slate-500">WAF dynamic IP jail</div>
          </button>

          {/* 5. Chaos Outage / Circuit Breaker */}
          <button
            onClick={() => handleSimulate('chaos_outage')}
            disabled={simulationLoading}
            className="p-3.5 rounded-2xl border border-yellow-200/80 dark:border-yellow-900/60 bg-yellow-50/50 dark:bg-yellow-950/20 hover:bg-yellow-100/60 dark:hover:bg-yellow-950/40 text-left transition-all group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-yellow-500 text-white">
                <Flame className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold text-yellow-600 dark:text-yellow-400">Fallback</span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">Chaos Outage Test</div>
            <div className="text-[11px] text-slate-500">Circuit Breaker Cache</div>
          </button>
        </div>

        {/* Custom Route Injector Form (Collapsible) */}
        {customInjectorOpen && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                Dispatch Custom Packet to Service Mesh
              </span>
              <button 
                onClick={() => setCustomInjectorOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                value={customMethod}
                onChange={(e) => setCustomMethod(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={customRoute}
                onChange={(e) => setCustomRoute(e.target.value)}
                placeholder="/api/route"
                className="md:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold"
              />
              <button
                onClick={() => handleSimulate('custom_route', { path: customRoute, method: customMethod })}
                disabled={simulationLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Fire Packet</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Live Request Terminal Stream & Deep Packet Inspector ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Terminal Header & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Live HTTP Traffic Stream & Deep Packet Audit
              </h3>
              <p className="text-xs text-slate-500">
                Click any incoming request to inspect HTTP headers, latency waterfall, and payload.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <input
              type="text"
              value={terminalSearch}
              onChange={(e) => setTerminalSearch(e.target.value)}
              placeholder="Filter endpoint or pathogen..."
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium w-44"
            />

            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
              {['all', 'GET', 'POST', '2xx', '4xx_5xx'].map((f) => (
                <button
                  key={f}
                  onClick={() => setTerminalMethodFilter(f)}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    terminalMethodFilter === f
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>

            {/* Export Buttons */}
            <button
              onClick={() => exportLog('json')}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              title="Export as JSON"
            >
              <FileJson className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportLog('csv')}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              title="Export as CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Feed Window */}
        <div 
          className="rounded-2xl bg-[#090d16] border border-slate-800 p-3 font-mono text-xs overflow-y-auto max-h-64 space-y-1.5"
          onMouseEnter={() => setAutoScrollLocked(true)}
          onMouseLeave={() => setAutoScrollLocked(false)}
        >
          {filteredTrafficLog.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs">
              No matching request packets in current buffer.
            </div>
          ) : (
            filteredTrafficLog.map((log) => {
              const isSuccess = log.status >= 200 && log.status < 300;
              const isBlocked = log.status === 429 || log.status >= 400;

              return (
                <div
                  key={log.id}
                  onClick={() => setInspectPacket(log)}
                  className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-slate-500 text-[10px] shrink-0">{log.time}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                      log.method === 'POST' ? 'bg-amber-950 text-amber-400 border border-amber-800/60' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    }`}>
                      {log.method}
                    </span>
                    <span className="text-slate-200 font-semibold truncate group-hover:text-emerald-300 transition-colors">
                      {log.path}
                    </span>
                    <span className="text-slate-500 text-[11px] truncate hidden md:inline">
                      ({log.desc})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isSuccess 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : isBlocked 
                          ? 'bg-rose-950 text-rose-400 border border-rose-800' 
                          : 'bg-amber-950 text-amber-400'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] w-14 text-right">
                      {log.latency_ms}ms
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* ── Deep Packet Inspector Modal / Drawer ── */}
      {inspectPacket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-black ${
                  inspectPacket.method === 'POST' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {inspectPacket.method}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm truncate max-w-sm">
                  {inspectPacket.path}
                </span>
              </div>
              <button 
                onClick={() => setInspectPacket(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Latency Waterfall Breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Latency Waterfall Execution
                </span>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 font-mono">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>1. Client → WAF Gateway</span>
                    <span className="font-bold text-emerald-500">1.2 ms</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>2. WAF Token Auth & Rate Check</span>
                    <span className="font-bold text-purple-500">0.8 ms</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>3. FastAPI Controller Execution</span>
                    <span className="font-bold text-emerald-500">3.4 ms</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>4. Upstream / AI / MongoDB</span>
                    <span className="font-bold text-amber-500">
                      {Math.max(1.0, (inspectPacket.latency_ms - 5.4)).toFixed(1)} ms
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-black text-slate-900 dark:text-white">
                    <span>TOTAL ROUNDTRIP TIME</span>
                    <span className="text-sky-500">{inspectPacket.latency_ms} ms</span>
                  </div>
                </div>
              </div>

              {/* Request Headers */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Simulated HTTP Headers
                </span>
                <div className="p-3 rounded-2xl bg-[#090d16] text-slate-300 font-mono text-[11px] space-y-1">
                  <div><span className="text-purple-400">Host:</span> api.agrishield.ai:8000</div>
                  <div><span className="text-purple-400">Authorization:</span> Bearer eyJhbGciOiJIUzI1NiIsInR5c...</div>
                  <div><span className="text-purple-400">X-Forwarded-For:</span> 127.0.0.1 (Local Verified)</div>
                  <div><span className="text-purple-400">User-Agent:</span> AgriShield Mobile PWA / ESP32 Sensor v1.0</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
              <button
                onClick={() => setInspectPacket(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Node Inspector Modal / Drawer ── */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${selectedNode.color}20`, color: selectedNode.color }}
                >
                  <selectedNode.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedNode.label}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Node ID: {selectedNode.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Node Tier</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white capitalize">{selectedNode.tier}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Protocol</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">HTTP / WebSocket</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Health Watchdog</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">100% Online</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Active Connections</div>
                  <div className="text-sm font-black text-sky-500 font-mono">14 Sockets</div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Telemetry Diagnostics: </span>
                This microservice is registered in the live mesh topology. Packets arriving at this node are verified against security headers, replay nonces, and rate buckets.
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
