import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, Truck, MapPin, Calculator, Phone, Navigation, 
  Share2, ArrowRight, DollarSign, CheckCircle2, AlertCircle, Sparkles,
  ChevronRight, Award, ShieldCheck
} from 'lucide-react';

// Representative real-world APMC Market Rates & Registered Commission Agents in AP/Telangana/South India
const REGIONAL_MANDI_NETWORK = [
  {
    id: 'guntur_apmc',
    name: 'Guntur APMC Market Yard',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    distanceKm: 24,
    traderName: 'Sri Venkateswara Commission Agency (Shop #42)',
    traderPhone: '+919848012345',
    verified: true,
    cropRates: {
      'Tomato': 3100, // per quintal
      'Red Chilli': 18500,
      'Cotton': 7400,
      'Paddy (Rice)': 2350,
      'Maize (Corn)': 2180,
      'Onion': 2800,
      'Potato': 1950,
      'Turmeric': 14200
    }
  },
  {
    id: 'vijayawada_apmc',
    name: 'Vijayawada Wholesale Agricultural Market',
    district: 'NTR / Krishna',
    state: 'Andhra Pradesh',
    distanceKm: 42,
    traderName: 'Krishna River Farmers Trading Co (Shop #18)',
    traderPhone: '+919849123456',
    verified: true,
    cropRates: {
      'Tomato': 3250,
      'Red Chilli': 18200,
      'Cotton': 7250,
      'Paddy (Rice)': 2400,
      'Maize (Corn)': 2210,
      'Onion': 2950,
      'Potato': 2050,
      'Turmeric': 14000
    }
  },
  {
    id: 'tenali_apmc',
    name: 'Tenali Town Rythu Bazaar & Mandi',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    distanceKm: 18,
    traderName: 'Tenali Agro Comm Agents (Shop #9)',
    traderPhone: '+919848567890',
    verified: true,
    cropRates: {
      'Tomato': 2650,
      'Red Chilli': 17800,
      'Cotton': 7100,
      'Paddy (Rice)': 2280,
      'Maize (Corn)': 2100,
      'Onion': 2600,
      'Potato': 1850,
      'Turmeric': 13600
    }
  },
  {
    id: 'ongole_apmc',
    name: 'Ongole APMC Market Yard',
    district: 'Prakasam',
    state: 'Andhra Pradesh',
    distanceKm: 65,
    traderName: 'Prakasam Rythu Traders (Shop #27)',
    traderPhone: '+919848901234',
    verified: true,
    cropRates: {
      'Tomato': 2900,
      'Red Chilli': 18900,
      'Cotton': 7550,
      'Paddy (Rice)': 2320,
      'Maize (Corn)': 2150,
      'Onion': 2700,
      'Potato': 1900,
      'Turmeric': 14600
    }
  },
  {
    id: 'local_village',
    name: 'Local Village Middleman / Gate Buyer',
    district: 'Local Farm Gate',
    state: 'Andhra Pradesh',
    distanceKm: 3,
    traderName: 'Village Local Trader (Farm-Gate)',
    traderPhone: '+919848112233',
    verified: false,
    cropRates: {
      'Tomato': 2200,
      'Red Chilli': 16500,
      'Cotton': 6800,
      'Paddy (Rice)': 2150,
      'Maize (Corn)': 1980,
      'Onion': 2300,
      'Potato': 1650,
      'Turmeric': 12800
    }
  }
];

const VEHICLE_TYPES = [
  { id: 'auto', name: 'Auto Rickshaw / Piaggio Ape', capacityQtl: 8, costPerKm: 9, icon: '🛺' },
  { id: 'tata_ace', name: 'Mini Truck (Tata Ace / Chota Hathi)', capacityQtl: 25, costPerKm: 14, icon: '🚚' },
  { id: 'tractor', name: 'Tractor & Trolley', capacityQtl: 60, costPerKm: 22, icon: '🚜' }
];

export default function MandiArbitrageCalculator({
  defaultCrop = 'Tomato',
  defaultQuantityQtl = 20,
  userLocationName = 'Lalapet, Guntur',
  isTelugu = false
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = isTelugu || currentLang === 'te';

  const [selectedCrop, setSelectedCrop] = useState(defaultCrop);
  const [quantityQtl, setQuantityQtl] = useState(defaultQuantityQtl);
  const [selectedVehicle, setSelectedVehicle] = useState('tata_ace');

  const activeVehicle = useMemo(() => {
    return VEHICLE_TYPES.find(v => v.id === selectedVehicle) || VEHICLE_TYPES[1];
  }, [selectedVehicle]);

  // Compute Arbitrage Comparisons across all Mandis
  const comparisonResults = useMemo(() => {
    const qtl = Math.max(1, parseFloat(quantityQtl) || 1);
    const vehicleCostPerKm = activeVehicle.costPerKm;

    const list = REGIONAL_MANDI_NETWORK.map(mandi => {
      const ratePerQtl = mandi.cropRates[selectedCrop] || 2500;
      const grossRevenue = qtl * ratePerQtl;

      // Transportation Freight Cost (Round Trip: distance * 2 * costPerKm)
      const freightCost = Math.round(mandi.distanceKm * 2 * vehicleCostPerKm);

      // Standard APMC Cess & Weighing / Loading Fee (1.5% of Gross)
      const mandiCess = mandi.id === 'local_village' ? 0 : Math.round(grossRevenue * 0.015);

      // Net In-Hand Profit
      const netProfit = grossRevenue - freightCost - mandiCess;

      return {
        ...mandi,
        ratePerQtl,
        grossRevenue,
        freightCost,
        mandiCess,
        netProfit,
        netRatePerQtl: Math.round(netProfit / qtl)
      };
    });

    // Sort by Highest Net Profit
    list.sort((a, b) => b.netProfit - a.netProfit);

    const bestMandi = list[0];
    const localMandi = list.find(m => m.id === 'local_village') || list[list.length - 1];
    const extraProfit = Math.max(0, bestMandi.netProfit - localMandi.netProfit);

    return {
      list,
      bestMandi,
      localMandi,
      extraProfit
    };
  }, [selectedCrop, quantityQtl, activeVehicle]);

  // 1-Click WhatsApp Share of Arbitrage Plan
  const handleWhatsAppShare = () => {
    const best = comparisonResults.bestMandi;
    const extra = comparisonResults.extraProfit;
    const text = isTe
      ? `💰 *అగ్రిషీల్డ్ మార్కెట్ లాభ రాడార్ (ఆర్బిట్రేజ్)* 💰\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *లొకేషన్:* ${userLocationName}\n` +
        `🌱 *పంట:* ${selectedCrop} | *పరిమాణం:* ${quantityQtl} క్వింటాళ్లు\n` +
        `🚚 *వాహనం:* ${activeVehicle.name}\n\n` +
        `🏆 *అత్యధిక లాభం ఇచ్చే మార్కెట్:*\n` +
        `• *మండీ:* ${best.name} (${best.distanceKm} km)\n` +
        `• *ధర:* ₹${best.ratePerQtl.toLocaleString('en-IN')}/క్వింటాల్\n` +
        `• *మొత్తం ఆదాయం:* ₹${best.grossRevenue.toLocaleString('en-IN')}\n` +
        `• *డీజిల్ / రవాణా:* -₹${best.freightCost.toLocaleString('en-IN')}\n` +
        `• *రైతు చేతికొచ్చే నికర లాభం:* *₹${best.netProfit.toLocaleString('en-IN')}*\n\n` +
        (extra > 0 ? `🎉 *ఊరి వ్యాపారి కన్నా ₹${extra.toLocaleString('en-IN')} అదనపు లాభం!* 🎉\n\n` : '') +
        `📞 *రిజిస్టర్డ్ ట్రేడర్:* ${best.traderName} (${best.traderPhone})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _అగ్రిషీల్డ్ స్మార్ట్ మార్కెట్ ఆర్బిట్రేజ్ ఇంజిన్._`
      : `💰 *AgriShield Market Arbitrage & Profit Radar* 💰\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Location:* ${userLocationName}\n` +
        `🌱 *Crop:* ${selectedCrop} | *Volume:* ${quantityQtl} Quintals\n` +
        `🚚 *Transport:* ${activeVehicle.name}\n\n` +
        `🏆 *HIGHEST NET PROFIT MANDI:*\n` +
        `• *Market:* ${best.name} (${best.distanceKm} km)\n` +
        `• *Price:* ₹${best.ratePerQtl.toLocaleString('en-IN')}/Qtl\n` +
        `• *Gross Revenue:* ₹${best.grossRevenue.toLocaleString('en-IN')}\n` +
        `• *Fuel/Transport Cost:* -₹${best.freightCost.toLocaleString('en-IN')}\n` +
        `• *Net Cash in Hand:* *₹${best.netProfit.toLocaleString('en-IN')}*\n\n` +
        (extra > 0 ? `🎉 *Earn +₹${extra.toLocaleString('en-IN')} MORE than selling locally!* 🎉\n\n` : '') +
        `📞 *APMC Trader Contact:* ${best.traderName} (${best.traderPhone})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _Calculated via AgriShield Smart Agro-Commerce Engine._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="w-full space-y-4">
      {/* ── ARBITRAGE CONTROL CARD ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {isTe ? 'మండీ ధరల ఆర్బిట్రేజ్ & లాభ రాడార్' : 'Mandi Price Arbitrage & Profit Radar'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isTe ? 'పక్క మండీల ధరలను పోల్చి రవాణా ఖర్చులు తీసివేసి అత్యధిక నికర లాభం లెక్కించండి' : 'Compare neighboring APMC mandis and deduct transport diesel to maximize net cash'}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isTe ? 'వాట్సాప్‌లో పంపండి' : 'Share on WhatsApp'}</span>
          </button>
        </div>

        {/* 3 Input Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Crop Selector */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {isTe ? 'పంటను ఎంచుకోండి' : '1. Target Crop'}
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-amber-500"
            >
              <option value="Tomato">🍅 Tomato (టమాట)</option>
              <option value="Red Chilli">🌶️ Red Chilli (ఎర్ర మిర్చి)</option>
              <option value="Cotton">⚪ Cotton (పత్తి)</option>
              <option value="Paddy (Rice)">🌾 Paddy / Rice (వరి)</option>
              <option value="Maize (Corn)">🌽 Maize / Corn (మొక్కజొన్న)</option>
              <option value="Onion">🧅 Onion (ఉల్లిపాయ)</option>
              <option value="Potato">🥔 Potato (బంగాళాదుంప)</option>
              <option value="Turmeric">🌿 Turmeric (పసుపు)</option>
            </select>
          </div>

          {/* 2. Quantity (Quintals) */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {isTe ? 'పంట పరిమాణం (క్వింటాళ్లు)' : '2. Harvest Volume (Quintals)'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="500"
                value={quantityQtl}
                onChange={(e) => setQuantityQtl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. 20"
              />
              <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">Qtl ({Number(quantityQtl || 0) * 100} kg)</span>
            </div>
          </div>

          {/* 3. Transport Vehicle */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {isTe ? 'రవాణా వాహనం' : '3. Transport Vehicle'}
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-amber-500"
            >
              {VEHICLE_TYPES.map(v => (
                <option key={v.id} value={v.id}>
                  {v.icon} {v.name} (₹{v.costPerKm}/km)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── BEST PROFIT ARBITRAGE RECOMMENDATION BANNER ── */}
        {comparisonResults.extraProfit > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-amber-500/15 border-2 border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30 shrink-0">
                <Award className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  {isTe ? 'గరిష్ట లాభం సిఫార్సు' : 'Maximum Profit Recommendation'}
                </span>
                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1">
                  {isTe 
                    ? `${comparisonResults.bestMandi.name} లో విక్రయిస్తే మీకు +₹${comparisonResults.extraProfit.toLocaleString('en-IN')} ఎక్కువ లాభం లభిస్తుంది!`
                    : `Sell at ${comparisonResults.bestMandi.name} to earn +₹${comparisonResults.extraProfit.toLocaleString('en-IN')} extra net cash!`}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {isTe
                    ? `రవాణా డీజిల్ ఖర్చు ₹${comparisonResults.bestMandi.freightCost.toLocaleString('en-IN')} తీసివేసిన తర్వాత కూడా ఈ నికర లాభం మిగులుతుంది.`
                    : `Even after deducting ₹${comparisonResults.bestMandi.freightCost.toLocaleString('en-IN')} round-trip fuel costs, this market gives the highest cash in hand.`}
                </p>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-emerald-500/30 sm:pl-4 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {isTe ? 'అదనపు నికర లాభం' : 'Extra In-Hand Cash'}
              </span>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                +₹{comparisonResults.extraProfit.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── MULTI-MANDI LEADERBOARD GRID ── */}
      <div className="space-y-3">
        <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider px-1 flex items-center justify-between">
          <span>{isTe ? 'పక్క మండీల ధరలు & నికర లాభం ర్యాంకింగ్' : 'Nearby Mandis Net Profit Ranking'}</span>
          <span className="text-[11px] text-slate-400 font-bold lowercase">
            {comparisonResults.list.length} {isTe ? 'మార్కెట్లు పరిశీలించబడ్డాయి' : 'markets analyzed'}
          </span>
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {comparisonResults.list.map((mandi, idx) => {
            const isWinner = idx === 0;
            const isLocal = mandi.id === 'local_village';

            return (
              <div 
                key={mandi.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isWinner 
                    ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                    : isLocal
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Mandi Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                        isWinner ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        {mandi.name}
                      </h5>
                      {isWinner && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                          🏆 {isTe ? 'అత్యధిక లాభం' : 'Top Net Profit'}
                        </span>
                      )}
                      {isLocal && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          {isTe ? 'ఊరి స్థానిక కొనుగోలుదారు' : 'Farm-Gate Buyer'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{mandi.distanceKm} km away</span> • 
                      <span>Rate: <strong className="text-slate-800 dark:text-slate-200">₹{mandi.ratePerQtl.toLocaleString('en-IN')}</strong> / Qtl</span>
                    </p>

                    {/* Trader Contact Info */}
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[240px]">
                        {mandi.traderName}
                      </span>
                      <a
                        href={`tel:${mandi.traderPhone}`}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700 ml-1 shrink-0"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{isTe ? 'కాల్ చేయి' : 'Call'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Right: Financial Math Breakdown */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {isTe ? 'డీజిల్ రవాణా ఖర్చు' : 'Transport Diesel'}
                      </span>
                      <p className="text-xs font-bold text-rose-500">
                        -₹{mandi.freightCost.toLocaleString('en-IN')}
                      </p>
                      <span className="text-[9px] text-slate-400">
                        Cess: -₹{mandi.mandiCess}
                      </span>
                    </div>

                    <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                        {isTe ? 'రైతు నికర లాభం' : 'Net Cash in Hand'}
                      </span>
                      <p className={`text-lg sm:text-xl font-black ${
                        isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        ₹{mandi.netProfit.toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] font-extrabold text-slate-500">
                        (₹{mandi.netRatePerQtl}/Qtl net)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
