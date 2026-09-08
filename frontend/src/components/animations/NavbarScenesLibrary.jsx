import React from 'react';

// ==========================================
// CATEGORY 1: Realistic Agriculture (Normal)
// ==========================================
export const TractorPlowing = () => (
  <div className="absolute inset-0 bg-sky-100 dark:bg-slate-900 overflow-hidden">
    {/* Ground */}
    <div className="absolute bottom-0 w-full h-1/3 bg-amber-700/80 dark:bg-amber-900/80 rounded-t-lg" />
    <div className="absolute bottom-0 w-full h-1 bg-amber-800/90 dark:bg-amber-950/90 anim-tractor-drive-slow" />
    
    {/* Sun */}
    <div className="absolute top-2 right-4 w-6 h-6 bg-yellow-400 rounded-full blur-[2px] anim-pulse-slow" />
    
    {/* Tractor SVG */}
    <svg className="absolute bottom-1 w-12 h-8 anim-tractor-drive" viewBox="0 0 64 48">
      <path d="M10,20 L30,20 L35,30 L50,30 L55,40 L10,40 Z" fill="#dc2626" />
      <circle cx="15" cy="40" r="6" fill="#1e293b" className="anim-spin-fast" />
      <circle cx="45" cy="40" r="8" fill="#1e293b" className="anim-spin-fast" />
      <rect x="25" y="10" w="5" h="10" fill="#94a3b8" />
    </svg>
    {/* Exhaust */}
    <div className="absolute bottom-6 left-[30%] w-2 h-2 bg-slate-400/50 rounded-full blur-sm anim-exhaust" />
  </div>
);

export const AgriDrone = () => (
  <div className="absolute inset-0 bg-blue-50 dark:bg-slate-950 overflow-hidden">
    <div className="absolute bottom-0 w-full h-1/4 bg-emerald-500/30 dark:bg-emerald-900/30" />
    {/* Drone */}
    <div className="absolute top-2 anim-drone-hover">
      <svg className="w-10 h-8" viewBox="0 0 40 30">
        <rect x="10" y="10" width="20" height="6" rx="2" fill="#64748b" />
        <rect x="5" y="8" width="8" height="2" fill="#94a3b8" className="anim-propeller" />
        <rect x="27" y="8" width="8" height="2" fill="#94a3b8" className="anim-propeller-rev" />
        <path d="M20,16 L15,30 L25,30 Z" fill="rgba(16, 185, 129, 0.4)" className="anim-laser-pulse" />
      </svg>
    </div>
  </div>
);

export const SmartSprinklers = () => (
  <div className="absolute inset-0 bg-sky-50 dark:bg-slate-900 overflow-hidden">
    <div className="absolute bottom-0 w-full h-1/3 bg-emerald-600/80 dark:bg-emerald-900/80 rounded-t-lg" />
    {/* Sprinkler 1 */}
    <div className="absolute bottom-2 left-1/4 w-2 h-4 bg-slate-400" />
    <svg className="absolute bottom-6 left-[15%] w-16 h-16 anim-water-arc" viewBox="0 0 60 60" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4">
      <path d="M30,30 Q10,10 0,30" />
      <path d="M30,30 Q50,10 60,30" />
    </svg>
    {/* Sprinkler 2 */}
    <div className="absolute bottom-2 left-3/4 w-2 h-4 bg-slate-400" />
    <svg className="absolute bottom-6 left-[65%] w-16 h-16 anim-water-arc-rev" viewBox="0 0 60 60" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4">
      <path d="M30,30 Q10,10 0,30" />
      <path d="M30,30 Q50,10 60,30" />
    </svg>
  </div>
);

export const Greenhouse = () => (
  <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-end justify-center">
    <div className="w-4/5 h-4/5 border-4 border-slate-300 dark:border-slate-700 rounded-t-2xl relative bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 w-full h-full flex justify-around opacity-30">
        <div className="w-px h-full bg-slate-400 dark:bg-slate-600" />
        <div className="w-px h-full bg-slate-400 dark:bg-slate-600" />
        <div className="w-px h-full bg-slate-400 dark:bg-slate-600" />
      </div>
      <div className="absolute bottom-0 w-full flex justify-around px-2">
        <div className="w-4 h-8 bg-emerald-500 rounded-t-full anim-grow" style={{animationDelay: '0s'}} />
        <div className="w-4 h-10 bg-emerald-400 rounded-t-full anim-grow" style={{animationDelay: '1s'}} />
        <div className="w-4 h-6 bg-emerald-600 rounded-t-full anim-grow" style={{animationDelay: '0.5s'}} />
      </div>
      {/* Grow lights */}
      <div className="absolute top-0 w-full h-4 bg-fuchsia-500/20 blur-md anim-pulse-slow" />
    </div>
  </div>
);

export const SolarFarm = () => (
  <div className="absolute inset-0 bg-amber-50 dark:bg-slate-900 overflow-hidden">
    <div className="absolute bottom-0 w-full h-1/3 bg-amber-800/80 dark:bg-slate-800/80" />
    <div className="absolute top-1 right-8 w-8 h-8 bg-orange-400 rounded-full blur-[4px] anim-pulse-slow" />
    <div className="absolute bottom-2 flex w-full justify-around px-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="w-10 h-6 bg-blue-600 border border-blue-400 transform -skew-x-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white/30 anim-glint" style={{animationDelay: `${i*0.5}s`}} />
        </div>
      ))}
    </div>
  </div>
);

// ==========================================
// CATEGORY 2: Weather & Seasons (Normal)
// ==========================================
export const RainyDay = () => (
  <div className="absolute inset-0 bg-slate-800 overflow-hidden">
    <div className="absolute inset-0 anim-rain opacity-50 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.8)_0%,transparent_10%)] bg-[length:10px_10px]" />
    <div className="absolute top-0 w-full h-8 bg-slate-700/80 blur-md" />
  </div>
);

export const SnowyWinter = () => (
  <div className="absolute inset-0 bg-slate-900 overflow-hidden">
    {[...Array(20)].map((_, i) => (
      <div key={i} className="absolute w-1 h-1 bg-white rounded-full anim-snow" 
           style={{left: `${Math.random()*100}%`, animationDuration: `${3+Math.random()*2}s`, animationDelay: `-${Math.random()*5}s`}} />
    ))}
    <div className="absolute bottom-0 w-full h-4 bg-white/80 rounded-t-lg" />
  </div>
);

export const Thunderstorm = () => (
  <div className="absolute inset-0 bg-slate-900 overflow-hidden anim-lightning">
    <div className="absolute inset-0 anim-rain opacity-60 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.8)_0%,transparent_10%)] bg-[length:8px_8px]" />
    <div className="absolute top-0 w-full h-10 bg-slate-800/90 blur-md" />
    <svg className="absolute top-4 left-1/3 w-8 h-8 anim-bolt opacity-0" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M13,2 L3,14 L12,14 L11,22 L21,10 L12,10 Z" />
    </svg>
  </div>
);

export const AutumnHarvest = () => (
  <div className="absolute inset-0 bg-orange-50 dark:bg-slate-900 overflow-hidden">
    <div className="absolute bottom-0 w-full h-1/4 bg-orange-800/60" />
    {[...Array(8)].map((_, i) => (
      <svg key={i} className="absolute w-3 h-3 anim-leaf-fall" viewBox="0 0 24 24" fill={i%2===0 ? "#ea580c" : "#ca8a04"} 
           style={{left: `${Math.random()*100}%`, animationDuration: `${4+Math.random()*3}s`, animationDelay: `-${Math.random()*5}s`}}>
        <path d="M12,2 C12,2 22,8 22,15 C22,19 18,22 12,22 C6,22 2,19 2,15 C2,8 12,2 12,2 Z" />
      </svg>
    ))}
  </div>
);

export const MistyMorning = () => (
  <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 overflow-hidden">
    <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40" />
    <div className="absolute bottom-0 w-[200%] h-full bg-gradient-to-t from-white/80 via-white/40 to-transparent dark:from-slate-400/30 dark:via-slate-500/10 anim-fog" />
    <div className="absolute bottom-0 w-[200%] h-full bg-gradient-to-t from-white/60 via-white/20 to-transparent dark:from-slate-300/20 dark:via-slate-400/10 anim-fog-slow" />
  </div>
);


// ==========================================
// CATEGORY 3: Abstract & Data (Premium)
// ==========================================
export const NeuralNetwork = () => (
  <div className="absolute inset-0 bg-slate-900 overflow-hidden">
    <svg className="absolute w-full h-full opacity-50" viewBox="0 0 200 40">
      <path d="M20,10 L80,30 L140,5 L190,20 M80,30 L100,10 L140,5 M40,25 L100,10" stroke="#38bdf8" strokeWidth="0.5" fill="none" className="anim-pulse-lines" />
      {[20,80,140,190,100,40].map((cx, i) => (
        <circle key={i} cx={cx} cy={[10,30,5,20,10,25][i]} r="1.5" fill="#0ea5e9" className="anim-pulse-slow" style={{animationDelay: `${i*0.5}s`}} />
      ))}
    </svg>
  </div>
);

export const DigitalTwinGrid = () => (
  <div className="absolute inset-0 bg-[#0a0a0a] overflow-hidden" style={{perspective: '200px'}}>
    <div className="absolute bottom-[-20%] w-[150%] h-[150%] left-[-25%] bg-[linear-gradient(rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[length:20px_20px] transform rotateX-[75deg] anim-grid-fly" />
    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-transparent" />
  </div>
);

export const MinimalistRadar = () => (
  <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
    <div className="w-40 h-40 rounded-full border border-emerald-500/20 flex items-center justify-center">
      <div className="absolute w-20 h-20 rounded-full border border-emerald-500/30" />
      <div className="absolute w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
      <div className="absolute w-40 h-40 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,rgba(16,185,129,0.4)_100%)] anim-radar-sweep" />
    </div>
  </div>
);

export const DataStream = () => (
  <div className="absolute inset-0 bg-black overflow-hidden flex gap-2 justify-between px-4">
    {[...Array(15)].map((_, i) => (
      <div key={i} className="w-0.5 h-10 bg-gradient-to-b from-transparent via-cyan-400 to-transparent opacity-0 anim-data-stream" style={{animationDelay: `${Math.random()*2}s`, animationDuration: `${0.5 + Math.random()}s`}} />
    ))}
  </div>
);

export const BiometricPulse = () => (
  <div className="absolute inset-0 bg-slate-950 flex items-center overflow-hidden">
    <svg className="w-full h-full opacity-80" viewBox="0 0 200 40" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-50,20 L50,20 L60,5 L70,35 L80,15 L90,20 L250,20" className="anim-ekg-pulse" />
    </svg>
  </div>
);


// ==========================================
// CATEGORY 4: UI & Mesh Gradients (Premium)
// ==========================================
export const AuroraBorealis = () => (
  <div className="absolute inset-0 bg-slate-950 overflow-hidden">
    <div className="absolute top-[-50%] left-[-20%] w-[150%] h-[200%] bg-[conic-gradient(from_90deg_at_50%_50%,#020617_0%,#10b981_50%,#020617_100%)] opacity-40 mix-blend-screen blur-[20px] md:blur-[40px] anim-spin-slow" />
    <div className="absolute top-0 right-[-30%] w-[100%] h-[150%] bg-[conic-gradient(from_180deg_at_50%_50%,#020617_0%,#0ea5e9_50%,#020617_100%)] opacity-30 mix-blend-screen blur-[30px] md:blur-[50px] anim-spin-reverse-slow" />
  </div>
);

export const LiquidChrome = () => (
  <div className="absolute inset-0 bg-slate-800 dark:bg-slate-900 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(148,163,184,0.4),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.8),transparent_50%)] blur-xl" />
    <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[linear-gradient(45deg,transparent_20%,rgba(255,255,255,0.1)_50%,transparent_80%)] opacity-60 anim-shine mix-blend-overlay" />
  </div>
);

export const GlassmorphicOrbs = () => (
  <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
    <div className="absolute w-12 h-12 bg-emerald-500 rounded-full mix-blend-screen filter blur-[15px] opacity-70 anim-orb-1" />
    <div className="absolute w-16 h-16 bg-cyan-500 rounded-full mix-blend-screen filter blur-[20px] opacity-70 anim-orb-2" />
    <div className="absolute w-10 h-10 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[15px] opacity-70 anim-orb-3" />
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
  </div>
);

export const AbyssalBlue = () => (
  <div className="absolute inset-0 bg-slate-950 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_150%,#0369a1_0%,transparent_60%)] opacity-50" />
    <div className="absolute top-0 w-[200%] h-[200%] left-[-50%] bg-[linear-gradient(180deg,rgba(14,165,233,0.15)_0%,transparent_100%)] anim-ocean-rays transform-gpu" />
  </div>
);

export const CinematicDeepSpace = () => (
  <div className="absolute inset-0 bg-[#050505] overflow-hidden perspective-[1000px]">
    {[...Array(30)].map((_, i) => (
      <div key={i} className="absolute w-[1px] h-[1px] bg-white rounded-full anim-star-zoom" 
           style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDelay: `${Math.random()*3}s`, opacity: Math.random() }} />
    ))}
  </div>
);


// ==========================================
// CATEGORY 5: Dark Mode & Vibrant (Premium)
// ==========================================
export const VercelDark = () => (
  <div className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center">
    <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent anim-vercel-sweep" />
  </div>
);

export const NeonEdge = () => (
  <div className="absolute inset-0 bg-[#0a0a0a] overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent anim-neon-edge-top" />
    <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-transparent via-fuchsia-400 to-transparent anim-neon-edge-bottom" />
  </div>
);

export const CarbonFiber = () => (
  <div className="absolute inset-0 bg-[#111] overflow-hidden">
    <div className="absolute w-[200%] h-[200%] bg-[linear-gradient(45deg,#1a1a1a_25%,transparent_25%,transparent_75%,#1a1a1a_75%,#1a1a1a),linear-gradient(45deg,#1a1a1a_25%,transparent_25%,transparent_75%,#1a1a1a_75%,#1a1a1a)] bg-[length:10px_10px] bg-[position:0_0,5px_5px] opacity-70 anim-carbon-shift" />
  </div>
);

export const HyperSpeed = () => (
  <div className="absolute inset-0 bg-slate-900 overflow-hidden transform -skew-x-12 scale-110">
    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_20%,rgba(99,102,241,0.3)_50%,transparent_80%)] bg-[length:200%_100%] anim-hyperspeed" />
    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_40%,rgba(236,72,153,0.3)_50%,transparent_60%)] bg-[length:150%_100%] anim-hyperspeed-fast" />
  </div>
);

export const SonicWave = () => (
  <div className="absolute inset-0 bg-[#020617] flex items-center justify-center gap-[2px] overflow-hidden">
    {[...Array(15)].map((_, i) => (
      <div key={i} className="w-[2px] bg-cyan-400/80 rounded-full anim-sonic-bar" style={{height: `${10+Math.random()*20}px`, animationDelay: `${Math.random()*0.5}s`}} />
    ))}
  </div>
);


// ==========================================
// CATEGORY: Role-Based Welcome Scenes (101-103)
// ==========================================

export const WelcomeFarmer = ({ isCompact = false }) => {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const h = time.getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  return (
    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-300/20 rounded-full blur-xl anim-orb-1" />
      <div className="flex items-center gap-2 md:gap-3 z-10">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 0-4 4c0 2 4 3 4 3s4-1 4-3a4 4 0 0 0-4-4z" />
          <path d="M12 9c-4 0-8 2-8 6v1h16v-1c0-4-4-6-8-6z" />
          <path d="M6 18v2h12v-2" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] md:text-[10px] text-white/70 font-medium tracking-widest uppercase">{greeting}</span>
          <span className="text-xs md:text-sm font-extrabold text-white tracking-wide">
            {isCompact ? 'FARMER' : 'WELCOME, FARMER'}
          </span>
        </div>
        {!isCompact && (
          <div className="ml-3 pl-3 border-l border-white/30 flex flex-col leading-none">
            <span className="text-[10px] text-white/70 font-medium tracking-wider uppercase">{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="text-sm font-bold text-white tabular-nums tracking-wider">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const WelcomeAdmin = ({ isCompact = false }) => {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const h = time.getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  return (
    <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-violet-600 to-purple-600 overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-fuchsia-400/20 rounded-full blur-xl anim-orb-2" />
      <div className="flex items-center gap-2 md:gap-3 z-10">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15l-2 5h4l-2-5z" />
          <path d="M5 7h14l-1.5 4H6.5L5 7z" />
          <circle cx="12" cy="4" r="2" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] md:text-[10px] text-white/70 font-medium tracking-widest uppercase">{greeting}</span>
          <span className="text-xs md:text-sm font-extrabold text-white tracking-wide">
            {isCompact ? 'ADMIN' : 'WELCOME, ADMIN'}
          </span>
        </div>
        {!isCompact && (
          <div className="ml-3 pl-3 border-l border-white/30 flex flex-col leading-none">
            <span className="text-[10px] text-white/70 font-medium tracking-wider uppercase">{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="text-sm font-bold text-white tabular-nums tracking-wider">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const WelcomeTester = ({ isCompact = false }) => {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const h = time.getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  return (
    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-500 overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
      <div className="absolute top-0 left-1/2 w-16 h-16 bg-cyan-300/20 rounded-full blur-xl anim-orb-3" />
      <div className="flex items-center gap-2 md:gap-3 z-10">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] md:text-[10px] text-white/70 font-medium tracking-widest uppercase">{greeting}</span>
          <span className="text-xs md:text-sm font-extrabold text-white tracking-wide">
            {isCompact ? 'TESTER' : 'WELCOME, TESTER'}
          </span>
        </div>
        {!isCompact && (
          <div className="ml-3 pl-3 border-l border-white/30 flex flex-col leading-none">
            <span className="text-[10px] text-white/70 font-medium tracking-wider uppercase">{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="text-sm font-bold text-white tabular-nums tracking-wider">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>
        )}
      </div>
    </div>
  );
};
