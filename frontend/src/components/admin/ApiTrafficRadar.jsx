import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Cpu, 
  Database, 
  Cloud, 
  Volume2, 
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
  Eye
} from 'lucide-react';
import API from '../../services/api';
import { Card, Badge, Button } from '../ui/index';

// Node Coordinates in 1000 x 560 SVG coordinate space
const NODE_COORDS = {
  client_web: { x: 130, y: 140, label: 'Farmer Web / PWA', tier: 'client', icon: Smartphone, color: '#10b981' },
  client_iot: { x: 130, y: 400, label: 'ESP32 IoT Fleet', tier: 'client', icon: Radio, color: '#06b6d4' },
  waf: { x: 380, y: 270, label: 'Security WAF & Rate Limiter', tier: 'gateway', icon: ShieldCheck, color: '#8b5cf6' },
  core_gateway: { x: 600, y: 270, label: 'FastAPI Core (Port 8000)', tier: 'core', icon: Server, color: '#10b981' },
  ai_cluster: { x: 870, y: 110, label: 'AI Prediction Cluster', tier: 'service', icon: Cpu, color: '#f59e0b' },
  db_mongodb: { x: 870, y: 240, label: 'MongoDB Atlas Database', tier: 'service', icon: Database, color: '#3b82f6' },
  cloud_voice: { x: 870, y: 370, label: 'Studio Neural TTS (te-IN)', tier: 'external', icon: Volume2, color: '#ec4899' },
  cloud_weather: { x: 870, y: 480, label: 'Regional Weather API', tier: 'external', icon: Cloud, color: '#14b8a6' },
};

// Registered Pipeline Connections
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
  const [isPaused, setIsPaused] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simFilter, setSimFilter] = useState('all'); // 'all', 'ai', 'iot', 'cloud'
  
  // Real-time Traffic State
  const [radarData, setRadarData] = useState(null);
  const [metrics, setMetrics] = useState({
    system_health: '100% OPERATIONAL',
    throughput_rps: 38.4,
    avg_latency_ms: 16.8,
    error_rate_pct: 0.0,
    active_websockets: 4,
  });

  const [trafficLog, setTrafficLog] = useState([
    { id: 'l1', time: '12:26:01', method: 'GET', path: '/api/v1/health', status: 200, latency_ms: 4.8, from: 'client_web', to: 'core_gateway', desc: 'Heartbeat Health Probe' },
    { id: 'l2', time: '12:26:03', method: 'POST', path: '/api/v1/iot/telemetry', status: 200, latency_ms: 9.2, from: 'client_iot', to: 'db_mongodb', desc: 'ESP32 Soil Moisture (42%)' },
    { id: 'l3', time: '12:26:05', method: 'GET', path: '/api/intelligence/weather', status: 200, latency_ms: 22.4, from: 'client_web', to: 'cloud_weather', desc: 'Regional Precipitation Sync' },
    { id: 'l4', time: '12:26:08', method: 'POST', path: '/api/predict', status: 200, latency_ms: 118.0, from: 'client_web', to: 'ai_cluster', desc: 'Chilli Leaf Curl Inference' },
    { id: 'l5', time: '12:26:10', method: 'POST', path: '/api/v1/speech/synthesize', status: 200, latency_ms: 34.6, from: 'client_web', to: 'cloud_voice', desc: 'Telugu Audio Briefing (+18%)' }
  ]);

  // Animated Particles along SVG lines
  const [particles, setParticles] = useState([]);
  const particleIdRef = useRef(100);

  // Active ripples on nodes when hit
  const [ripples, setRipples] = useState({});

  const triggerRipple = useCallback((nodeKey) => {
    setRipples(prev => ({ ...prev, [nodeKey]: Date.now() }));
  }, []);

  // Fetch Live Radar Telemetry from Backend
  const fetchRadarData = useCallback(async () => {
    try {
      const res = await API.get('/api/admin/traffic/radar');
      if (res.data) {
        setRadarData(res.data);
        if (res.data.metrics) setMetrics(res.data.metrics);
        if (res.data.recent_traffic && res.data.recent_traffic.length > 0) {
          setTrafficLog(prev => {
            const incoming = res.data.recent_traffic.filter(
              inc => !prev.some(p => p.id === inc.id)
            );
            return [...incoming, ...prev].slice(0, 15);
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
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchRadarData, isPaused]);

  // Continuous Simulated Traffic Particle Stream Generator
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      // Pick random route
      const routes = [
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'ai_cluster', color: '#10b981', method: 'POST', path: '/api/predict', desc: 'Neural Scan' },
        { from: 'client_iot', to: 'waf', next: 'core_gateway', end: 'db_mongodb', color: '#06b6d4', method: 'POST', path: '/api/v1/iot/telemetry', desc: 'Soil Ping' },
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'cloud_weather', color: '#14b8a6', method: 'GET', path: '/api/weather/current', desc: 'Weather Radar' },
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'cloud_voice', color: '#ec4899', method: 'POST', path: '/api/v1/speech/synthesize', desc: 'Telugu Audio' },
        { from: 'client_web', to: 'waf', next: 'core_gateway', end: 'core_gateway', color: '#8b5cf6', method: 'GET', path: '/api/v1/health', desc: 'Liveness Check' },
      ];

      const r = routes[Math.floor(Math.random() * routes.length)];
      const pId = particleIdRef.current++;

      // Dispatch Segment 1: Client -> WAF
      setParticles(prev => [
        ...prev.slice(-18),
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
    }, 1800);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Animation Frame Loop for Flying Particles
  useEffect(() => {
    let animId;
    const animate = () => {
      setParticles(prev => {
        const nextParticles = [];
        for (const p of prev) {
          const nextProg = p.progress + 0.022; // speed factor
          if (nextProg < 1) {
            nextParticles.push({ ...p, progress: nextProg });
          } else {
            // Particle arrived at toKey! Trigger ripple
            triggerRipple(p.toKey);

            // Chain to next step if exists
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
  }, [triggerRipple]);

  // Interactive Simulation Dispatcher
  const handleSimulate = async (scenario) => {
    setSimulationLoading(true);
    try {
      let res;
      try {
        res = await API.post('/api/admin/traffic/simulate', { scenario });
      } catch {
        res = await API.post('/api/v1/admin/traffic/simulate', { scenario });
      }

      if (res.data) {
        setActiveSimulation(res.data);
        
        // Dispatch high-visibility highlighted particles
        const color = scenario === 'crop_scan' ? '#f59e0b' : scenario === 'iot_telemetry' ? '#06b6d4' : scenario === 'voice_tts' ? '#ec4899' : '#10b981';
        const startNode = scenario === 'iot_telemetry' ? 'client_iot' : 'client_web';
        const endNode = scenario === 'crop_scan' ? 'ai_cluster' : scenario === 'iot_telemetry' ? 'db_mongodb' : scenario === 'voice_tts' ? 'cloud_voice' : 'core_gateway';

        const pId = particleIdRef.current++;
        setParticles(prev => [
          ...prev,
          {
            id: `sim-${pId}`,
            fromKey: startNode,
            toKey: 'waf',
            progress: 0,
            color,
            nextStep: 'core_gateway',
            finalStep: endNode,
            method: 'SIMULATE',
            path: `/${scenario}`,
            desc: res.data.packet_id
          }
        ]);

        // Prepend to traffic log
        const timeNow = new Date().toTimeString().slice(0, 8);
        setTrafficLog(prev => [
          {
            id: `sim-log-${Date.now()}`,
            time: timeNow,
            method: 'POST',
            path: `/simulate/${scenario}`,
            status: 200,
            latency_ms: res.data.total_latency_ms,
            from: startNode,
            to: endNode,
            desc: `[SIMULATED] ${res.data.scenario} (${res.data.total_latency_ms}ms)`
          },
          ...prev
        ].slice(0, 15));
      }
    } catch (err) {
      console.error('Simulation packet dispatch failed:', err);
    } finally {
      setSimulationLoading(false);
    }
  };

  // Helper: compute cubic bezier point for curved SVG cables
  const getCubicPoint = (p0, p1, p2, p3, t) => {
    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;

    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    const xt = ax * (t * t * t) + bx * (t * t) + cx * t + p0.x;
    const yt = ay * (t * t * t) + by * (t * t) + cy * t + p0.y;

    return { x: xt, y: yt };
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Telemetry Ribbon (HUD) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-slate-900/90 border-emerald-500/40 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Status</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>100% OPERATIONAL</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Zero dropped packets • All nodes active</p>
        </Card>

        <Card className="p-4 bg-slate-900/90 border-cyan-500/40 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Throughput</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">
            {metrics.throughput_rps.toFixed(1)} <span className="text-sm font-semibold text-slate-400">Req/sec</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Client PWA & Hardware MQTT Stream</p>
        </Card>

        <Card className="p-4 bg-slate-900/90 border-amber-500/40 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mean Latency</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
            {metrics.avg_latency_ms.toFixed(1)} <span className="text-sm font-semibold text-slate-400">ms</span>
          </div>
          <p className="text-[11px] text-emerald-400 font-semibold mt-1">⚡ Ultra-Fast ASGI Response</p>
        </Card>

        <Card className="p-4 bg-slate-900/90 border-purple-500/40 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Watchdogs</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
            {metrics.active_websockets} <span className="text-sm font-semibold text-slate-400">Hardware Nodes</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Real-time WebSocket telemetry socket</p>
        </Card>
      </div>

      {/* ─── Simulation Controls Bar ─── */}
      <div className="p-4 rounded-2xl bg-slate-900/95 border-2 border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5 mr-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Packet Dispatcher:</span>
          </span>

          <button
            type="button"
            disabled={simulationLoading}
            onClick={() => handleSimulate('ping')}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>⚡ Health Ping (5ms)</span>
          </button>

          <button
            type="button"
            disabled={simulationLoading}
            onClick={() => handleSimulate('crop_scan')}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>🍂 Leaf Disease Scan (AI 115ms)</span>
          </button>

          <button
            type="button"
            disabled={simulationLoading}
            onClick={() => handleSimulate('iot_telemetry')}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>📡 IoT Soil Telemetry (12ms)</span>
          </button>

          <button
            type="button"
            disabled={simulationLoading}
            onClick={() => handleSimulate('voice_tts')}
            className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-pink-300 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Volume2 className="w-3.5 h-3.5 text-pink-400" />
            <span>🔊 Telugu Studio TTS (38ms)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPaused(prev => !prev)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isPaused 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isPaused ? 'Resume live animation' : 'Pause animation'}
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={fetchRadarData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Interactive 2D Service Mesh Topology Canvas ─── */}
      <div className="relative rounded-3xl bg-[#070d18] border-2 border-emerald-500/30 shadow-2xl p-4 sm:p-6 overflow-hidden">
        {/* Subtle Background Grid Mesh */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #10b981 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Header Badges Overlay */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-2 px-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span>AgriShield Service Mesh & Traffic Topology</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Live Radar Active
              </span>
            </h3>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-3 font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 200 OK</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" /> IoT Pulse</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> AI Inference</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pink-400" /> Neural Audio</span>
          </div>
        </div>

        {/* SVG Interactive Canvas */}
        <div className="relative w-full aspect-[1000/560] min-h-[460px]">
          <svg viewBox="0 0 1000 560" className="w-full h-full">
            <defs>
              {/* Glow Filters */}
              <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Linear Gradients for Fiber Cables */}
              <linearGradient id="grad-web-waf" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-iot-waf" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-waf-core" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="grad-core-ai" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-core-db" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-core-voice" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-core-weather" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Connecting Cables */}
            {CONNECTIONS.map(conn => {
              const src = NODE_COORDS[conn.from];
              const dst = NODE_COORDS[conn.to];
              const dx = (dst.x - src.x) * 0.5;
              const pathD = `M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${dst.x - dx} ${dst.y}, ${dst.x} ${dst.y}`;

              return (
                <g key={conn.id}>
                  {/* Background Ambient Cable Glow */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Active Gradient Pipeline */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="rgba(51, 65, 85, 0.8)"
                    strokeWidth="2.5"
                    strokeDasharray="4, 4"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* Moving Real-Time Packets / Pulses */}
            {particles.map(p => {
              const src = NODE_COORDS[p.fromKey];
              const dst = NODE_COORDS[p.toKey];
              if (!src || !dst) return null;

              const dx = (dst.x - src.x) * 0.5;
              const pt = getCubicPoint(src, { x: src.x + dx, y: src.y }, { x: dst.x - dx, y: dst.y }, dst, p.progress);

              return (
                <g key={p.id}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4.5"
                    fill={p.color}
                    filter="url(#glow-green)"
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="2"
                    fill="#ffffff"
                  />
                </g>
              );
            })}

            {/* Interactive Nodes */}
            {Object.entries(NODE_COORDS).map(([key, node]) => {
              const isSelected = selectedNode === key;
              const isRippling = ripples[key] && Date.now() - ripples[key] < 500;
              const IconComp = node.icon;

              return (
                <g 
                  key={key} 
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-transform hover:scale-105"
                  onClick={() => setSelectedNode(selectedNode === key ? null : key)}
                >
                  {/* Ripple Effect on Arrival */}
                  {isRippling && (
                    <circle
                      r="40"
                      fill="none"
                      stroke={node.color}
                      strokeWidth="2"
                      className="animate-ping opacity-60"
                    />
                  )}

                  {/* Outer Halo */}
                  <circle
                    r="32"
                    fill="#0f172a"
                    stroke={isSelected ? '#ffffff' : node.color}
                    strokeWidth={isSelected ? '3' : '2'}
                    strokeDasharray={key === 'waf' ? '4, 2' : 'none'}
                    filter="url(#glow-cyan)"
                  />

                  {/* Inner Node Circle */}
                  <circle
                    r="26"
                    fill="#1e293b"
                    stroke={node.color}
                    strokeWidth="1.5"
                  />

                  {/* Node Icon */}
                  <foreignObject x="-12" y="-12" width="24" height="24">
                    <div className="flex items-center justify-center w-full h-full text-white">
                      <IconComp className="w-5 h-5" style={{ color: node.color }} />
                    </div>
                  </foreignObject>

                  {/* Node Label Below */}
                  <text
                    x="0"
                    y="45"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="sans-serif"
                    className="select-none"
                  >
                    {node.label}
                  </text>

                  {/* Status Indicator Pill */}
                  <rect
                    x="-30"
                    y="51"
                    width="60"
                    height="14"
                    rx="7"
                    fill="rgba(15, 23, 42, 0.8)"
                    stroke="rgba(255, 255, 255, 0.15)"
                  />
                  <circle cx="-18" cy="58" r="2.5" fill={node.color} className="animate-pulse" />
                  <text
                    x="2"
                    y="62"
                    textAnchor="middle"
                    fill={node.color}
                    fontSize="8.5"
                    fontWeight="800"
                    fontFamily="sans-serif"
                  >
                    ONLINE
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ─── Node Inspector Drawer (Shown when a node is clicked) ─── */}
      {selectedNode && (
        <Card className="p-4 sm:p-5 bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center border text-white"
                style={{ backgroundColor: `${NODE_COORDS[selectedNode]?.color}20`, borderColor: NODE_COORDS[selectedNode]?.color }}
              >
                {React.createElement(NODE_COORDS[selectedNode]?.icon || Server, { className: 'w-5 h-5', style: { color: NODE_COORDS[selectedNode]?.color } })}
              </div>
              <div>
                <h4 className="text-base font-black text-white">{NODE_COORDS[selectedNode]?.label}</h4>
                <p className="text-xs text-slate-400">Node Identifier: <span className="font-mono text-cyan-400">{selectedNode}</span></p>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Status</span>
              <p className="text-sm font-black text-emerald-400 mt-0.5">● Healthy (200 OK)</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Latency</span>
              <p className="text-sm font-black text-amber-300 mt-0.5">
                {selectedNode === 'ai_cluster' ? '118.5 ms' : selectedNode === 'db_mongodb' ? '3.4 ms' : selectedNode === 'cloud_voice' ? '34.6 ms' : '2.1 ms'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Protocol</span>
              <p className="text-sm font-black text-cyan-300 mt-0.5">
                {selectedNode === 'client_iot' ? 'HTTP/MQTT Telemetry' : 'HTTP/1.1 REST & WS'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Assigned Port</span>
              <p className="text-sm font-black text-purple-300 mt-0.5">
                {selectedNode === 'core_gateway' ? 'Port 8000 (ASGI)' : selectedNode === 'client_web' ? 'Port 3000 (Vite)' : 'Internal Network'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Simulation Result Trace Breakdown ─── */}
      {activeSimulation && (
        <Card className="p-4 sm:p-5 bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                SIMULATION RESULT: {activeSimulation.scenario.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400 font-mono">Packet: {activeSimulation.packet_id}</span>
            </div>
            <span className="text-xs font-black text-emerald-400">Total Latency: {activeSimulation.total_latency_ms} ms</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeSimulation.route && activeSimulation.route.map((step, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/70 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span>Step {step.step}: {step.node}</span>
                  <span className="text-amber-400 font-mono">+{step.latency_ms}ms</span>
                </div>
                <p className="text-[11px] text-slate-400">{step.action}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Live HTTP Request Stream Ticker ─── */}
      <div className="rounded-2xl bg-[#090d16] border border-slate-800 shadow-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Live API Traffic Stream Ticker</h4>
          </div>
          <span className="text-[10px] text-slate-400">Showing last 15 inbound requests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                <th className="pb-2">Time</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Endpoint</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Latency</th>
                <th className="pb-2">Route Path</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {trafficLog.map(item => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 text-slate-400">{item.time}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                      item.method === 'GET' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                      item.method === 'POST' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {item.method}
                    </span>
                  </td>
                  <td className="py-2 text-slate-200 font-semibold">{item.path}</td>
                  <td className="py-2">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {item.status} OK
                    </span>
                  </td>
                  <td className="py-2 text-amber-300 font-bold">{item.latency_ms.toFixed(1)}ms</td>
                  <td className="py-2 text-slate-400 text-[11px]">
                    <span className="text-slate-300">{item.from}</span>
                    <span className="text-emerald-400 mx-1">──▶</span>
                    <span className="text-slate-300">{item.to}</span>
                  </td>
                  <td className="py-2 text-slate-400 text-[11px] truncate max-w-[200px]">{item.desc || 'Standard API route'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
