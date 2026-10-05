import { getLocalizedField } from '../../utils/localizationHelper';
import React, { useState, useEffect, useMemo } from 'react';
import API from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, 
  Share2, Calendar, Tag, FileText, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Download, 
  DollarSign, PieChart, Sparkles, Filter, AlertCircle,
  Clock, ShieldCheck, MapPin, Layers, Briefcase
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatINR } from '../../utils/cropEconomics';

const EXPENSE_CATEGORIES = [
  { id: 'seeds', labelEn: 'Seeds & Nursery', labelTe: 'విత్తనాలు & నర్సరీ మొలకలు', icon: '🌱', color: 'text-emerald-400' },
  { id: 'fertilizer', labelEn: 'Fertilizers & Manure', labelTe: 'ఎరువులు & సేంద్రీయ ఎరువు', icon: '🧪', color: 'text-blue-400' },
  { id: 'pesticide', labelEn: 'Pesticides & Sprays', labelTe: 'పురుగు మందులు & స్ప్రేలు', icon: '🛡️', color: 'text-amber-400' },
  { id: 'machinery', labelEn: 'Tractor, Diesel & Till', labelTe: 'ట్రాక్టర్, డీజిల్ & దుక్కి', icon: '🚜', color: 'text-orange-400' },
  { id: 'labour', labelEn: 'Labour & Weeding', labelTe: 'కూలీలు & కలుపు తీత', icon: '👥', color: 'text-purple-400' },
  { id: 'irrigation', labelEn: 'Irrigation & Electricity', labelTe: 'నీటి పారుదల & మోటార్ కరెంట్', icon: '💧', color: 'text-cyan-400' },
  { id: 'harvest', labelEn: 'Harvest & Transport', labelTe: 'కోత & మార్కెట్ రవాణా', icon: '🚛', color: 'text-yellow-400' },
  { id: 'other', labelEn: 'Miscellaneous Expense', labelTe: 'ఇతర ఖర్చులు', icon: '📦', color: 'text-slate-400' }
];

const INITIAL_EXPENSES = [
  { id: 'tx-1', type: 'expense', category: 'seeds', description: 'Tomato Hybrid Seeds (Arka Rakshak 2 packets)', amount: 2400, date: '2026-08-15', crop_name: 'Tomato', field_id: 'Field-1', payment_status: 'paid', is_estimated: False_or_bool(false) },
  { id: 'tx-2', type: 'expense', category: 'machinery', description: 'Field Plowing & Bund Formation (Tractor 4 hrs)', amount: 4800, date: '2026-08-18', crop_name: 'Tomato', field_id: 'Field-1', payment_status: 'paid', is_estimated: false },
  { id: 'tx-3', type: 'expense', category: 'fertilizer', description: 'Basal Dose: DAP (3 Bags) + MOP Potash (2 Bags)', amount: 6850, date: '2026-08-22', crop_name: 'Tomato', field_id: 'Field-1', payment_status: 'paid', is_estimated: false },
  { id: 'tx-4', type: 'expense', category: 'labour', description: 'Transplanting & Drip Line Laying (6 Labours)', amount: 3600, date: '2026-08-25', crop_name: 'Tomato', field_id: 'Field-1', payment_status: 'paid', is_estimated: false },
  { id: 'tx-5', type: 'expense', category: 'pesticide', description: 'Preventive Neem Oil + Mancozeb Spray', amount: 1850, date: '2026-09-08', crop_name: 'Tomato', field_id: 'Field-1', payment_status: 'paid', is_estimated: false }
];

function False_or_bool(val) {
  return val;
}

const INITIAL_INCOME = [
  { id: 'tx-inc-1', type: 'income', category: 'harvest', description: 'First Picking Harvest Sale (42 Crates @ ₹750/Crate)', amount: 31500, date: '2026-09-20', crop_name: 'Tomato', field_id: 'Field-1', payment_status: 'paid', is_estimated: false }
];

export default function DigitalFarmKhata({ 
  farmId,
  farmName = "My Farm", 
  acreage = 2.0, 
  cropName = "Tomato",
  village = "Pasupugallu",
  prefilledTask = null,
  onClose 
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  const storageKey = useMemo(() => farmId ? `agrishield_khata_${farmId}` : `agrishield_khata_${farmName.replace(/\s+/g, '_')}`, [farmId, farmName]);

  // Load transactions from localStorage or initial defaults
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Khata localStorage read error:", e);
    }
    return [...INITIAL_EXPENSES, ...INITIAL_INCOME];
  });

  const [analytics, setAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Load transactions and analytics from backend on mount when authenticated
  useEffect(() => {
    let isMounted = true;
    const fetchKhata = async () => {
      if (!farmId) return;
      try {
        const [resTx, resAn] = await Promise.allSettled([
          API.get(`/api/farms/${farmId}/khata`),
          API.get(`/api/farms/${farmId}/khata/analytics`)
        ]);

        if (isMounted && resTx.status === 'fulfilled') {
          const serverTx = Array.isArray(resTx.value.data) ? resTx.value.data : (resTx.value.data?.transactions || []);
          if (serverTx.length > 0) {
            const normalized = serverTx.map(t => ({
              ...t,
              id: t.id || t._id,
              is_estimated: Boolean(t.is_estimated),
              payment_status: t.payment_status || 'paid'
            }));
            setTransactions(normalized);
            try {
              localStorage.setItem(storageKey, JSON.stringify(normalized));
            } catch (_) {}
          }
        }

        if (isMounted && resAn.status === 'fulfilled' && resAn.value.data) {
          setAnalytics(resAn.value.data);
        }
      } catch (err) {
        console.warn("Could not fetch remote khata, using local cache:", err);
      }
    };
    fetchKhata();
    return () => { isMounted = false; };
  }, [farmId, storageKey]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(transactions));
    } catch (e) {
      console.warn("Khata localStorage save error:", e);
    }
  }, [transactions, storageKey]);

  // Form State
  const [showAddModal, setShowAddModal] = useState(Boolean(prefilledTask));
  const [txType, setTxType] = useState('expense'); // 'expense' or 'income'
  const [category, setCategory] = useState(prefilledTask?.category || 'fertilizer');
  const [description, setDescription] = useState(prefilledTask?.title || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(prefilledTask?.date || new Date().toISOString().split('T')[0]);
  const [isEstimated, setIsEstimated] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('paid'); // 'paid', 'unpaid', 'partial'
  const [fieldId, setFieldId] = useState('');
  const [txCropName, setTxCropName] = useState(cropName || '');
  const [season, setSeason] = useState('Kharif 2026');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [vendor, setVendor] = useState('');

  // Filtering State
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income'
  const [filterEstimate, setFilterEstimate] = useState('all'); // 'all', 'actual', 'estimated'
  const [filterPayment, setFilterPayment] = useState('all'); // 'all', 'paid', 'unpaid', 'partial'
  const [filterCategory, setFilterCategory] = useState('all');

  // Client-Side Calculations (fall-back or instant offline view)
  const clientStats = useMemo(() => {
    let totalActualExpense = 0;
    let totalActualIncome = 0;
    let estimatedExpense = 0;
    let estimatedIncome = 0;
    let unpaidAmount = 0;
    let partialAmount = 0;
    const categoryTotals = {};
    const cropTotals = {};
    const fieldTotals = {};

    transactions.forEach(tx => {
      const val = parseFloat(tx.amount) || 0;
      const isEst = Boolean(tx.is_estimated);
      const payStat = String(tx.payment_status || 'paid').toLowerCase();
      const cat = tx.category || 'other';
      const crop = tx.crop_name || (isTe ? 'కేటాయించబడలేదు' : 'Unallocated');
      const fld = tx.field_id || (isTe ? 'పొలం-స్థాయి' : 'Farm-level');

      if (isEst) {
        if (tx.type === 'income') {
          estimatedIncome += val;
        } else {
          estimatedExpense += val;
        }
      } else {
        if (tx.type === 'income') {
          totalActualIncome += val;
        } else {
          totalActualExpense += val;
          categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
          cropTotals[crop] = (cropTotals[crop] || 0) + val;
          fieldTotals[fld] = (fieldTotals[fld] || 0) + val;
          if (payStat === 'unpaid') unpaidAmount += val;
          if (payStat === 'partial') partialAmount += val;
        }
      }
    });

    const actualProfit = totalActualIncome - totalActualExpense;
    const projectedProfit = (totalActualIncome + estimatedIncome) - (totalActualExpense + estimatedExpense);
    const costPerAcre = acreage > 0 ? (totalActualExpense / acreage) : null;
    const profitPerAcre = acreage > 0 ? (actualProfit / acreage) : null;
    const roi = totalActualExpense > 0 ? ((actualProfit / totalActualExpense) * 100) : 0;

    return {
      totalActualExpense,
      totalActualIncome,
      actualProfit,
      estimatedExpense,
      estimatedIncome,
      projectedProfit,
      unpaidAmount,
      partialAmount,
      costPerAcre,
      profitPerAcre,
      roi,
      categoryTotals,
      cropTotals,
      fieldTotals
    };
  }, [transactions, acreage, isTe]);

  // Combined stats (analytics from backend preferred if fresh, fallback to client)
  const displayStats = useMemo(() => {
    if (analytics) {
      return {
        totalActualExpense: analytics.total_actual_expenses ?? clientStats.totalActualExpense,
        totalActualIncome: analytics.total_actual_income ?? clientStats.totalActualIncome,
        actualProfit: analytics.actual_profit ?? clientStats.actualProfit,
        estimatedExpense: analytics.estimated_expenses ?? clientStats.estimatedExpense,
        estimatedIncome: analytics.estimated_income ?? clientStats.estimatedIncome,
        projectedProfit: analytics.projected_profit ?? clientStats.projectedProfit,
        unpaidAmount: analytics.unpaid_amount ?? clientStats.unpaidAmount,
        partialAmount: analytics.partial_amount ?? clientStats.partialAmount,
        costPerAcre: analytics.cost_per_unit ?? clientStats.costPerAcre,
        profitPerAcre: analytics.profit_per_unit ?? clientStats.profitPerAcre,
        roi: clientStats.roi,
        categoryTotals: clientStats.categoryTotals
      };
    }
    return clientStats;
  }, [analytics, clientStats]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(tx => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterEstimate === 'actual' && tx.is_estimated) return false;
        if (filterEstimate === 'estimated' && !tx.is_estimated) return false;
        if (filterPayment !== 'all' && (tx.payment_status || 'paid') !== filterPayment) return false;
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, filterType, filterEstimate, filterPayment, filterCategory]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) return;

    const txPayload = {
      type: txType,
      category: txType === 'income' ? 'harvest' : category,
      description: description.trim(),
      amount: numAmount,
      date: date || new Date().toISOString().split('T')[0],
      field_id: fieldId.trim() || null,
      crop_name: txCropName.trim() || null,
      season: season.trim() || null,
      is_estimated: Boolean(isEstimated),
      payment_status: paymentStatus,
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit.trim() || null,
      vendor: vendor.trim() || null
    };

    let finalTx = null;
    if (farmId) {
      try {
        const res = await API.post(`/api/farms/${farmId}/khata`, txPayload);
        if (res.data) {
          finalTx = {
            ...res.data,
            id: res.data.id || res.data._id || `tx-${Date.now()}`
          };
          // Re-fetch analytics asynchronously
          API.get(`/api/farms/${farmId}/khata/analytics`)
            .then(anRes => { if (anRes.data) setAnalytics(anRes.data); })
            .catch(() => {});
        }
      } catch (err) {
        console.warn("Backend khata save failed, saving locally:", err);
      }
    }

    if (!finalTx) {
      finalTx = {
        id: `tx-${Date.now()}`,
        ...txPayload
      };
    }

    setTransactions(prev => {
      const filtered = prev.filter(tx => (tx.id || tx._id) !== finalTx.id);
      const updated = [finalTx, ...filtered];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    setDescription('');
    setAmount('');
    setQuantity('');
    setVendor('');
    setShowAddModal(false);
  };

  const handleDelete = async (id) => {
    if (farmId) {
      try {
        await API.delete(`/api/farms/${farmId}/khata/${id}`);
        API.get(`/api/farms/${farmId}/khata/analytics`)
          .then(anRes => { if (anRes.data) setAnalytics(anRes.data); })
          .catch(() => {});
      } catch (err) {
        console.warn("Backend khata delete failed, removing locally:", err);
      }
    }
    setTransactions(prev => {
      const updated = prev.filter(tx => tx.id !== id && tx._id !== id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleShareWhatsApp = () => {
    const title = isTe 
      ? `🌾 *AgriShield డిజిటల్ పొలం ఖాతా & లాభం నివేదిక (B17)*`
      : `🌾 *AgriShield Digital Farm Khata & Profit Report (B17)*`;
    
    const details = isTe
      ? `📍 *పొలం:* ${farmName} (${village})\n🌱 *పంట:* ${cropName} (${acreage} ఎకరాలు)\n📅 *తేదీ:* ${new Date().toLocaleDateString()}\n\n` +
        `🔴 *నిజమైన ఖర్చుల పెట్టుబడి:* ${formatINR(displayStats.totalActualExpense)}\n` +
        `🟢 *నిజమైన దిగుబడి రాబడి:* ${formatINR(displayStats.totalActualIncome)}\n` +
        `💰 *నికర లాభం (Actual):* ${formatINR(displayStats.actualProfit)} (${displayStats.actualProfit >= 0 ? 'లాభం' : 'నష్టం'})\n` +
        `📊 *అంచనా నికర లాభం (Projected):* ${formatINR(displayStats.projectedProfit)}\n` +
        (displayStats.unpaidAmount > 0 ? `⚠️ *చెల్లించాల్సిన బాకీలు (Unpaid):* ${formatINR(displayStats.unpaidAmount)}\n` : '') +
        (displayStats.costPerAcre ? `📈 *ఎకరాకు ఖర్చు:* ${formatINR(displayStats.costPerAcre)}/ఎకరా\n` : '') +
        `\n_AgriShield AI స్మార్ట్ వ్యవసాయ ప్లాట్‌ఫారమ్ ద్వారా రూపొందించబడింది._`
      : `📍 *Farm:* ${farmName} (${village})\n🌱 *Crop:* ${cropName} (${acreage} Acres)\n📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
        `🔴 *Actual Total Expenses:* ${formatINR(displayStats.totalActualExpense)}\n` +
        `🟢 *Actual Gross Income:* ${formatINR(displayStats.totalActualIncome)}\n` +
        `💰 *Actual Net Profit:* ${formatINR(displayStats.actualProfit)} (${displayStats.actualProfit >= 0 ? 'Net Profit' : 'Deficit'})\n` +
        `📊 *Projected Estimated Profit:* ${formatINR(displayStats.projectedProfit)}\n` +
        (displayStats.unpaidAmount > 0 ? `⚠️ *Outstanding Liabilities:* ${formatINR(displayStats.unpaidAmount)}\n` : '') +
        (displayStats.costPerAcre ? `📈 *Cost of Cultivation:* ${formatINR(displayStats.costPerAcre)}/acre\n` : '') +
        `\n_Generated via AgriShield AI Smart Farming Platform._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${title}\n\n${details}`)}`, '_blank');
  };

  return (
    <div className="rounded-3xl bg-[#060c14] border border-emerald-500/25 p-4 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isTe ? 'పొలం పాస్‌బుక్ & పెట్టుబడి మేనేజర్' : 'Farm Finance & Profit Manager'}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {farmName} · {cropName} ({acreage > 0 ? `${acreage} Acres` : 'General'})
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {isTe ? 'డిజిటల్ పొలం ఖాతా & నికర లాభం లెక్కలు' : 'Farm Expense, Income & Profit Manager'}
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Share Ledger Summary on WhatsApp"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>{isTe ? 'వాట్సాప్ నివేదిక' : 'Share WhatsApp'}</span>
          </button>

          <button
            onClick={() => {
              setIsEstimated(false);
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isTe ? '+ ఎంట్రీ జోడించు' : '+ Add Entry'}</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Spent (Actual Expenses) */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-red-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              {isTe ? 'ఖర్చుల పెట్టుబడి (SPENT)' : 'Actual Spent'}
            </span>
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400">
            {formatINR(displayStats.totalActualExpense)}
          </p>
          <p className="text-[11px] text-white/60">
            {displayStats.costPerAcre
              ? (isTe ? `ఎకరాకు ఖర్చు: ${formatINR(displayStats.costPerAcre)}/ఎకరా` : `Cost: ${formatINR(displayStats.costPerAcre)}/acre`)
              : (isTe ? 'మొత్తం నిజమైన సాగు ఖర్చులు' : 'Total verified farm outlays')}
          </p>
        </div>

        {/* Card 2: Earned (Actual Income) */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {isTe ? 'దిగుబడి రాబడి (EARNED)' : 'Actual Earned'}
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {formatINR(displayStats.totalActualIncome)}
          </p>
          <p className="text-[11px] text-white/60">
            {isTe ? 'నిర్ధారించబడిన మార్కెట్ & వ్యాపారి అమ్మకాలు' : 'Confirmed sales receipts'}
          </p>
        </div>

        {/* Card 3: Actual Net Profit */}
        <div className={`p-4 rounded-2xl bg-white/[0.03] border ${displayStats.actualProfit >= 0 ? 'border-teal-500/30' : 'border-amber-500/30'} space-y-1`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'నికర లాభం (ACTUAL PROFIT)' : 'Actual Net Profit'}
            </span>
            <TrendingUp className={`w-4 h-4 ${displayStats.actualProfit >= 0 ? 'text-teal-400' : 'text-amber-400'}`} />
          </div>
          <p className={`text-2xl font-black ${displayStats.actualProfit >= 0 ? 'text-teal-300' : 'text-amber-400'}`}>
            {displayStats.actualProfit >= 0 ? '+' : ''}{formatINR(displayStats.actualProfit)}
          </p>
          <p className="text-[11px] text-white/60">
            {displayStats.profitPerAcre != null
              ? (isTe ? `ఎకరాకు నికర మార్జిన్: ${formatINR(displayStats.profitPerAcre)}/ఎకరా` : `Margin: ${formatINR(displayStats.profitPerAcre)}/acre`)
              : (isTe ? 'రాబడి - వాస్తవ ఖర్చులు' : 'Realized net farm cashflow')}
          </p>
        </div>

        {/* Card 4: Projected Estimated Profit */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-cyan-500/25 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-black">
                {isTe ? 'అంచనా' : 'ESTIMATED'}
              </span>
              {isTe ? 'అంచనా లాభం' : 'Projected Profit'}
            </span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-cyan-300">
            {displayStats.projectedProfit >= 0 ? '+' : ''}{formatINR(displayStats.projectedProfit)}
          </p>
          <p className="text-[11px] text-white/60">
            {isTe ? 'మండి ధర × అంచనా దిగుబడి కలుపుకొని' : 'Inc. expected harvest & mandi rates'}
          </p>
        </div>
      </div>

      {/* Liabilities & Unpaid Costs Alert Strip (If Any) */}
      {(displayStats.unpaidAmount > 0 || displayStats.partialAmount > 0) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold">
                {isTe ? 'బకాయి ఉన్న ఖర్చులు:' : 'Outstanding Farm Liabilities:'}
              </span>{' '}
              <span className="text-white/80">
                {displayStats.unpaidAmount > 0 && `${isTe ? 'చెల్లించనివి' : 'Unpaid'}: ${formatINR(displayStats.unpaidAmount)}`}
                {displayStats.unpaidAmount > 0 && displayStats.partialAmount > 0 && ' · '}
                {displayStats.partialAmount > 0 && `${isTe ? 'పాక్షిక చెల్లింపు' : 'Partial'}: ${formatINR(displayStats.partialAmount)}`}
              </span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40">
            {isTe ? 'చెల్లించాల్సిన బకాయి' : 'Credit Due to Dealers/Labour'}
          </span>
        </div>
      )}

      {/* Expense Category Breakdown Pills */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
            {isTe ? 'ఖర్చుల వర్గీకరణ విశ్లేషణ' : 'Expense Category Breakdown'}
          </span>
          <span className="text-[11px] text-white/40">
            {isTe ? 'నిజమైన ఖర్చుల వాటా' : 'Actual expense percentage share'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {EXPENSE_CATEGORIES.map(cat => {
            const spent = displayStats.categoryTotals[cat.id] || 0;
            if (spent === 0) return null;
            const pct = displayStats.totalActualExpense > 0
              ? Math.round((spent / displayStats.totalActualExpense) * 100)
              : 0;
            return (
              <div
                key={cat.id}
                onClick={() => setFilterCategory(filterCategory === cat.id ? 'all' : cat.id)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs cursor-pointer transition-all ${
                  filterCategory === cat.id
                    ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                    : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07] text-white/80'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="font-medium">{getLocalizedField(cat, 'label', currentLang)}</span>
                <span className="font-bold text-white">{formatINR(spent)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 font-mono">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs & Transactions Ledger Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>{isTe ? 'లావాదేవీల పూర్తి వివరాలు' : 'Farm Financial Ledger Entries'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
              {filteredTransactions.length}
            </span>
          </h3>

          {/* Filter Pills Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter: All / Expense / Income */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                {t('common.all', 'All')}
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'expense' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-white/50 hover:text-white'
                }`}
              >
                {isTe ? 'ఖర్చులు' : 'Expenses'}
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'income' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-white/50 hover:text-white'
                }`}
              >
                {isTe ? 'రాబడి' : 'Income'}
              </button>
            </div>

            {/* Filter: Actual / Estimated */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
              <button
                onClick={() => setFilterEstimate('all')}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  filterEstimate === 'all' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                {isTe ? 'అన్నీ' : 'All Types'}
              </button>
              <button
                onClick={() => setFilterEstimate('actual')}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  filterEstimate === 'actual' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'
                }`}
              >
                {isTe ? 'వాస్తవ' : 'Actual'}
              </button>
              <button
                onClick={() => setFilterEstimate('estimated')}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  filterEstimate === 'estimated' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/50'
                }`}
              >
                {isTe ? 'అంచనా' : 'Estimated'}
              </button>
            </div>

            {/* Filter: Payment Status */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
              <button
                onClick={() => setFilterPayment('all')}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  filterPayment === 'all' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                {isTe ? 'అన్ని పేమెంట్లు' : 'All Status'}
              </button>
              <button
                onClick={() => setFilterPayment('paid')}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  filterPayment === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'
                }`}
              >
                {isTe ? 'చెల్లించినవి' : 'Paid'}
              </button>
              <button
                onClick={() => setFilterPayment('unpaid')}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  filterPayment === 'unpaid' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50'
                }`}
              >
                {isTe ? 'బాకీలు' : 'Unpaid'}
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Entries List */}
        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-white/50 space-y-1">
              <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm font-bold">{isTe ? 'ఎటువంటి ఎంట్రీలు నమోదు కాలేదు' : 'No entries found for this filter'}</p>
              <p className="text-xs text-white/40">{isTe ? 'కొత్త ఎంట్రీని నమోదు చేయడానికి "+ ఎంట్రీ జోడించు" క్లిక్ చేయండి' : 'Click "+ Add Entry" to record your first farm expense or sale.'}</p>
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const catObj = EXPENSE_CATEGORIES.find(c => c.id === tx.category) || { icon: '📦', labelEn: tx.category, labelTe: tx.category };
              const isIncome = tx.type === 'income';
              const isEst = Boolean(tx.is_estimated);
              const payStat = String(tx.payment_status || 'paid').toLowerCase();

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg shrink-0">
                      {isIncome ? '💰' : catObj.icon}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-white">{tx.description}</p>
                        {/* Actual vs Estimated Badge */}
                        {isEst ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black uppercase">
                            {isTe ? 'అంచనా' : 'ESTIMATED'}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-semibold uppercase">
                            {isTe ? 'వాస్తవ' : 'ACTUAL'}
                          </span>
                        )}

                        {/* Payment Status Badge (for expenses) */}
                        {!isIncome && payStat === 'unpaid' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            {isTe ? 'బాకీ' : 'UNPAID'}
                          </span>
                        )}
                        {!isIncome && payStat === 'partial' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold">
                            {isTe ? 'పాక్షికం' : 'PARTIAL'}
                          </span>
                        )}
                      </div>

                      {/* Attribution and Meta Row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                          {isIncome ? (isTe ? 'దిగుబడి అమ్మకం' : 'Harvest Sale') : (isTe ? catObj.labelTe : catObj.labelEn)}
                        </span>
                        {tx.field_id && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {tx.field_id}
                          </span>
                        )}
                        {tx.crop_name && (
                          <span className="text-[10px] text-teal-400">
                            🌱 {tx.crop_name}
                          </span>
                        )}
                        {tx.quantity && (
                          <span className="text-[10px] text-white/60">
                            📦 {tx.quantity} {tx.unit || 'units'}
                          </span>
                        )}
                        {tx.vendor && (
                          <span className="text-[10px] text-purple-300">
                            🏢 {tx.vendor}
                          </span>
                        )}
                        <span>·</span>
                        <span>{tx.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                    <span className={`text-base font-black ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isIncome ? '+' : '-'}{formatINR(parseFloat(tx.amount))}
                    </span>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-3xl bg-[#0c1420] border border-emerald-500/30 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-black text-white">
                  {isTe ? 'కొత్త ఆర్థిక లావాదేవీని నమోదు చేయండి' : 'Add Farm Transaction (B17)'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setTxType('expense')}
                    className={`py-2 rounded-lg transition-all cursor-pointer ${
                      txType === 'expense'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    🔴 {isTe ? 'ఖర్చు (Expense)' : 'Expense'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('income')}
                    className={`py-2 rounded-lg transition-all cursor-pointer ${
                      txType === 'income'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    🟢 {isTe ? 'రాబడి (Income)' : 'Income'}
                  </button>
                </div>

                {/* Actual vs Estimated Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setIsEstimated(false)}
                    className={`py-2 rounded-lg transition-all cursor-pointer ${
                      !isEstimated
                        ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300'
                        : 'text-white/50'
                    }`}
                  >
                    ✓ {isTe ? 'వాస్తవ లావాదేవీ (Actual)' : 'Actual Transaction'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEstimated(true)}
                    className={`py-2 rounded-lg transition-all cursor-pointer ${
                      isEstimated
                        ? 'bg-cyan-600/30 border border-cyan-500 text-cyan-300'
                        : 'text-white/50'
                    }`}
                  >
                    ✨ {isTe ? 'అంచనా / భవిష్యత్తు (Estimated)' : 'Estimated / Projection'}
                  </button>
                </div>

                {/* Category (for Expense) */}
                {txType === 'expense' && (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'ఖర్చు విభాగం' : 'Expense Category'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                          {cat.icon} {getLocalizedField(cat, 'label', currentLang)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1.5">
                    {isTe ? 'వివరణ' : 'Description'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={txType === 'income' ? 'e.g. 50 Crates sold at Addanki Mandi' : 'e.g. 2 Bags DAP Fertilizer + Transport'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1.5">
                    {isTe ? 'మొత్తం (₹ రూపాయలలో)' : 'Amount (₹ INR)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 3500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-base font-black placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                  />

                  {/* Quick Amount Buttons */}
                  <div className="flex gap-2 pt-2">
                    {[500, 1000, 2500, 5000].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(v.toString())}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-mono cursor-pointer"
                      >
                        +₹{v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date & Season Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'తేదీ' : 'Transaction Date'}
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'సీజన్' : 'Crop Season'}
                    </label>
                    <select
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Kharif 2026" className="bg-slate-900 text-white">Kharif 2026</option>
                      <option value="Rabi 2026-27" className="bg-slate-900 text-white">Rabi 2026-27</option>
                      <option value="Zaid 2026" className="bg-slate-900 text-white">Zaid 2026</option>
                      <option value="Annual" className="bg-slate-900 text-white">Annual / General</option>
                    </select>
                  </div>
                </div>

                {/* Field & Crop Attribution Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'పొలం విభాగం / ఫీల్డ్ (ఐచ్ఛికం)' : 'Field Reference (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Field-1, Plot A"
                      value={fieldId}
                      onChange={(e) => setFieldId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'పంట పేరు (ఐచ్ఛికం)' : 'Crop Name (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tomato, Chilli, Paddy"
                      value={txCropName}
                      onChange={(e) => setTxCropName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Payment Status (Only for actual expenses/income) */}
                {!isEstimated && (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'చెల్లింపు స్థితి' : 'Payment Status'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'paid', label: isTe ? 'చెల్లించబడింది' : 'Paid' },
                        { id: 'unpaid', label: isTe ? 'బాకీ (Unpaid)' : 'Unpaid' },
                        { id: 'partial', label: isTe ? 'పాక్షికం (Partial)' : 'Partial' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentStatus(opt.id)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            paymentStatus === opt.id
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Vendor & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'డీలర్ / వ్యాపారి (ఐచ్ఛికం)' : 'Dealer / Buyer / Vendor'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sri Rama Agro Agencies"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1.5">
                      {isTe ? 'పరిమాణం & యూనిట్ (ఐచ్ఛికం)' : 'Quantity & Unit (Optional)'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="e.g. 5"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-1/2 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="bags, quintals"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-1/2 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg cursor-pointer"
                  >
                    {t('common.save', 'Save Entry')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Action Button (FAB) - Clear of BottomNav */}
      <div className="sm:hidden fixed bottom-24 right-4 z-30">
        <button
          type="button"
          onClick={() => {
            setIsEstimated(false);
            setShowAddModal(true);
          }}
          aria-label={isTe ? 'ఖర్చు నమోదు చేయండి' : 'Add Expense Entry'}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-full shadow-2xl shadow-black/80 active:scale-95 transition-all border border-emerald-400/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isTe ? '+ ఎంట్రీ' : '+ Add Entry'}</span>
        </button>
      </div>
    </div>
  );
}
