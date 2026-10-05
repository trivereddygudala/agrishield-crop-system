import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Store, DollarSign, Package, Scale,
  AlertCircle, CheckCircle2, ArrowRight, RefreshCw, Info, Tag, ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import API from '../../services/api';

export default function HarvestMarketReconciler({ farmId, onInitiateSale }) {
  const { t, i18n } = useTranslation();
  const isTe = (i18n?.language || 'en').startsWith('te');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [advisory, setAdvisory] = useState(null);

  const fetchAdvisory = async () => {
    if (!farmId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await API.get(`/api/farms/${farmId}/selling-advisory`);
      setAdvisory(res.data);
    } catch (err) {
      console.warn('Error loading selling advisory:', err);
      setErrorMsg(isTe ? 'మార్కెట్ విక్రయ సలహాలు లోడ్ చేయడంలో విఫలమైంది.' : 'Failed to load market selling advisory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisory();
  }, [farmId]);

  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center gap-3 text-xs text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
        {isTe ? 'మార్కెట్ & దిగుబడి సమాచారం లోడ్ అవుతోంది...' : 'Loading harvest market reconciliation...'}
      </div>
    );
  }

  if (errorMsg || !advisory) {
    return (
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
        <span>{errorMsg || (isTe ? 'సమాచారం అందుబాటులో లేదు' : 'Advisory data unavailable')}</span>
        <button onClick={fetchAdvisory} className="underline font-bold text-xs">{isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry'}</button>
      </div>
    );
  }

  const { inventory, cost_per_quintal, cost_status, government_msp_reference, msp_status, market_references, estimated_reference_market_value, value_status, value_disclaimer } = advisory;

  const unsoldQty = inventory?.unsold_quantity;
  const unsoldUnit = inventory?.unit || 'quintal';
  const hasUnsold = unsoldQty !== null && unsoldQty > 0;

  return (
    <div className="space-y-4">
      {/* ── 1. HARVEST RECONCILIATION SUMMARY ── */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-emerald-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-emerald-950/20 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Scale className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isTe ? 'దిగుబడి & విక్రయాల సమీకరణ' : 'Harvest to Market Stock'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {advisory.crop_name} {advisory.variety ? `• ${advisory.variety}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAdvisory}
            className="p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-500 text-xs transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Metric Pills: Harvested, Sold, Unsold */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {isTe ? 'మొత్తం కోత' : 'Harvested'}
            </span>
            <p className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100">
              {inventory?.total_harvested_quintals !== null && inventory?.total_harvested_quintals !== undefined
                ? `${inventory.total_harvested_quintals} Qtl`
                : (inventory?.total_harvested ? `${inventory.total_harvested} ${inventory.unit}` : '0')}
            </p>
            <span className="text-[10px] text-slate-400">
              {inventory?.number_of_pickings || 0} {isTe ? 'కోతలు' : 'pickings'}
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {isTe ? 'అమ్మినది' : 'Actual Sold'}
            </span>
            <p className="text-base sm:text-xl font-black text-slate-700 dark:text-slate-300">
              {inventory?.total_sold_quintals !== null && inventory?.total_sold_quintals !== undefined
                ? `${inventory.total_sold_quintals} Qtl`
                : (inventory?.total_sold ? `${inventory.total_sold} ${inventory.unit}` : '0')}
            </p>
            <span className="text-[10px] text-slate-400">
              {inventory?.number_of_sales || 0} {isTe ? 'విక్రయాలు' : 'sales'}
            </span>
          </div>

          <div className={`p-3 sm:p-4 rounded-2xl border space-y-1 ${
            hasUnsold
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-700 dark:text-emerald-400">
              {isTe ? 'అమ్మని నిల్వ' : 'Unsold Stock'}
            </span>
            <p className={`text-base sm:text-xl font-black ${hasUnsold ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
              {unsoldQty !== null && unsoldQty !== undefined
                ? `${unsoldQty} ${unsoldUnit}`
                : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
            </p>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
              {inventory?.is_fully_sold
                ? (isTe ? 'పూర్తిగా విక్రయించబడింది' : 'Fully sold')
                : (hasUnsold ? (isTe ? 'విక్రయానికి సిద్ధంగా ఉంది' : 'Available on farm') : '—')}
            </span>
          </div>
        </div>

        {/* Production Cost Reference Badge & Estimated Market Value */}
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-300">
              {isTe ? 'రికార్డైన సాగు ఖర్చు:' : 'Recorded Production Cost:'}{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {cost_per_quintal !== null && cost_per_quintal !== undefined
                  ? `₹${cost_per_quintal.toLocaleString('en-IN')}/Qtl`
                  : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
              </strong>
            </span>
            {cost_status === 'actual' && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {isTe ? 'ఖాతా నుంచి వాస్తవ' : 'Actual from Khata'}
              </span>
            )}
          </div>

          {estimated_reference_market_value !== null && estimated_reference_market_value !== undefined && (
            <div className="text-left sm:text-right">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                {isTe ? 'అంచనా మార్కెట్ విలువ:' : 'Estimated Market Reference Value:'}
              </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                ₹{estimated_reference_market_value.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {value_disclaimer}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. CURRENT APMC MARKET REFERENCES ── */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isTe ? 'ప్రస్తుత మార్కెట్ సూచన ధరలు (APMC Mandis)' : 'Current APMC Mandi Market References'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {advisory.source || 'Agmarknet APMC Central Grid'}
            </p>
          </div>

          {government_msp_reference && (
            <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <span>🏛️</span>
              <span>
                {isTe ? 'ప్రభుత్వ MSP సూచన:' : 'Govt MSP Reference:'}{' '}
                <strong>₹{government_msp_reference.toLocaleString('en-IN')}/Qtl</strong>
              </span>
            </div>
          )}
        </div>

        {market_references && market_references.length > 0 ? (
          <div className="space-y-2.5">
            {market_references.map((m, idx) => {
              const spread = m.reference_spread;
              const isAbove = m.spread_status === 'ABOVE_PRODUCTION_COST';
              const isBelow = m.spread_status === 'BELOW_PRODUCTION_COST';
              const isAt = m.spread_status === 'AT_PRODUCTION_COST';

              return (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {m.mandi_name}
                      </span>
                      <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        📍 {m.location}
                      </span>
                      {idx === 0 && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {isTe ? 'అత్యధిక సూచన ధర' : 'Highest Reference Price'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {m.variety || 'Standard'} • {m.grade || 'FAQ Grade'} • {isTe ? 'కనిష్ట:' : 'Min:'} ₹{m.min_price} / {isTe ? 'గరిష్ట:' : 'Max:'} ₹{m.max_price}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="text-base font-black text-slate-900 dark:text-slate-100 block">
                        ₹{m.modal_price?.toLocaleString('en-IN')}/Qtl
                      </span>
                      {spread !== null && spread !== undefined ? (
                        <span className={`text-[10px] font-bold block ${
                          isAbove
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : (isBelow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500')
                        }`}>
                          {isAbove && `+₹${Math.round(spread).toLocaleString()}/Qtl vs cost`}
                          {isBelow && `-₹${Math.round(Math.abs(spread)).toLocaleString()}/Qtl vs cost`}
                          {isAt && `At production cost`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 block">
                          {isTe ? 'ఖర్చు అందుబాటులో లేదు' : 'Cost not available'}
                        </span>
                      )}
                    </div>

                    {/* Action: Hand off into B24 Sale Workflow */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onInitiateSale) {
                          onInitiateSale({
                            mandi: m.mandi_name,
                            price_per_unit: m.modal_price,
                            quantity_sold: unsoldQty && unsoldQty > 0 ? unsoldQty : '',
                            unit: unsoldUnit || 'quintal'
                          });
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {isTe ? 'అమ్మకం నమోదు' : 'Record Sale'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-500">
            {isTe ? 'ఈ పంటకు మార్కెట్ ధరల సమాచారం అందుబాటులో లేదు.' : 'Market reference prices are currently not available for this crop.'}
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-500 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            {isTe
              ? 'సూచన ధర వ్యత్యాసం రికార్డైన సాగు ఖర్చుతో మాత్రమే పోల్చబడుతుంది. రవాణా ఖర్చులు, కమీషన్, మరియు లోడింగ్ చార్జీలు చేర్చబడలేదు. ఇది హామీ ఇవ్వబడిన లాభం కాదు.'
              : 'Reference price spread is compared strictly against recorded cultivation cost. Transport, loading, commission, and local buyer deductions may vary. Reference spread does not represent guaranteed profit.'}
          </span>
        </div>
      </div>
    </div>
  );
}
