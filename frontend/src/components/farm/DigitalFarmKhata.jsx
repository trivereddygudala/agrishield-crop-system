import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, 
  Share2, Calendar, Tag, FileText, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Download, 
  DollarSign, PieChart, Sparkles, Filter, AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  { id: 'tx-1', type: 'expense', category: 'seeds', description: 'Tomato Hybrid Seeds (Arka Rakshak 2 packets)', amount: 2400, date: '2026-08-15' },
  { id: 'tx-2', type: 'expense', category: 'machinery', description: 'Field Plowing & Bund Formation (Tractor 4 hrs)', amount: 4800, date: '2026-08-18' },
  { id: 'tx-3', type: 'expense', category: 'fertilizer', description: 'Basal Dose: DAP (3 Bags) + MOP Potash (2 Bags)', amount: 6850, date: '2026-08-22' },
  { id: 'tx-4', type: 'expense', category: 'labour', description: 'Transplanting & Drip Line Laying (6 Labours)', amount: 3600, date: '2026-08-25' },
  { id: 'tx-5', type: 'expense', category: 'pesticide', description: 'Preventive Neem Oil + Mancozeb Spray', amount: 1850, date: '2026-09-08' }
];

const INITIAL_INCOME = [
  { id: 'tx-inc-1', type: 'income', category: 'harvest', description: 'First Picking Harvest Sale (42 Crates @ ₹750/Crate)', amount: 31500, date: '2026-09-20' }
];

export default function DigitalFarmKhata({ 
  farmName = "My Farm", 
  acreage = 2.0, 
  cropName = "Tomato",
  village = "Pasupugallu",
  onClose 
}) {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';

  const storageKey = useMemo(() => `agrishield_khata_${farmName.replace(/\s+/g, '_')}`, [farmName]);

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

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(transactions));
    } catch (e) {
      console.warn("Khata localStorage save error:", e);
    }
  }, [transactions, storageKey]);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [txType, setTxType] = useState('expense'); // 'expense' or 'income'
  const [category, setCategory] = useState('fertilizer');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income'

  // Calculations
  const stats = useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    const categoryTotals = {};

    transactions.forEach(tx => {
      const val = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') {
        totalIncome += val;
      } else {
        totalExpense += val;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + val;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const costPerAcre = acreage > 0 ? (totalExpense / acreage) : totalExpense;
    const profitPerAcre = acreage > 0 ? (netProfit / acreage) : netProfit;
    const roi = totalExpense > 0 ? ((netProfit / totalExpense) * 100) : 0;

    return { totalExpense, totalIncome, netProfit, costPerAcre, profitPerAcre, roi, categoryTotals };
  }, [transactions, acreage]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(tx => filterType === 'all' || tx.type === filterType)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, filterType]);

  const handleAddTransaction = (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) return;

    const newTx = {
      id: `tx-${Date.now()}`,
      type: txType,
      category: txType === 'income' ? 'harvest' : category,
      description: description.trim(),
      amount: numAmount,
      date: date || new Date().toISOString().split('T')[0]
    };

    setTransactions(prev => [newTx, ...prev]);
    setDescription('');
    setAmount('');
    setShowAddModal(false);
  };

  const handleDelete = (id) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const handleShareWhatsApp = () => {
    const title = isTe 
      ? `🌾 *AgriShield డిజిటల్ పొలం ఖాతా & లాభం నివేదిక*`
      : `🌾 *AgriShield Digital Farm Khata & Profit Report*`;
    
    const details = isTe
      ? `📍 *పొలం:* ${farmName} (${village})\n🌱 *పంట:* ${cropName} (${acreage} ఎకరాలు)\n📅 *తేదీ:* ${new Date().toLocaleDateString()}\n\n` +
        `🔴 *మొత్తం ఖర్చుల పెట్టుబడి:* ₹${stats.totalExpense.toLocaleString('en-IN')}\n` +
        `🟢 *దిగుబడి అమ్మకం రాబడి:* ₹${stats.totalIncome.toLocaleString('en-IN')}\n` +
        `💰 *నికర లాభం:* ₹${stats.netProfit.toLocaleString('en-IN')} (${stats.netProfit >= 0 ? 'లాభం' : 'నష్టం'})\n` +
        `📊 *ఎకరాకు పెట్టుబడి:* ₹${Math.round(stats.costPerAcre).toLocaleString('en-IN')}/ఎకరా\n` +
        `📈 *ఎకరాకు నికర లాభం:* ₹${Math.round(stats.profitPerAcre).toLocaleString('en-IN')}/ఎకరా\n\n` +
        `_AgriShield AI స్మార్ట్ వ్యవసాయ ప్లాట్‌ఫారమ్ ద్వారా రూపొందించబడింది._`
      : `📍 *Farm:* ${farmName} (${village})\n🌱 *Crop:* ${cropName} (${acreage} Acres)\n📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
        `🔴 *Total Cultivation Investment:* ₹${stats.totalExpense.toLocaleString('en-IN')}\n` +
        `🟢 *Harvest Gross Revenue:* ₹${stats.totalIncome.toLocaleString('en-IN')}\n` +
        `💰 *Net Farm Profit:* ₹${stats.netProfit.toLocaleString('en-IN')} (${stats.netProfit >= 0 ? 'Net Profit' : 'Deficit'})\n` +
        `📊 *Cost of Cultivation/Acre:* ₹${Math.round(stats.costPerAcre).toLocaleString('en-IN')}/acre\n` +
        `📈 *Net Margin/Acre:* ₹${Math.round(stats.profitPerAcre).toLocaleString('en-IN')}/acre\n\n` +
        `_Generated via AgriShield AI Smart Farming Platform._`;

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
                {isTe ? 'పొలం పాస్‌బుక్ & పెట్టుబడి' : 'Farm Passbook & Ledger'}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {farmName} · {cropName} ({acreage} Acres)
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {isTe ? 'డిజిటల్ పొలం ఖాతా & నికర లాభం లెక్కలు' : 'Digital Farm Khata & Profit Calculator'}
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
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isTe ? '+ ఎంట్రీ జోడించు' : '+ Add Entry'}</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Investment */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-red-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'మొత్తం ఖర్చుల పెట్టుబడి' : 'Total Cultivation Cost'}
            </span>
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400">
            ₹{stats.totalExpense.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-white/60">
            {isTe ? `ఎకరాకు ఖర్చు: ₹${Math.round(stats.costPerAcre).toLocaleString('en-IN')}` : `Cost: ₹${Math.round(stats.costPerAcre).toLocaleString('en-IN')} / acre`}
          </p>
        </div>

        {/* Card 2: Total Income */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'దిగుబడి అమ్మకం రాబడి' : 'Gross Harvest Revenue'}
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            ₹{stats.totalIncome.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-white/60">
            {isTe ? 'మార్కెట్ యార్డ్ & వ్యాపారుల అమ్మకాలు' : 'Direct mandi & trader sales'}
          </p>
        </div>

        {/* Card 3: Net Profit */}
        <div className={`p-4 rounded-2xl bg-white/[0.03] border ${stats.netProfit >= 0 ? 'border-teal-500/30' : 'border-amber-500/30'} space-y-1`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'రైతు నికర లాభం' : 'Net Farmer Profit'}
            </span>
            <TrendingUp className={`w-4 h-4 ${stats.netProfit >= 0 ? 'text-teal-400' : 'text-amber-400'}`} />
          </div>
          <p className={`text-2xl font-black ${stats.netProfit >= 0 ? 'text-teal-300' : 'text-amber-400'}`}>
            {stats.netProfit >= 0 ? '+' : ''}₹{stats.netProfit.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-white/60">
            {isTe 
              ? `ఎకరాకు నికర లాభం: ₹${Math.round(stats.profitPerAcre).toLocaleString('en-IN')}`
              : `Margin: ₹${Math.round(stats.profitPerAcre).toLocaleString('en-IN')} / acre`}
          </p>
        </div>

        {/* Card 4: ROI */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-purple-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'పెట్టుబడిపై లాభ శాతము (ROI)' : 'Return on Investment'}
            </span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-300">
            {stats.roi.toFixed(1)}%
          </p>
          <p className="text-[11px] text-white/60">
            {stats.roi >= 50 
              ? (isTe ? 'అత్యధిక లాభసాటి పంట సీజన్' : 'Highly profitable crop season')
              : (isTe ? 'సగటు లాభదాయకత' : 'Standard seasonal return')}
          </p>
        </div>
      </div>

      {/* Expense Category Breakdown Pills */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
          {isTe ? 'ఖర్చుల వర్గీకరణ విశ్లేషణ' : 'Expense Category Breakdown'}
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          {EXPENSE_CATEGORIES.map(cat => {
            const spent = stats.categoryTotals[cat.id] || 0;
            if (spent === 0) return null;
            const pct = stats.totalExpense > 0 ? Math.round((spent / stats.totalExpense) * 100) : 0;
            return (
              <div 
                key={cat.id}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2 text-xs"
              >
                <span>{cat.icon}</span>
                <span className="text-white/80 font-medium">{isTe ? cat.labelTe : cat.labelEn}</span>
                <span className="font-bold text-white">₹{spent.toLocaleString('en-IN')}</span>
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
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>{isTe ? 'లావాదేవీల పూర్తి వివరాలు' : 'Recent Farm Passbook Entries'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
              {filteredTransactions.length}
            </span>
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'all' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {isTe ? 'అన్నీ' : 'All'}
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

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg shrink-0">
                      {isIncome ? '💰' : catObj.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{tx.description}</p>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                          {isIncome ? (isTe ? 'దిగుబడి అమ్మకం' : 'Harvest Sale') : (isTe ? catObj.labelTe : catObj.labelEn)}
                        </span>
                        <span>·</span>
                        <span>{tx.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-base font-black ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isIncome ? '+' : '-'}₹{parseFloat(tx.amount).toLocaleString('en-IN')}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl bg-[#0c1420] border border-emerald-500/30 space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-black text-white">
                  {isTe ? 'కొత్త లావాదేవీని నమోదు చేయండి' : 'Add Khata Transaction'}
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
                          {cat.icon} {isTe ? cat.labelTe : cat.labelEn}
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

                {/* Date */}
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

                {/* Submit Button */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                  >
                    {isTe ? 'రద్దు' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg cursor-pointer"
                  >
                    {isTe ? 'నమోదు చేయండి' : 'Save Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
