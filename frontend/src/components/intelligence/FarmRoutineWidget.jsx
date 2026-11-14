import React, { useState, useEffect } from 'react';
import { Sunrise, Sun, Sunset, Moon, Clock, CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const FarmRoutineWidget = () => {
  const { i18n } = useTranslation();
  const isTe = (i18n?.language || 'en').startsWith('te');
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  const routines = [
    {
      id: 'morning',
      title: isTe ? 'ఉదయం తనిఖీ & మోటార్' : 'Morning Check & Irrigation',
      time: '06:00 - 09:00',
      start: 6,
      end: 9,
      icon: Sunrise,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-300 dark:border-amber-800',
      desc: isTe ? 'ఎండ తీవ్రత పెరగకముందే నేల తేమ చూసి డ్రిప్ నీరు అందించండి.' : 'Check soil moisture & run early drip irrigation before peak heat.'
    },
    {
      id: 'day',
      title: isTe ? 'మధ్యాహ్నం పంట రక్షణ' : 'Daytime Crop Care',
      time: '09:00 - 17:00',
      start: 9,
      end: 17,
      icon: Sun,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-300 dark:border-emerald-800',
      desc: isTe ? 'ఎండ వేడిమి ప్రభావం పరిశీలించండి; మధ్యాహ్నం స్ప్రేలు నివారించండి.' : 'Monitor midday crop hydration; avoid foliar spraying under intense sun.'
    },
    {
      id: 'evening',
      title: isTe ? 'సాయంత్రం స్ప్రే సమయం' : 'Evening Spray & Field Review',
      time: '17:00 - 20:00',
      start: 17,
      end: 20,
      icon: Sunset,
      color: 'text-teal-500',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      border: 'border-teal-300 dark:border-teal-800',
      desc: isTe ? 'పురుగు మందులు, టానిక్ స్ప్రేకు అనుకూల సమయం & రోజువారీ పని ముగింపు.' : 'Optimal safe foliar spray window & review of daily farm tasks.'
    },
    {
      id: 'night',
      title: isTe ? 'రాత్రి విశ్రాంతి సమయం' : 'Night Rest & Motor Timing',
      time: '20:00 - 06:00',
      start: 20,
      end: 6, // Wraps around
      icon: Moon,
      color: 'text-sky-500',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      border: 'border-sky-300 dark:border-sky-800',
      desc: isTe ? 'మంచు కురిసే సమయం; అవసరమైతే షెడ్యూల్డ్ రాత్రి మోటార్ నీరు.' : 'Plants rest with condensing dew; scheduled nocturnal motor running.'
    }
  ];

  const getActiveRoutine = () => {
    return routines.find(r => {
      if (r.start < r.end) {
        return currentHour >= r.start && currentHour < r.end;
      } else {
        // Nighttime wrap around (e.g. 20 to 6)
        return currentHour >= r.start || currentHour < r.end;
      }
    }) || routines[0];
  };

  const activeRoutine = getActiveRoutine();

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 flex flex-col justify-between h-full"
    >
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {isTe ? 'రోజువారీ పొలం దినచర్య & షెడ్యూల్' : 'Daily Farm Routine & Schedule'}
          </h3>
        </div>
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Timeline Layout */}
      <div className="flex flex-col gap-3 relative">
        {/* Vertical line connecting the steps */}
        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 z-0"></div>

        {routines.map((routine) => {
          const isActive = activeRoutine.id === routine.id;
          const isPast = (routine.start < activeRoutine.start && activeRoutine.start < 20) || 
                         (activeRoutine.id === 'night' && routine.id !== 'night');
          
          const Icon = routine.icon;

          return (
            <div key={routine.id} className={`relative z-10 flex gap-4 p-3.5 rounded-2xl transition-all duration-300 ${isActive ? `border-2 ${routine.bg} ${routine.border}` : 'border border-transparent opacity-65'}`}>
              
              <div className="flex flex-col items-center justify-center mt-1">
                {isActive ? (
                  <div className="relative flex h-4 w-4">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${routine.color.replace('text', 'bg')}`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 ${routine.color.replace('text', 'bg')} border-2 border-white dark:border-slate-900`}></span>
                  </div>
                ) : isPast ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 bg-white dark:bg-slate-900 rounded-full" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-700 bg-white dark:bg-slate-900 rounded-full" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? routine.color : 'text-slate-400'}`} />
                    <span className={`text-xs sm:text-sm font-black truncate ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                      {routine.title}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold shrink-0 ${isActive ? routine.color : 'text-slate-400'}`}>
                    {routine.time}
                  </span>
                </div>
                {isActive && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {routine.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default FarmRoutineWidget;
