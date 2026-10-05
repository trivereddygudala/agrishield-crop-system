import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Minus, AlertTriangle, Clock, CheckCircle2,
  Calendar, Tag, Layers, RefreshCw, Trash2, ArrowUpRight,
  TrendingDown, Search, Filter, ShieldAlert, Sparkles,
  ChevronRight, X, DollarSign, Sprout, Droplets, Wrench,
  Archive, FileText, Check, AlertCircle, ShoppingCart, Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatINR } from '../../utils/cropEconomics';
import { Card, Button, Input, Select, Badge } from '../ui/index';

const INVENTORY_CATEGORIES = [
  { id: 'seeds', labelEn: 'Seeds & Nursery', labelTe: 'విత్తనాలు & నర్సరీ మొలకలు', icon: '🌱', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'fertilizer', labelEn: 'Fertilizers & Nutrients', labelTe: 'ఎరువులు & పోషకాలు', icon: '🧪', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'pesticide', labelEn: 'Pesticides & Sprays', labelTe: 'పురుగు మందులు & స్ప్రేలు', icon: '🛡️', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'irrigation', labelEn: 'Irrigation Supplies', labelTe: 'డ్రిప్ & పైపుల సామగ్రి', icon: '💧', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { id: 'tools', labelEn: 'Tools & Implements', labelTe: 'పనిముట్లు & ఉపకరణాలు', icon: '🔧', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'machinery', labelEn: 'Machinery Spares & Fuel', labelTe: 'యంత్రాల స్పేర్స్ & డీజిల్', icon: '🚜', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'packaging', labelEn: 'Packaging & Crates', labelTe: 'ప్యాకింగ్ సంచులు & క్రేట్లు', icon: '📦', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'other', labelEn: 'Other Supplies', labelTe: 'ఇతర సామగ్రి', icon: '📋', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' }
];

const COMMON_UNITS = [
  { value: 'bags', label: 'Bags (బస్తాలు)' },
  { value: 'kg', label: 'Kilograms (kg / కేజీలు)' },
  { value: 'grams', label: 'Grams (g / గ్రాములు)' },
  { value: 'litres', label: 'Litres (L / లీటర్లు)' },
  { value: 'ml', label: 'Millilitres (ml / మిల్లీలీటర్లు)' },
  { value: 'packets', label: 'Packets (ప్యాకెట్లు)' },
  { value: 'bottles', label: 'Bottles (సీసాలు)' },
  { value: 'crates', label: 'Crates (క్రేట్లు)' },
  { value: 'pieces', label: 'Pieces (సంఖ్య / ముక్కలు)' },
  { value: 'metres', label: 'Metres (మీటర్లు)' }
];

export default function FarmInventoryManager({
  farmId,
  farmName = 'My Farm',
  cropName = 'Tomato',
  onClose,
  onNavigateKhata
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  // State
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUseModal, setShowUseModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    item_name: '',
    category: 'fertilizer',
    quantity: '',
    unit: 'bags',
    brand: '',
    active_ingredient: '',
    minimum_quantity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    batch_number: '',
    vendor: '',
    purchase_price: '',
    field_id: 'Field-1',
    crop_name: cropName,
    notes: '',
    record_in_khata: false
  });

  const [useData, setUseData] = useState({
    quantity_used: '',
    activity: 'Field Application',
    field_id: 'Field-1',
    crop_name: cropName,
    notes: ''
  });

  const [restockData, setRestockData] = useState({
    quantity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: '',
    vendor: '',
    batch_number: '',
    expiry_date: '',
    notes: '',
    record_in_khata: false
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch Inventory and Summary
  const fetchInventory = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [listRes, sumRes] = await Promise.all([
        API.get(`/api/farms/${farmId}/inventory`),
        API.get(`/api/farms/${farmId}/inventory/summary`)
      ]);
      setItems(listRes.data?.items || []);
      setSummary(sumRes.data || null);
    } catch (err) {
      console.warn('Inventory fetch failed, using local fallback state if offline:', err);
      setErrorMsg(isTe ? 'ఇన్వెంటరీ డేటాను పొందడంలో విఫలమైంది.' : 'Could not fetch inventory from server.');
    } finally {
      setLoading(false);
    }
  }, [farmId, isTe]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Check for prefilled data from Agrochemical Scanner
  useEffect(() => {
    try {
      const prefillRaw = sessionStorage.getItem('agrishield_inventory_prefill');
      if (prefillRaw) {
        const prefill = JSON.parse(prefillRaw);
        setFormData(prev => ({
          ...prev,
          item_name: prefill.item_name || '',
          brand: prefill.brand || '',
          category: prefill.category || 'pesticide',
          active_ingredient: prefill.active_ingredient || '',
          notes: prefill.notes || ''
        }));
        setShowAddModal(true);
        sessionStorage.removeItem('agrishield_inventory_prefill');
        setSuccessToast(isTe ? 'స్కాన్ చేసిన మందు వివరాలు ఇన్వెంటరీ ఫారమ్‌లో పూరించబడ్డాయి. దయచేసి పరిమాణాన్ని నిర్ధారించండి.' : 'Prefilled scanned agrochemical details. Please confirm quantity to save.');
        setTimeout(() => setSuccessToast(''), 5000);
      }
    } catch (_) {}
  }, [isTe]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (item.item_name || '').toLowerCase().includes(q);
        const brandMatch = (item.brand || '').toLowerCase().includes(q);
        const activeMatch = (item.active_ingredient || '').toLowerCase().includes(q);
        if (!nameMatch && !brandMatch && !activeMatch) return false;
      }
      return true;
    });
  }, [items, selectedCategory, selectedStatus, searchQuery]);

  // Handle Add Item
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim()) {
      setErrorMsg(isTe ? 'దయచేసి వస్తువు పేరు నమోదు చేయండి.' : 'Please enter item name.');
      return;
    }
    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty < 0) {
      setErrorMsg(isTe ? 'దయచేసి సరైన పరిమాణాన్ని నమోదు చేయండి.' : 'Please enter a valid quantity >= 0.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        item_name: formData.item_name.trim(),
        category: formData.category,
        quantity: qty,
        unit: formData.unit,
        brand: formData.brand.trim() || null,
        active_ingredient: formData.active_ingredient.trim() || null,
        minimum_quantity: formData.minimum_quantity ? parseFloat(formData.minimum_quantity) : null,
        purchase_date: formData.purchase_date || null,
        expiry_date: formData.expiry_date || null,
        batch_number: formData.batch_number.trim() || null,
        vendor: formData.vendor.trim() || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        field_id: formData.field_id || null,
        crop_name: formData.crop_name || null,
        notes: formData.notes.trim() || null,
        record_in_khata: Boolean(formData.record_in_khata && formData.purchase_price && parseFloat(formData.purchase_price) > 0)
      };

      await API.post(`/api/farms/${farmId}/inventory`, payload);
      setShowAddModal(false);
      setFormData({
        item_name: '',
        category: 'fertilizer',
        quantity: '',
        unit: 'bags',
        brand: '',
        active_ingredient: '',
        minimum_quantity: '',
        purchase_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        batch_number: '',
        vendor: '',
        purchase_price: '',
        field_id: 'Field-1',
        crop_name: cropName,
        notes: '',
        record_in_khata: false
      });
      setSuccessToast(isTe ? 'వస్తువు ఇన్వెంటరీకి విజయవంతంగా జోడించబడింది!' : 'Material added to inventory successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
      fetchInventory();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setErrorMsg(msg || (isTe ? 'జోడించడంలో విఫలమైంది.' : 'Failed to add inventory item.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Use Stock
  const handleUseStock = async (e) => {
    e.preventDefault();
    if (!activeItem) return;
    const qtyUsed = parseFloat(useData.quantity_used);
    if (isNaN(qtyUsed) || qtyUsed <= 0) {
      setErrorMsg(isTe ? 'ఉపయోగించిన పరిమాణం 0 కంటే ఎక్కువ ఉండాలి.' : 'Quantity used must be greater than zero.');
      return;
    }
    if (qtyUsed > activeItem.quantity) {
      setErrorMsg(isTe ? `స్టాక్‌లో ${activeItem.quantity} ${activeItem.unit} మాత్రమే ఉంది. అంతకంటే ఎక్కువ ఉపయోగించలేరు.` : `Cannot use more than current stock (${activeItem.quantity} ${activeItem.unit}).`);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await API.post(`/api/farms/${farmId}/inventory/${activeItem.id}/use`, {
        quantity_used: qtyUsed,
        activity: useData.activity || 'Field Application',
        field_id: useData.field_id || null,
        crop_name: useData.crop_name || null,
        notes: useData.notes.trim() || null
      });
      setShowUseModal(false);
      setUseData({
        quantity_used: '',
        activity: 'Field Application',
        field_id: 'Field-1',
        crop_name: cropName,
        notes: ''
      });
      setSuccessToast(isTe ? 'స్టాక్ వాడకం విజయవంతంగా నమోదు చేయబడింది!' : 'Material usage logged successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
      fetchInventory();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setErrorMsg(msg || (isTe ? 'వాడకం నమోదు చేయడం విఫలమైంది.' : 'Failed to log usage.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Restock
  const handleRestock = async (e) => {
    e.preventDefault();
    if (!activeItem) return;
    const qty = parseFloat(restockData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg(isTe ? 'జోడించాల్సిన పరిమాణం 0 కంటే ఎక్కువ ఉండాలి.' : 'Restock quantity must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await API.post(`/api/farms/${farmId}/inventory/${activeItem.id}/restock`, {
        quantity: qty,
        purchase_date: restockData.purchase_date || null,
        purchase_price: restockData.purchase_price ? parseFloat(restockData.purchase_price) : null,
        vendor: restockData.vendor.trim() || null,
        batch_number: restockData.batch_number.trim() || null,
        expiry_date: restockData.expiry_date || null,
        notes: restockData.notes.trim() || null,
        record_in_khata: Boolean(restockData.record_in_khata && restockData.purchase_price && parseFloat(restockData.purchase_price) > 0)
      });
      setShowRestockModal(false);
      setRestockData({
        quantity: '',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_price: '',
        vendor: '',
        batch_number: '',
        expiry_date: '',
        notes: '',
        record_in_khata: false
      });
      setSuccessToast(isTe ? 'స్టాక్ విజయవంతంగా పెంచబడింది!' : 'Stock restocked successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
      fetchInventory();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setErrorMsg(msg || (isTe ? 'రీస్టాక్ విఫలమైంది.' : 'Failed to restock item.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Archive
  const handleArchive = async (item) => {
    if (!window.confirm(isTe ? `"${item.item_name}" ను ఆర్కైవ్ చేయాలనుకుంటున్నారా? పూర్వ చరిత్ర భద్రపరచబడుతుంది.` : `Archive "${item.item_name}"? Historical usage remains preserved.`)) {
      return;
    }
    try {
      await API.delete(`/api/farms/${farmId}/inventory/${item.id}`);
      setSuccessToast(isTe ? 'వస్తువు ఆర్కైవ్ చేయబడింది.' : 'Item archived successfully.');
      setTimeout(() => setSuccessToast(''), 3000);
      fetchInventory();
    } catch (err) {
      setErrorMsg(isTe ? 'ఆర్కైవ్ చేయడం విఫలమైంది.' : 'Failed to archive item.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'out_of_stock':
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20">{isTe ? 'స్టాక్ అయిపోయింది' : 'Out of Stock'}</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20">{isTe ? 'గడువు ముగిసింది' : 'Expired'}</Badge>;
      case 'expiring_soon':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">{isTe ? 'త్వరలో గడువు' : 'Expiring Soon'}</Badge>;
      case 'low_stock':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">{isTe ? 'తక్కువ నిల్వ' : 'Low Stock'}</Badge>;
      default:
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{isTe ? 'లభ్యత ఉంది' : 'In Stock'}</Badge>;
    }
  };

  const getCategoryMeta = (catId) => {
    return INVENTORY_CATEGORIES.find(c => c.id === catId) || INVENTORY_CATEGORIES[INVENTORY_CATEGORIES.length - 1];
  };

  return (
    <div className="space-y-6">

      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-950 border border-emerald-500/20 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Package className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {isTe ? 'వ్యవసాయ స్టాక్ & ఇన్వెంటరీ మేనేజర్' : 'Smart Farm Inventory Manager'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isTe ? `${farmName} కొరకు విత్తనాలు, ఎరువులు, స్ప్రేలు & పనిముట్ల ప్రత్యక్ష నిల్వ` : `Physical material stock, low-stock alerts & Khata link for ${farmName}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInventory}
            disabled={loading}
            className="border-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-md shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span>{isTe ? '+ కొత్త స్టాక్ జోడించండి' : '+ Add Material'}</span>
          </Button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="p-1 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Items */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>{isTe ? 'మొత్తం వస్తువులు' : 'Total Items'}</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {summary ? summary.total_items : items.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {isTe ? 'యాక్టివ్ స్టాక్ ఐటమ్స్' : 'Active stock entries'}
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>{isTe ? 'తక్కువ నిల్వ' : 'Low Stock'}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {summary ? summary.low_stock_count : items.filter(i => i.status === 'low_stock').length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {isTe ? 'రీ-ఆర్డర్ పరిమితి వద్ద' : 'Items at or below minimum'}
          </div>
        </div>

        {/* Expired / Expiring */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>{isTe ? 'గడువు హెచ్చరికలు' : 'Expiry Alerts'}</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {(summary?.expired_count || 0) + (summary?.expiring_soon_count || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {summary?.expired_count || 0} {isTe ? 'ముగిసింది' : 'expired'}, {summary?.expiring_soon_count || 0} {isTe ? 'త్వరలో' : 'soon'}
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>{isTe ? 'నిల్వ విలువ' : 'Remaining Stock Value'}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {formatINR(summary ? summary.total_stock_value : 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {isTe ? 'మిగిలిన నిల్వ కొనుగోలు విలువ' : 'Remaining stock basis'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={isTe ? "మందు లేదా విత్తనం పేరును వెతకండి..." : "Search material, chemical, or brand..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">{isTe ? 'స్థితి:' : 'Status:'}</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="all">{isTe ? 'అన్ని స్థితులు' : 'All Statuses'}</option>
              <option value="in_stock">{isTe ? 'లభ్యత ఉంది' : 'In Stock'}</option>
              <option value="low_stock">{isTe ? 'తక్కువ నిల్వ' : 'Low Stock'}</option>
              <option value="expiring_soon">{isTe ? 'త్వరలో గడువు' : 'Expiring Soon (<30d)'}</option>
              <option value="expired">{isTe ? 'గడువు ముగిసింది' : 'Expired'}</option>
              <option value="out_of_stock">{isTe ? 'స్టాక్ అయిపోయింది' : 'Out of Stock'}</option>
            </select>
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {isTe ? 'అన్ని కేటగిరీలు' : 'All Materials'} ({items.length})
          </button>
          {INVENTORY_CATEGORIES.map(cat => {
            const count = items.filter(i => i.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{isTe ? cat.labelTe.split(' ')[0] : cat.labelEn.split(' ')[0]}</span>
                <span className="opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Stock Items Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
          <span>{isTe ? 'ఇన్వెంటరీ లోడ్ అవుతోంది...' : 'Loading farm inventory...'}</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <Package className="w-10 h-10 mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-white">
            {isTe ? 'ఎటువంటి స్టాక్ ఐటమ్స్ కనుగొనబడలేదు' : 'No inventory items found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isTe ? 'మీ పొలం కోసం కొత్త విత్తనాలు, ఎరువులు లేదా రసాయనాల స్టాక్‌ను నమోదు చేయండి.' : 'Record your farm inputs, seeds, fertilizers, or scan bottles to keep track of physical stock.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>{isTe ? 'మొదటి వస్తువును జోడించండి' : 'Add First Material'}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const catMeta = getCategoryMeta(item.category);
            const isZero = item.quantity <= 0.00001;
            const minQty = item.minimum_quantity;
            const hasMin = minQty !== null && minQty !== undefined;
            const progress = hasMin && minQty > 0 ? Math.min(100, Math.round((item.quantity / minQty) * 100)) : 100;

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 shadow-md"
              >
                <div>
                  {/* Top Bar: Category & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${catMeta.bg}`}>
                      <span>{catMeta.icon}</span>
                      <span className={catMeta.color}>{isTe ? catMeta.labelTe.split(' ')[0] : catMeta.labelEn.split(' ')[0]}</span>
                    </span>
                    {getStatusBadge(item.status)}
                  </div>

                  {/* Item Name & Brand */}
                  <div>
                    <h4 className="text-sm font-black text-white leading-tight">
                      {item.item_name}
                    </h4>
                    {item.brand && (
                      <p className="text-[11px] text-slate-400 font-medium">
                        {item.brand}
                      </p>
                    )}
                  </div>

                  {/* Quantity Display */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        {isTe ? 'లభ్యమైన పరిమాణం' : 'Available Stock'}
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`text-xl font-black ${isZero ? 'text-slate-500' : 'text-emerald-400'}`}>
                          {item.quantity}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    {item.remaining_stock_value !== null && item.remaining_stock_value > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          {isTe ? 'విలువ' : 'Stock Value'}
                        </span>
                        <span className="text-xs font-black text-slate-200 mt-0.5 block">
                          {formatINR(item.remaining_stock_value)}
                        </span>
                        {item.cost_per_unit && (
                          <span className="text-[9px] text-slate-500">
                            @ ₹{item.cost_per_unit}/{item.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Minimum stock bar */}
                  {hasMin && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{isTe ? 'కనీస నిల్వ:' : 'Min Threshold:'} {minQty} {item.unit}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress <= 50 ? 'bg-rose-500' : progress <= 100 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Details / Metas */}
                  <div className="mt-3 space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                    {item.active_ingredient && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-400/90 truncate">
                        <span className="font-semibold text-slate-500">{isTe ? 'రసాయనం:' : 'Active:'}</span>
                        <span className="truncate">{item.active_ingredient}</span>
                      </div>
                    )}
                    {item.expiry_date && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-500">{isTe ? 'గడువు:' : 'Expiry:'}</span>
                        <span className={item.status === 'expired' ? 'text-rose-400 font-bold' : item.status === 'expiring_soon' ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                          {item.expiry_date}
                        </span>
                      </div>
                    )}
                    {item.vendor && (
                      <div className="text-[10px] text-slate-500 truncate">
                        <span>{isTe ? 'డీలర్:' : 'Vendor:'} {item.vendor}</span>
                      </div>
                    )}
                    {item.khata_tx_id && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isTe ? 'ఖాతాలో నమోదు చేయబడింది' : 'Recorded in Farm Khata'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isZero}
                      onClick={() => {
                        setActiveItem(item);
                        setUseData(prev => ({ ...prev, quantity_used: '' }));
                        setShowUseModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      <Minus className="w-3 h-3 mr-1" />
                      <span>{isTe ? 'వాడుక' : 'Use'}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveItem(item);
                        setRestockData(prev => ({ ...prev, quantity: '' }));
                        setShowRestockModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold border-blue-500/30 text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      <span>{isTe ? 'స్టాక్ +' : '+ Add'}</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={isTe ? 'వాడకం చరిత్ర' : 'Usage History'}
                      onClick={() => {
                        setActiveItem(item);
                        setShowHistoryModal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title={isTe ? 'ఆర్కైవ్' : 'Archive Item'}
                      onClick={() => handleArchive(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ MODAL: ADD MATERIAL ══════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400"><Plus className="w-4 h-4" /></span>
                <h3 className="font-bold text-white text-base">
                  {isTe ? 'కొత్త స్టాక్ / సామగ్రిని జోడించండి' : 'Add New Farm Material'}
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'వస్తువు పేరు *' : 'Material / Product Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Urea, Arka Rakshak Seeds, Mancozeb"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'కేటగిరీ *' : 'Category *'}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {INVENTORY_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{isTe ? c.labelTe : c.labelEn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'కొలత ప్రమాణం (యూనిట్) *' : 'Unit *'}
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {COMMON_UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'ప్రారంభ పరిమాణం *' : 'Initial Quantity *'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="e.g. 10"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'కనీస నిల్వ హెచ్చరిక పరిమితి' : 'Minimum Stock Alert (Reorder)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 2"
                    value={formData.minimum_quantity}
                    onChange={(e) => setFormData({ ...formData, minimum_quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'బ్రాండ్ / కంపెనీ' : 'Brand / Company'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IFFCO, Bayer, Syngenta"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'యాక్టివ్ రసాయనం' : 'Active Ingredient'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nitrogen 46%, Mancozeb 75%"
                    value={formData.active_ingredient}
                    onChange={(e) => setFormData({ ...formData, active_ingredient: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'కొనుగోలు తేదీ' : 'Purchase Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'గడువు తేదీ (ఎక్స్‌పైరీ)' : 'Expiry Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'మొత్తం కొనుగోలు ఖర్చు (₹)' : 'Total Purchase Price (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 2500"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'డీలర్ / దుకాణదారు' : 'Vendor / Dealer'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Balaji Agro Agency"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* B17 Khata Sync Option */}
              {formData.purchase_price && parseFloat(formData.purchase_price) > 0 && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-300 block">
                      {isTe ? 'డిజిటల్ పొలం ఖాతాలో ఖర్చుగా నమోదు చేయాలా?' : 'Record this purchase in Digital Farm Khata?'}
                    </span>
                    <span className="text-[10px] text-blue-400/80">
                      {isTe ? `₹${formData.purchase_price} ఖర్చు ఆటోమేటిక్‌గా ఖాతా లెడ్జర్‌కు జోడించబడుతుంది` : `Records ₹${formData.purchase_price} expense linked to this stock without duplicates`}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.record_in_khata}
                    onChange={(e) => setFormData({ ...formData, record_in_khata: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowAddModal(false)} className="cursor-pointer">
                  {isTe ? 'రద్దు చేయి' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">
                  {isTe ? 'స్టాక్ సేవ్ చేయండి' : 'Save Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: USE STOCK ══════════ */}
      {showUseModal && activeItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400"><Minus className="w-4 h-4" /></span>
                <h3 className="font-bold text-white text-base">
                  {isTe ? 'స్టాక్ వాడకాన్ని నమోదు చేయండి' : 'Record Material Usage'}
                </h3>
              </div>
              <button onClick={() => setShowUseModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="text-xs font-black text-white">{activeItem.item_name}</h4>
              <p className="text-[11px] text-slate-400">{activeItem.brand}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs text-slate-400 font-semibold">{isTe ? 'ప్రస్తుత నిల్వ:' : 'Current Stock:'}</span>
                <span className="text-sm font-black text-emerald-400">{activeItem.quantity} {activeItem.unit}</span>
              </div>
            </div>

            <form onSubmit={handleUseStock} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {isTe ? `ఉపయోగించిన పరిమాణం (${activeItem.unit}) *` : `Quantity Used (${activeItem.unit}) *`}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0.001"
                  max={activeItem.quantity}
                  placeholder={`Max: ${activeItem.quantity}`}
                  value={useData.quantity_used}
                  onChange={(e) => setUseData({ ...useData, quantity_used: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {isTe ? 'పని / ప్రయోజనం' : 'Activity / Purpose'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Basal Dose, Top Dressing, Pest Spray"
                  value={useData.activity}
                  onChange={(e) => setUseData({ ...useData, activity: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'పొలం / ఫీల్డ్' : 'Field'}
                  </label>
                  <input
                    type="text"
                    value={useData.field_id}
                    onChange={(e) => setUseData({ ...useData, field_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'పంట' : 'Crop'}
                  </label>
                  <input
                    type="text"
                    value={useData.crop_name}
                    onChange={(e) => setUseData({ ...useData, crop_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {isTe ? 'గమనికలు' : 'Notes'}
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional usage notes..."
                  value={useData.notes}
                  onChange={(e) => setUseData({ ...useData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowUseModal(false)} className="cursor-pointer">
                  {isTe ? 'రద్దు చేయి' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={submitting} className="bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer">
                  {isTe ? 'వాడకాన్ని ధృవీకరించు' : 'Confirm Usage'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: RESTOCK ══════════ */}
      {showRestockModal && activeItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400"><Plus className="w-4 h-4" /></span>
                <h3 className="font-bold text-white text-base">
                  {isTe ? 'స్టాక్ రీస్టాక్ / పరిమాణం పెంచండి' : 'Restock Material'}
                </h3>
              </div>
              <button onClick={() => setShowRestockModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="text-xs font-black text-white">{activeItem.item_name}</h4>
              <p className="text-[11px] text-slate-400">{activeItem.brand}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs text-slate-400 font-semibold">{isTe ? 'ప్రస్తుత నిల్వ:' : 'Current Stock:'}</span>
                <span className="text-sm font-black text-emerald-400">{activeItem.quantity} {activeItem.unit}</span>
              </div>
            </div>

            <form onSubmit={handleRestock} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {isTe ? `జోడించాల్సిన పరిమాణం (${activeItem.unit}) *` : `Quantity to Add (${activeItem.unit}) *`}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0.001"
                  placeholder="e.g. 5"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'కొనుగోలు ధర (₹)' : 'Purchase Price (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Optional ₹"
                    value={restockData.purchase_price}
                    onChange={(e) => setRestockData({ ...restockData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {isTe ? 'కొనుగోలు తేదీ' : 'Purchase Date'}
                  </label>
                  <input
                    type="date"
                    value={restockData.purchase_date}
                    onChange={(e) => setRestockData({ ...restockData, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {restockData.purchase_price && parseFloat(restockData.purchase_price) > 0 && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-300 block">
                      {isTe ? 'ఖాతాలో నమోదు చేయాలా?' : 'Record in Farm Khata?'}
                    </span>
                    <span className="text-[10px] text-blue-400/80">
                      {isTe ? `₹${restockData.purchase_price} ఖర్చు ఖాతాలో ఆటోమేటిక్‌గా నమోదు అవుతుంది` : `Records ₹${restockData.purchase_price} restock expense in Khata`}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={restockData.record_in_khata}
                    onChange={(e) => setRestockData({ ...restockData, record_in_khata: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowRestockModal(false)} className="cursor-pointer">
                  {isTe ? 'రద్దు చేయి' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={submitting} className="bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer">
                  {isTe ? 'స్టాక్ పెంచు' : 'Add Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: USAGE HISTORY ══════════ */}
      {showHistoryModal && activeItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400"><Clock className="w-4 h-4" /></span>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">
                    {isTe ? 'వాడకం చరిత్ర' : 'Stock Usage History'}
                  </h3>
                  <p className="text-xs text-slate-400">{activeItem.item_name}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {(!activeItem.usage_history || activeItem.usage_history.length === 0) ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  {isTe ? 'ఈ వస్తువుకు ఎటువంటి పూర్వ వాడకం నమోదు కాలేదు.' : 'No previous usage recorded for this item.'}
                </div>
              ) : (
                [...activeItem.usage_history].reverse().map((entry, idx) => (
                  <div key={entry.log_id || idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-rose-400">-{entry.quantity_used} {activeItem.unit}</span>
                        <span className="text-xs font-bold text-slate-300">{entry.activity || 'Field Application'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                        <span>{entry.date}</span>
                        {entry.crop_name && <span>• {entry.crop_name}</span>}
                        {entry.field_id && <span>• {entry.field_id}</span>}
                      </div>
                      {entry.notes && (
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">"{entry.notes}"</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 shrink-0 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowHistoryModal(false)} className="cursor-pointer">
                {isTe ? 'మూసివేయి' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
