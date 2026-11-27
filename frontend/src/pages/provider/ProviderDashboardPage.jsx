import { getLocalizedField } from '../../utils/localizationHelper';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Droplets,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Phone,
  MessageSquare,
  Search,
  Plus,
  Trash2,
  Star,
  Zap,
  Sparkles,
  ShieldCheck,
  DollarSign,
  User,
  Sliders,
  Compass,
  ArrowRight,
  ChevronRight,
  Info,
  X,
  Activity,
  Layers,
  Check,
  FileText,
  TrendingUp,
  Settings,
  Bot,
  Send,
  RefreshCw,
  ArrowLeft,
  RotateCcw,
  Headphones,
  Fuel,
  Wrench,
  Navigation,
  Receipt,
  Download,
  Share2,
  Camera,
  ChevronLeft
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '../../services/api';
import { getUserNotificationCache, setUserNotificationCache } from '../../utils/notificationStorage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/toast';
import { Button } from '../../components/ui/index';
import GoogleMessageReader from '../../components/common/GoogleMessageReader';
import { normalizeLanguage } from '../../utils/localizationHelper';
import { compressImageForUpload } from '../../utils/imageCompression';
import {
  deduplicateEquipment,
  deduplicateBookings,
  getDeletedEquipmentIds,
  saveDeletedEquipmentId,
  getDeletedBookingIds,
  saveDeletedBookingId
} from '../../utils/equipmentDeduplication';
import { recordCrossDeviceDeletion } from '../../services/crossDeviceSync';
import { CURATED_FARM_PHOTOS } from '../../services/photoService';

// Concept 2 Clean Studio Machinery Image Resolver
const getEquipmentFallbackImage = (category, title = '') => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  const photos = (typeof CURATED_FARM_PHOTOS !== 'undefined' && CURATED_FARM_PHOTOS) ? CURATED_FARM_PHOTOS : {};
  if (c === 'drone' || t.includes('drone') || t.includes('agras') || t.includes('spray')) {
    return photos.drone || 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'irrigation' || c === 'pump' || t.includes('pump') || t.includes('solar') || t.includes('water')) {
    return photos.solarPump || 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'harvester' || t.includes('harvester') || t.includes('cutter')) {
    return photos.harvester || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'implement' || t.includes('rotavator') || t.includes('plough') || t.includes('tiller')) {
    return photos.rotavator || 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('john deere')) {
    return photos.tractor || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80';
  }
  return photos.tractorJohnDeere || photos.tractorField || 'https://images.unsplash.com/photo-1594771804886-a933bb2d609b?auto=format&fit=crop&w=800&q=80';
};

// Safely extract canonical location details from user/provider profile
const parseUserLocation = (user) => {
  const pLoc = user?.provider_profile?.hub_location;
  if (pLoc && typeof pLoc === 'object') {
    return {
      village: pLoc.village || '',
      district: pLoc.district || '',
      mandal: pLoc.mandal || '',
      state: pLoc.state || ''
    };
  }
  const fLoc = user?.farm_location;
  if (fLoc && typeof fLoc === 'object') {
    return {
      village: fLoc.village || '',
      district: fLoc.district || '',
      mandal: fLoc.mandal || '',
      state: fLoc.state || ''
    };
  }
  if (typeof fLoc === 'string' && fLoc.trim()) {
    const parts = fLoc.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) {
      return { village: parts[0], district: parts[0], mandal: '', state: '' };
    } else if (parts.length === 2) {
      return { village: parts[0], district: parts[1], mandal: '', state: '' };
    } else if (parts.length === 3) {
      return { village: parts[0], district: parts[1], mandal: '', state: parts[2] };
    } else if (parts.length >= 4) {
      return { village: parts[0], mandal: parts[1], district: parts[2], state: parts[3] };
    }
  }
  return { village: '', district: '', mandal: '', state: '' };
};

// FIX 3: Isolated Provider Fleet Storage Key Helper
export const getProviderFleetStorageKey = (userId) => {
  return userId ? `agrishield_provider_fleet_inventory_${userId}` : 'agrishield_provider_fleet_inventory';
};

/**
 * L-2 Canonical Booking Cost Helper:
 * Extracts or safely derives legitimate booking cost without fabricating revenue.
 * Treats 0 and '0' as valid financial numbers.
 * Never defaults missing amounts to arbitrary numbers like 2500 or 800.
 * Returns a finite non-negative number; returns 0 if indeterminate.
 */
export const getBookingCost = (booking) => {
  if (!booking || typeof booking !== 'object') {
    return 0;
  }

  // 1. Explicit canonical totalCost property
  if (booking.totalCost !== undefined && booking.totalCost !== null && booking.totalCost !== '') {
    const parsed = Number(booking.totalCost);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  // 2. Explicit alternative total_cost property
  if (booking.total_cost !== undefined && booking.total_cost !== null && booking.total_cost !== '') {
    const parsed = Number(booking.total_cost);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  // 3. Explicit amount or fare property if present
  if (booking.fare !== undefined && booking.fare !== null && booking.fare !== '') {
    const parsed = Number(booking.fare);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  if (booking.amount !== undefined && booking.amount !== null && booking.amount !== '') {
    const parsed = Number(booking.amount);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  // 4. Safely derive from unit rate and quantity if both exist and are valid
  const rate = Number(booking.ratePerAcre || booking.ratePerHour || booking.hourlyRate || booking.rate);
  const units = Number(booking.acres || booking.acreage || booking.hours);
  if (!isNaN(rate) && isFinite(rate) && rate > 0 && !isNaN(units) && isFinite(units) && units > 0) {
    return Math.round(rate * units);
  }

  // 5. Data honesty: return 0 rather than inventing arbitrary amounts (e.g. 2500 or 800)
  return 0;
};

export default function ProviderDashboardPage() {
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguage(i18n?.language || user?.preferred_language || 'en');
  const isTe = currentLang === 'te';
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const userLocation = useMemo(() => parseUserLocation(user), [user]);

  // Active Provider View Tab & URL synchronization
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(requestedTab || 'fleet'); // 'fleet' | 'orders' | 'calendar' | 'earnings' | 'copilot'

  useEffect(() => {
    if (requestedTab && ['fleet', 'orders', 'calendar', 'earnings', 'copilot'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ── 1. Rental Schedule Calendar State (7-Day & 30-Day Matrix) ──
  const [calendarOffsetDays, setCalendarOffsetDays] = useState(0);
  const [calendarBlocks, setCalendarBlocks] = useState(() => {
    try {
      const raw = localStorage.getItem('agrishield_provider_calendar_blocks');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [slotBlockModalData, setSlotBlockModalData] = useState(null);
  const [slotBlockReason, setSlotBlockReason] = useState('Personal Farm Use');

  const toggleBlockSlot = (machineId, dateIso, reason = 'Personal Farm Use') => {
    const key = `${machineId}_${dateIso}`;
    setCalendarBlocks(prev => {
      const updated = { ...prev };
      if (updated[key]) {
        delete updated[key];
        toast.info(t('provider_hub.unblock_slot_btn', 'Release Slot'), `Slot for ${dateIso} released to available.`);
      } else {
        updated[key] = { reason, date: dateIso, machineId, createdAt: new Date().toISOString() };
        toast.warning(t('provider_hub.block_slot_btn', 'Block Slot'), `Slot for ${dateIso} locked for ${reason}.`);
      }
      try {
        localStorage.setItem('agrishield_provider_calendar_blocks', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
    setSlotBlockModalData(null);
  };

  // ── 2. Diesel & Operator Expense Ledger (Net Profit Calculator) ──
  const [expenseModalBooking, setExpenseModalBooking] = useState(null);
  const [dieselLitersInput, setDieselLitersInput] = useState('');
  const [dieselPriceInput, setDieselPriceInput] = useState('94');
  const [driverWageInput, setDriverWageInput] = useState('700');
  const [miscExpenseInput, setMiscExpenseInput] = useState('');
  const [jobExpensesMap, setJobExpensesMap] = useState(() => {
    try {
      const raw = localStorage.getItem('agrishield_provider_job_expenses');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const handleOpenExpenseModal = (booking) => {
    const bId = String(booking.id || booking.bookingId);
    const existing = jobExpensesMap[bId];
    if (existing) {
      setDieselLitersInput(String(existing.dieselLiters || ''));
      setDieselPriceInput(String(existing.dieselPrice || '94'));
      setDriverWageInput(String(existing.driverWage || '700'));
      setMiscExpenseInput(String(existing.miscExpense || ''));
    } else {
      const acres = parseFloat(booking.acres || 2) || 2;
      setDieselLitersInput(String(Math.round(acres * 4.5))); // ~4.5L/acre typical rotavator baseline
      setDieselPriceInput('94');
      setDriverWageInput('700');
      setMiscExpenseInput('');
    }
    setExpenseModalBooking(booking);
  };

  const handleSaveJobExpenses = (e) => {
    e?.preventDefault();
    if (!expenseModalBooking) return;
    const bId = String(expenseModalBooking.id || expenseModalBooking.bookingId);
    const liters = parseFloat(dieselLitersInput) || 0;
    const pricePerL = parseFloat(dieselPriceInput) || 94;
    const dieselTotal = Math.round(liters * pricePerL);
    const driverWage = parseFloat(driverWageInput) || 0;
    const miscFee = parseFloat(miscExpenseInput) || 0;
    const totalExpenses = dieselTotal + driverWage + miscFee;
    const grossRev = getBookingCost(expenseModalBooking);
    const netProfit = Math.max(0, grossRev - totalExpenses);

    const expenseRecord = {
      bookingId: bId,
      dieselLiters: liters,
      dieselPrice: pricePerL,
      dieselCost: dieselTotal,
      driverWage,
      miscExpense: miscFee,
      totalExpenses,
      grossRevenue: grossRev,
      netProfit,
      updatedAt: new Date().toISOString()
    };

    setJobExpensesMap(prev => {
      const updated = { ...prev, [bId]: expenseRecord };
      try {
        localStorage.setItem('agrishield_provider_job_expenses', JSON.stringify(updated));
      } catch (err) { }
      return updated;
    });

    toast.success(
      t('provider_hub.net_pocket_profit', 'Net Pocket Profit Updated'),
      `Logged ₹${totalExpenses.toLocaleString('en-IN')} expenses. Net Profit: ₹${netProfit.toLocaleString('en-IN')}`
    );
    setExpenseModalBooking(null);
  };

  // ── 3. Digital Bill & WhatsApp Receipt State ──
  const [receiptModalBooking, setReceiptModalBooking] = useState(null);

  const handleShareReceiptWhatsApp = (booking) => {
    if (!booking) return;
    const bId = booking.id || booking.bookingId || 'BK-1';
    const farmerName = booking.farmerName || 'Farmer';
    const machine = booking.equipmentTitle || booking.title || 'Farm Machinery';
    const acres = booking.acres || 2;
    const total = getBookingCost(booking);
    const dues = duesMap[String(bId)] || {};
    const advance = dues.advancePaid !== undefined ? dues.advancePaid : total;
    const balance = dues.balanceDue !== undefined ? dues.balanceDue : 0;
    const phone = booking.farmerPhone || booking.contactPhone || booking.phone || '';
    const cleanPhone = String(phone).replace(/\D/g, '');

    const text = encodeURIComponent(
      `🌾 *AGRISHIELD MACHINERY RENTAL BILL / రసీదు*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 *Bill No:* #${bId}\n` +
      `🚜 *Machinery:* ${machine}\n` +
      `👨‍🌾 *Farmer:* ${farmerName}\n` +
      `📍 *Field Area:* ${acres} Acres\n` +
      `💰 *Total Rental Fee:* ₹${total.toLocaleString('en-IN')}\n` +
      `✅ *Advance Paid:* ₹${advance.toLocaleString('en-IN')}\n` +
      (balance > 0 ? `⚠️ *Pending Balance Due:* ₹${balance.toLocaleString('en-IN')}\n` : `✨ *Payment Status:* 100% Fully Settled\n`) +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *Provider:* ${user?.name || 'AgriShield Verified Provider'}\n` +
      `📞 *Contact:* ${user?.phone || 'Field Dispatch'}\n` +
      `🙏 *Thank you for choosing AgriShield Farm Mechanization!*`
    );

    const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // ── 4. GPS Plot Route Navigator ──
  const handleNavigateToPlot = (booking) => {
    const village = booking.village || booking.locationVillage || booking.location?.village || '';
    const mandal = booking.mandal || booking.locationMandal || booking.location?.mandal || '';
    const district = booking.district || booking.locationDistrict || booking.location?.district || userLocation.district || '';
    const query = [village, mandal, district, 'Andhra Pradesh'].filter(Boolean).join(', ');
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query || 'Rural Field Hub')}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // ── 5. Advance & Pending Balance Dues (Udhari Ledger) ──
  const [duesMap, setDuesMap] = useState(() => {
    try {
      const raw = localStorage.getItem('agrishield_provider_booking_dues');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [duesModalBooking, setDuesModalBooking] = useState(null);
  const [advancePaidInput, setAdvancePaidInput] = useState('');
  const [duesFilterOnly, setDuesFilterOnly] = useState(false);

  const handleOpenDuesModal = (booking) => {
    const bId = String(booking.id || booking.bookingId);
    const existing = duesMap[bId];
    const total = getBookingCost(booking);
    if (existing && existing.advancePaid !== undefined) {
      setAdvancePaidInput(String(existing.advancePaid));
    } else {
      setAdvancePaidInput(String(total));
    }
    setDuesModalBooking(booking);
  };

  const handleSaveDues = (e) => {
    e?.preventDefault();
    if (!duesModalBooking) return;
    const bId = String(duesModalBooking.id || duesModalBooking.bookingId);
    const total = getBookingCost(duesModalBooking);
    const advance = Math.min(total, parseFloat(advancePaidInput) || 0);
    const balance = Math.max(0, total - advance);

    setDuesMap(prev => {
      const updated = {
        ...prev,
        [bId]: {
          bookingId: bId,
          total,
          advancePaid: advance,
          balanceDue: balance,
          isSettled: balance === 0,
          updatedAt: new Date().toISOString()
        }
      };
      try {
        localStorage.setItem('agrishield_provider_booking_dues', JSON.stringify(updated));
      } catch (err) { }
      return updated;
    });

    toast.success(
      balance === 0 ? 'Fully Settled' : 'Partial Payment Saved',
      balance === 0 ? 'Order marked 100% paid.' : `Remaining balance due: ₹${balance.toLocaleString('en-IN')}`
    );
    setDuesModalBooking(null);
  };

  // ── 6. Machinery Hours & Service Maintenance Meter ──
  const [serviceHoursMap, setServiceHoursMap] = useState(() => {
    try {
      const raw = localStorage.getItem('agrishield_provider_service_hours');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const getMachineServiceInfo = useCallback((machineId) => {
    const s = serviceHoursMap[String(machineId)] || { currentHours: 185, lastServiceHours: 0, serviceInterval: 250 };
    const hoursSinceService = s.currentHours - (s.lastServiceHours || 0);
    const remaining = Math.max(0, (s.serviceInterval || 250) - hoursSinceService);
    const percent = Math.min(100, Math.round((hoursSinceService / (s.serviceInterval || 250)) * 100));
    return { ...s, hoursSinceService, remaining, percent };
  }, [serviceHoursMap]);

  const handleMarkMachineServiced = (machineId, machineTitle) => {
    setServiceHoursMap(prev => {
      const current = prev[String(machineId)]?.currentHours || 185;
      const updated = {
        ...prev,
        [String(machineId)]: {
          currentHours: current,
          lastServiceHours: current,
          serviceInterval: 250,
          lastServicedDate: new Date().toISOString().split('T')[0]
        }
      };
      try {
        localStorage.setItem('agrishield_provider_service_hours', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
    toast.success('Service Recorded', `${machineTitle} marked as serviced! Next 250hr cycle started.`);
  };

  // ── Dedicated Equipment Provider AI Copilot State ──
  const [copilotMessages, setCopilotMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_provider_ai_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }
    return [
      {
        id: 1,
        role: 'assistant',
        content: t('provider_hub.copilot_greeting', 'Hello! I am your AgriShield Machinery & Fleet AI Copilot. Ask me about tractor maintenance schedules, spray drone battery cycles, per-acre diesel consumption formulas, fair rental pricing, and government machinery subsidies.')
      }
    ];
  });

  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('agrishield_provider_ai_chat', JSON.stringify(copilotMessages));
  }, [copilotMessages]);

  const COPILOT_PRESETS = [
    { label: t('provider_hub.copilot_preset_diesel', '⛽ 45HP Tractor diesel/acre'), query: "What is the typical diesel consumption per acre for a 45HP tractor with Rotavator vs Cultivator?" },
    { label: t('provider_hub.copilot_preset_drone', '🔋 Drone LiPo battery care'), query: "What are the safe charging, discharging, and storage voltages for 16L agricultural spray drone LiPo batteries?" },
    { label: t('provider_hub.copilot_preset_pricing', '💰 Fair acre rental pricing'), query: "How should I calculate my per-acre rental rate considering current diesel prices, operator daily wage, and implement wear-and-tear?" },
    { label: t('provider_hub.copilot_preset_service', '⚙️ Tractor service intervals'), query: "When should I change engine oil, fuel filters, and hydraulic oil in a commercial farm tractor?" },
    { label: t('provider_hub.copilot_preset_subsidy', '🏛️ SMAM machinery subsidy'), query: "What are the eligibility rules and documents required for Sub-Mission on Agricultural Mechanization (SMAM) Custom Hiring Center 40% subsidy?" }
  ];

  const handleSendCopilot = async (overrideText) => {
    const text = (overrideText || copilotInput).trim();
    if (!text || copilotLoading) return;

    const userMsg = { id: Date.now(), role: 'user', content: text };
    const updatedHistory = [...copilotMessages, userMsg];
    setCopilotMessages(updatedHistory);
    setCopilotInput('');
    setCopilotLoading(true);

    try {
      const historyPayload = updatedHistory
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await API.post('/api/ai/chat', {
        message: text,
        history: historyPayload,
        user_id: user?.id || 'provider_user',
        role: 'equipment_provider',
        language: i18n.language || 'en',
        context: {
          user_role: 'equipment_provider',
          provider_fleet_count: fleetList?.length || 1,
          language: i18n.language || 'en'
        }
      });

      const replyContent = res.data?.reply || res.data?.response || res.data?.answer || "I have analyzed your machinery query.";
      const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: replyContent };
      setCopilotMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Copilot error:", err);
      const errMsg = t('provider_hub.copilot_error', 'Could not connect to Machinery AI service. Please check connection and try again.');;
      setCopilotMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: errMsg }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleClearCopilotChat = () => {
    const defaultMsg = [
      {
        id: Date.now(),
        role: 'assistant',
        content: t('provider_hub.copilot_cleared', 'Chat history cleared. Ask me any question about your fleet machinery, fuel consumption, or maintenance.')
      }
    ];
    setCopilotMessages(defaultMsg);
    localStorage.setItem('agrishield_provider_ai_chat', JSON.stringify(defaultMsg));
    toast.success('Chat Cleared', 'Copilot conversation reset successfully.');
  };

  // Availability Status (Server-backed H-3)
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('agrishield_provider_online_status');
    return saved !== null ? saved === 'true' : false; // Default false, never true
  });
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchServerStatus = async () => {
      try {
        const res = await API.get('/api/v1/equipment/provider/status');
        if (isMounted && res?.data && res.data.is_online !== undefined) {
          const serverVal = Boolean(res.data.is_online);
          setIsOnline(serverVal);
          try {
            localStorage.setItem('agrishield_provider_online_status', String(serverVal));
          } catch (_) { }
        }
      } catch (err) {
        console.warn('Could not sync provider status from server:', err);
      }
    };
    fetchServerStatus();
    return () => { isMounted = false; };
  }, []);

  const toggleOnlineStatus = async () => {
    if (isStatusUpdating) return;
    const nextVal = !isOnline;
    setIsStatusUpdating(true);
    try {
      const res = await API.patch('/api/v1/equipment/provider/status', { is_online: nextVal });
      const confirmedVal = res?.data && res.data.is_online !== undefined ? Boolean(res.data.is_online) : nextVal;
      setIsOnline(confirmedVal);
      try {
        localStorage.setItem('agrishield_provider_online_status', String(confirmedVal));
        window.dispatchEvent(new CustomEvent('agrishield_provider_status_changed', { detail: { isOnline: confirmedVal } }));
        window.dispatchEvent(new Event('agrishield_equipment_updated'));
      } catch (e) { }

      toast.success(
        confirmedVal ? t('provider_hub.hub_online_title', 'Provider Hub: Online Today') : t('provider_hub.hub_offline_title', 'Provider Hub: Offline Today'),
        confirmedVal
          ? t('provider_hub.hub_online_desc', 'Farmers can now see you Online and send rental booking requests.')
          : t('provider_hub.hub_offline_desc', 'Incoming new rental orders paused. Farmers will see you as Offline Today.')
      );
    } catch (err) {
      console.error('Failed to update provider status on server:', err);
      toast.error(
        t('provider_hub.status_update_failed', 'Status Update Failed'),
        t('provider_hub.server_connect_error', 'Could not reach server to update status. Please try again.')
      );
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // ── Fleet Inventory State (Provider-Scoped, Zero Duplicates & Blacklist Protection) ──
  // FIX 1 & FIX 3: Never default to demo/starter machinery. Isolated by provider ID.
  const loadScopedFleet = useCallback(() => {
    try {
      const uid = String(user?.id || user?._id || '');
      const uPhone = String(user?.phone || user?.mobile || '');
      const cleanUPhone = uPhone.replace(/\D/g, '');
      const deletedEquipIds = getDeletedEquipmentIds();
      const storageKey = getProviderFleetStorageKey(uid);

      if (uid) {
        const scopedSaved = localStorage.getItem(storageKey);
        if (scopedSaved !== null) {
          const parsed = JSON.parse(scopedSaved);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(m => {
              if (!m) return false;
              const mPid = String(m.providerId || m.owner_id || m.userId || '');
              const mPhone = String(m.phone || m.contactPhone || '').replace(/\D/g, '');
              return (mPid && mPid === uid) || (cleanUPhone && mPhone && cleanUPhone === mPhone);
            });
            return deduplicateEquipment(filtered, deletedEquipIds);
          }
        }
      }

      // FIX 8: Legacy migration fallback with strict ownership verification
      const legacySaved = localStorage.getItem('agrishield_provider_fleet_inventory');
      if (legacySaved !== null && uid) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed)) {
          const verifiedOwned = parsed.filter(m => {
            if (!m) return false;
            const mPid = String(m.providerId || m.owner_id || m.userId || '');
            const mPhone = String(m.phone || m.contactPhone || '').replace(/\D/g, '');
            return (mPid && mPid === uid) || (cleanUPhone && mPhone && cleanUPhone === mPhone);
          });
          if (verifiedOwned.length > 0) {
            const cleanLegacy = deduplicateEquipment(verifiedOwned, deletedEquipIds);
            try {
              localStorage.setItem(storageKey, JSON.stringify(cleanLegacy));
            } catch (_) { }
            return cleanLegacy;
          }
        }
      }

      // Empty fleet by default — never populate demo machinery for private provider
      return [];
    } catch (e) {
      return [];
    }
  }, [user?.id, user?._id, user?.phone, user?.mobile, getDeletedEquipmentIds]);

  const [fleetList, setFleetList] = useState(loadScopedFleet);
  const [isFleetLoading, setIsFleetLoading] = useState(true);
  const [fleetError, setFleetError] = useState(null);
  const isFleetFetchingRef = React.useRef(false);

  // Sync state if user identity finishes loading after initial render
  useEffect(() => {
    const uid = user?.id || user?._id;
    if (uid) {
      const loaded = loadScopedFleet();
      if (loaded.length > 0) {
        setFleetList(prev => (prev.length === 0 ? loaded : prev));
      }
    }
  }, [user?.id, user?._id, loadScopedFleet]);

  useEffect(() => {
    const cleanFleet = deduplicateEquipment(fleetList, getDeletedEquipmentIds());
    const uid = user?.id || user?._id;
    const storageKey = getProviderFleetStorageKey(uid);
    localStorage.setItem(storageKey, JSON.stringify(cleanFleet));
    if (uid) {
      localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(cleanFleet));
    }
    try {
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanFleet));
      localStorage.setItem('agrishield_farmer_catalog_cache', JSON.stringify(cleanFleet));
      localStorage.setItem('agrishield_equipment_catalog_synced', 'true');
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) { }
  }, [fleetList, user?.id, user?._id, getDeletedEquipmentIds]);

  // Sync remote fleet items from authenticated provider endpoint
  // FIX 4 & FIX 5: Uses dedicated GET /api/v1/equipment/fleet. Never calls public /catalog.
  // M-2: Robust loading state, error banners, retry, and cached data preservation
  const fetchRemoteFleet = useCallback(async (isManualRetry = false) => {
    if (isFleetFetchingRef.current) return;
    const uid = user?.id || user?._id;
    if (!uid) {
      setIsFleetLoading(false);
      return;
    }

    isFleetFetchingRef.current = true;
    if (isManualRetry) {
      setFleetError(null);
      setIsFleetLoading(true);
    }

    try {
      const res = await API.get('/api/v1/equipment/fleet');
      let fleetItems = null;
      if (res?.data && (Array.isArray(res.data.fleet) || Array.isArray(res.data.equipment))) {
        fleetItems = Array.isArray(res.data.fleet) ? res.data.fleet : res.data.equipment;
      }

      if (Array.isArray(fleetItems)) {
        const deletedEquipIds = getDeletedEquipmentIds();
        const cleanCatalog = deduplicateEquipment(fleetItems, deletedEquipIds);
        setFleetList(cleanCatalog);
        setFleetError(null);
        try {
          const storageKey = getProviderFleetStorageKey(uid);
          localStorage.setItem(storageKey, JSON.stringify(cleanCatalog));
          localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(cleanCatalog));
          localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanCatalog));
          localStorage.setItem('agrishield_equipment_catalog_synced', 'true');
        } catch (_) { }
      }
    } catch (err) {
      console.warn('Fleet fetch warning:', err);
      // M-2: User-visible error, do not expose raw stack traces
      setFleetError(t('provider_hub.fleet_load_error', 'Could not load machinery fleet. Please check your connection and retry.'));
    } finally {
      setIsFleetLoading(false);
      isFleetFetchingRef.current = false;
    }
  }, [user?.id, user?._id, getDeletedEquipmentIds, t]);

  useEffect(() => {
    fetchRemoteFleet();
    const fleetInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchRemoteFleet(false);
    }, 30000);
    const handleFleetVisibility = () => {
      if (document.visibilityState === 'visible') fetchRemoteFleet(false);
    };
    window.addEventListener('agrishield_equipment_updated', fetchRemoteFleet);
    window.addEventListener('focus', fetchRemoteFleet);
    document.addEventListener('visibilitychange', handleFleetVisibility);

    return () => {
      clearInterval(fleetInterval);
      window.removeEventListener('agrishield_equipment_updated', fetchRemoteFleet);
      window.removeEventListener('focus', fetchRemoteFleet);
      document.removeEventListener('visibilitychange', handleFleetVisibility);
    };
  }, [fetchRemoteFleet]);

  // Persistent blacklist for deleted booking vouchers so they never resurrect across devices
  const getDeletedBookingIds = useCallback(() => {
    try {
      const raw = localStorage.getItem('agrishield_deleted_booking_ids');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }, []);

  const saveDeletedBookingId = useCallback((bookingId) => {
    try {
      const raw = localStorage.getItem('agrishield_deleted_booking_ids');
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(String(bookingId))) {
        list.push(String(bookingId));
        localStorage.setItem('agrishield_deleted_booking_ids', JSON.stringify(list));
      }
    } catch (e) { }
  }, []);

  // ── Incoming Farmer Bookings State (Multi-Device Sync with Strict Zero Duplicates) ──
  const [bookingsList, setBookingsList] = useState(() => {
    try {
      const deletedIds = getDeletedBookingIds();
      const saved = localStorage.getItem('agrishield_equipment_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const clean = deduplicateBookings(parsed, deletedIds);
          if (clean.length !== parsed.length) {
            localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(clean));
          }
          return clean;
        }
      }
    } catch (e) { }
    return [];
  });
  const [isBookingsLoading, setIsBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);
  const [updatingBookingId, setUpdatingBookingId] = useState(null);
  const isBookingsFetchingRef = React.useRef(false);

  // Delete Booking Confirmation State
  const [deleteModalBooking, setDeleteModalBooking] = useState(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);

  // Cancellation Reason Modal State (C-2)
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReasonCategory, setCancelReasonCategory] = useState('equipment_breakdown');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  const confirmDeleteBooking = async () => {
    if (!deleteModalBooking) return;
    const targetId = deleteModalBooking.id || deleteModalBooking.bookingId;
    if (!targetId) return;

    const bStatus = String(deleteModalBooking.status || '').toLowerCase();
    // Defensive guard: active or completed bookings cannot be deleted (H-4)
    if (['confirmed', 'completed'].includes(bStatus)) {
      toast.error(
        t('provider_hub.cannot_delete_active_order', 'Cannot Delete Active/Completed Order'),
        t('provider_hub.cannot_delete_active_desc', 'Active or completed bookings cannot be deleted. Please cancel instead.')
      );
      setDeleteModalBooking(null);
      return;
    }

    setIsDeletingBooking(true);
    try {
      const idempotencyKey = `idemp_del_${targetId}_${Date.now()}`;
      await API.delete(`/api/v1/equipment/bookings/${targetId}`, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      // 1. Only blacklist and sync tombstone on confirmed backend success
      saveDeletedBookingId(targetId);
      recordCrossDeviceDeletion('booking', targetId, 'Provider deleted booking');

      // 2. Remove from local state and localStorage
      setBookingsList(prev => {
        const updated = prev.filter(b => b && b.id !== targetId && b.bookingId !== targetId);
        try {
          localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });

      window.dispatchEvent(new Event('agrishield_bookings_updated'));
      toast.success(
        t('provider_hub.order_deleted', 'Order Deleted'),
        t('provider_hub.order_deleted_desc', 'Booking order #{{id}} permanently removed from your dashboard.', { id: targetId })
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(
        t('provider_hub.deletion_failed', 'Deletion Failed'),
        detail || (err?.response?.status === 400 ? t('provider_hub.cannot_delete_active_desc', 'Active or completed bookings cannot be deleted.') : 'Could not delete booking from server.')
      );
    } finally {
      setIsDeletingBooking(false);
      setDeleteModalBooking(null);
    }
  };

  // In-App Direct Chat Active Conversation for Provider
  const [activeChatBooking, setActiveChatBooking] = useState(null);

  const openChatForProviderBooking = (booking) => {
    const rawKey = String(booking.id || booking.bookingId || 'BK-1').trim();
    const cleanId = rawKey.replace(/^notif-(?:stat-)?/, '').replace(/^notif-order-/, '').replace(/^BK-/, '');
    const bKey = `BK-${cleanId}`;
    const farmerPhone = booking.farmerPhone || booking.contactPhone || booking.phone || '';
    const farmerName = booking.farmerName || t('common.farmer', 'Farmer');
    const equipmentTitle = booking.equipmentTitle || booking.title || 'Farm Machinery Rental';
    const village = booking.village || booking.location?.village || booking.location?.mandal || t('common.field_location', 'Field Location');
    const totalCost = getBookingCost(booking);

    const chatMessageObj = {
      id: bKey,
      notification_id: bKey,
      category: 'booking',
      type: 'booking',
      bookingId: bKey,
      booking_id: bKey,
      equipmentTitle: equipmentTitle,
      title: equipmentTitle,
      providerName: user?.name || user?.full_name || t('provider_hub.verified_provider', 'Verified Provider'),
      providerPhone: user?.phone || user?.mobile || '',
      provider_phone: user?.phone || user?.mobile || '',
      farmerName: farmerName,
      farmerPhone: farmerPhone,
      phone: farmerPhone,
      village: village,
      acres: booking.acres || booking.acreage || '2',
      totalCost: totalCost,
      status: booking.status || 'pending',
      bookingDate: booking.bookingDate || booking.date || 'Today',
      timeSlot: booking.timeSlot || booking.slot || 'Full Day',
      operation: booking.operation,
      fieldStatus: booking.fieldStatus || booking.crop,
      message: t('provider_hub.direct_chat_message', 'Direct in-app messaging for booking #{{id}}.', { id: bKey })
    };
    setActiveChatBooking(chatMessageObj);
  };

  // FIX 2, FIX 3, FIX 4, FIX 5: Loading state, error handling, manual retry, and cached data preservation
  const fetchProviderBookings = useCallback(async (isManualRetry = false) => {
    if (isBookingsFetchingRef.current) return;
    isBookingsFetchingRef.current = true;
    if (isManualRetry) {
      setBookingsError(null);
      setIsBookingsLoading(true);
    }

    try {
      const deletedIds = getDeletedBookingIds();
      let local = [];
      try {
        const saved = localStorage.getItem('agrishield_equipment_bookings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            local = parsed.filter(b => {
              if (!b) return false;
              const key = String(b.id || b.bookingId || '');
              return !key.startsWith('BK-TEST-') && !deletedIds.has(key);
            });
          }
        }
      } catch (e) { }

      // Fetch from backend API to pick up bookings made on PC / other phones (up to 2500 for high-volume stress testing)
      try {
        let res = await API.get('/api/v1/equipment/bookings?limit=2500');
        if (!res.data || typeof res.data !== 'object' || !Array.isArray(res.data.bookings)) {
          try { res = await API.get('/api/equipment/bookings?limit=2500'); } catch (_) { }
        }

        if (res.data?.bookings && Array.isArray(res.data.bookings)) {
          const remote = res.data.bookings.filter(b => {
            if (!b) return false;
            const key = String(b.id || b.bookingId || '');
            return !key.startsWith('BK-TEST-') && !deletedIds.has(key);
          });

          // The remote server is authoritative for historical bookings across all mobile devices
          // Preserve only recent in-flight bookings created locally in the last 45 seconds
          const nowMs = Date.now();
          const inFlight = local.filter(l => {
            const key = String(l?.id || l?.bookingId || '');
            if (deletedIds.has(key)) return false;
            const createdMs = l?.createdAt ? new Date(l.createdAt).getTime() : 0;
            return (nowMs - createdMs < 45000);
          });

          const merged = deduplicateBookings([...inFlight, ...remote], deletedIds);
          setBookingsList(merged);
          setBookingsError(null);
          try {
            localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(merged));
          } catch (e) { }
          return;
        }
      } catch (err) {
        console.warn('Booking fetch warning:', err);
        setBookingsError(t('provider_hub.orders_load_error', 'Could not load booking orders. Please check your connection and retry.'));
      }

      if (local.length > 0) {
        const clean = deduplicateBookings(local, deletedIds);
        setBookingsList(clean);
      }
    } catch (e) {
      console.warn('General booking processing notice:', e);
    } finally {
      setIsBookingsLoading(false);
      isBookingsFetchingRef.current = false;
    }
  }, [getDeletedBookingIds, t]);

  // Poll backend & listen to window/storage/visibility updates
  useEffect(() => {
    fetchProviderBookings();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchProviderBookings(false);
    }, 20000); // 20s multi-device sync with instant focus/storage/visibility revalidation
    const handleRevalidateBookings = () => {
      if (document.visibilityState === 'visible') fetchProviderBookings(false);
    };
    window.addEventListener('agrishield_bookings_updated', fetchProviderBookings);
    window.addEventListener('storage', fetchProviderBookings);
    window.addEventListener('focus', fetchProviderBookings);
    document.addEventListener('visibilitychange', handleRevalidateBookings);

    return () => {
      clearInterval(interval);
      window.removeEventListener('agrishield_bookings_updated', fetchProviderBookings);
      window.removeEventListener('storage', fetchProviderBookings);
      window.removeEventListener('focus', fetchProviderBookings);
      document.removeEventListener('visibilitychange', handleRevalidateBookings);
    };
  }, [fetchProviderBookings]);

  // Add Equipment Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('tractor');
  const [newHp, setNewHp] = useState('45 HP');
  const [newAcreRate, setNewAcreRate] = useState(1200);
  const [newHourlyRate, setNewHourlyRate] = useState(800);
  const [newAvailableFrom, setNewAvailableFrom] = useState('06:00 AM');
  const [newAvailableTo, setNewAvailableTo] = useState('06:00 PM');
  const [selectedImplements, setSelectedImplements] = useState(['Rotavator', 'Cultivator']);
  const [customImplementInput, setCustomImplementInput] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [newImageLoading, setNewImageLoading] = useState(false);
  const [newInitialHours, setNewInitialHours] = useState('120');

  const handleMachineImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setNewImageLoading(true);
      const compressed = await compressImageForUpload(file, { maxDimension: 1280, quality: 0.85 });
      const reader = new FileReader();
      reader.onload = () => {
        setNewImagePreview(reader.result);
        setNewImageLoading(false);
      };
      reader.onerror = () => {
        setNewImageLoading(false);
      };
      reader.readAsDataURL(compressed.file || file);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      setNewImageLoading(false);
    }
  };

  const IMPLEMENT_OPTIONS = [
    'Rotavator',
    'Cultivator',
    'Disc Plough',
    'Seed Drill / Sowing',
    'Paddy Harvester Cutter',
    'Trailer / Trolley',
    'Laser Land Leveler',
    'Sprayer Tank & Boom',
    'Subsoiler / Ridger',
    'Drip / Hose Reel'
  ];

  const toggleImplement = (imp) => {
    setSelectedImplements(prev =>
      prev.includes(imp) ? prev.filter(item => item !== imp) : [...prev, imp]
    );
  };

  const handleAddCustomImplement = (e) => {
    e.preventDefault();
    const trimmed = customImplementInput.trim();
    if (trimmed && !selectedImplements.includes(trimmed)) {
      setSelectedImplements(prev => [...prev, trimmed]);
      setCustomImplementInput('');
    }
  };

  const handleAddEquipment = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.warning('Validation', 'Equipment name/title is required.');
      return;
    }

    const machineId = `FL-${Date.now().toString().slice(-4)}`;
    const newMachine = {
      id: machineId,
      title: newTitle.trim(),
      teluguTitle: newTitle.trim(),
      category: newCategory,
      horsepower: newHp,
      ratePerAcre: Number(newAcreRate) || 1200,
      hourlyRate: Number(newHourlyRate) || Math.round(Number(newAcreRate) * 0.8) || 800,
      ratePerHour: Number(newHourlyRate) || Math.round(Number(newAcreRate) * 0.8) || 800,
      dailyRate: Number(newAcreRate) * 4,
      available: true,
      availableToday: true,
      imageUrl: newImagePreview || '',
      image: newImagePreview || '',
      availableTime: `${newAvailableFrom} - ${newAvailableTo}`,
      dailyAvailableTime: `${newAvailableFrom} - ${newAvailableTo}`,
      implements: selectedImplements.length > 0 ? selectedImplements : ['Standard Attachments'],
      implementsIncluded: selectedImplements.length > 0 ? selectedImplements : ['Standard Attachments'],
      village: userLocation.village || t('common.not_specified', 'Not Specified'),
      locationVillage: userLocation.village || t('common.not_specified', 'Not Specified'),
      district: userLocation.district || t('common.not_specified', 'Not Specified'),
      locationDistrict: userLocation.district || t('common.not_specified', 'Not Specified'),
      mandal: userLocation.mandal || t('common.not_specified', 'Not Specified'),
      state: userLocation.state || 'Andhra Pradesh',
      phone: user?.phone || user?.mobile || '',
      contactPhone: user?.phone || user?.mobile || '',
      providerName: user?.name || user?.username || 'Agro Equipment Provider',
      ownerName: user?.name || user?.username || 'Agro Equipment Provider',
      operatorIncluded: true,
      fuelIncluded: true,
      rating: 5.0,
      bookingsCount: 0,
      specs: `Available for booking from ${newAvailableFrom} to ${newAvailableTo}. Implements: ${selectedImplements.join(', ')}.`,
      createdAt: new Date().toISOString()
    };

    setFleetList(prev => deduplicateEquipment([newMachine, ...prev]));

    // Record initial machinery running engine hours in service tracker
    const initHours = parseFloat(newInitialHours) || 0;
    setServiceHoursMap(prev => {
      const updated = {
        ...prev,
        [machineId]: {
          currentHours: initHours,
          lastServiceHours: 0,
          serviceInterval: 250,
          lastServicedDate: new Date().toISOString().split('T')[0]
        }
      };
      try {
        localStorage.setItem('agrishield_provider_service_hours', JSON.stringify(updated));
      } catch (err) { }
      return updated;
    });

    // Also mirror to global equipment listings so farmers can discover it immediately
    try {
      const globalCustom = JSON.parse(localStorage.getItem('agrishield_custom_equipment_listings') || '[]');
      const cleanCustom = deduplicateEquipment([newMachine, ...globalCustom]);
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanCustom));
    } catch (e) { }

    // Canonical Main Backend sync
    API.post('/api/v1/equipment/catalog', newMachine).catch((err) => {
      console.warn('Backend catalog sync warning:', err);
    });

    setIsAddModalOpen(false);
    setNewTitle('');
    setNewImagePreview('');
    setNewInitialHours('120');
    toast.success('Equipment Listed!', `${newMachine.title} has been added to your live rental catalog.`);
  };

  const handleToggleMachineAvailability = async (id) => {
    const priorFleet = [...fleetList];
    let nextAvailable = false;
    const updated = fleetList.map(m => {
      if (m.id === id) {
        nextAvailable = !m.available;
        return { ...m, available: nextAvailable };
      }
      return m;
    });
    setFleetList(updated);
    try {
      const uid = user?.id || user?._id;
      localStorage.setItem(getProviderFleetStorageKey(uid), JSON.stringify(updated));
      localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(updated));
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(updated));
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) { }

    // Multi-device backend sync with authoritative confirmation
    try {
      await API.patch(`/api/v1/equipment/fleet/${id}/availability`, { available: nextAvailable });
      toast.info(
        t('provider_hub.availability_updated', 'Availability Updated'),
        nextAvailable
          ? t('provider_hub.machinery_marked_available', 'Machinery marked as Available.')
          : t('provider_hub.machinery_marked_booked', 'Machinery marked as Booked (Farmers will see it as Booked).')
      );
    } catch (err) {
      console.warn('Backend availability sync failed:', err);
      // FIX 9: Roll back prior state on failure and show user-visible error
      setFleetList(priorFleet);
      try {
        const uid = user?.id || user?._id;
        localStorage.setItem(getProviderFleetStorageKey(uid), JSON.stringify(priorFleet));
        localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(priorFleet));
        localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(priorFleet));
        window.dispatchEvent(new Event('agrishield_equipment_updated'));
      } catch (_) { }
      toast.error(
        t('provider_hub.update_failed', 'Update Failed'),
        t('provider_hub.machine_update_failed', 'Failed to update machine availability on server.')
      );
    }
  };

  // Delete Machinery Confirmation State
  const [deleteModalMachine, setDeleteModalMachine] = useState(null);
  const [isDeletingMachine, setIsDeletingMachine] = useState(false);

  const confirmDeleteMachine = async () => {
    if (!deleteModalMachine) return;
    const targetId = deleteModalMachine.id;
    const targetTitle = deleteModalMachine.title || 'Farm Machinery';
    if (!targetId) return;

    setIsDeletingMachine(true);

    try {
      // 1. Dispatch DELETE to backend API first
      await API.delete(`/api/v1/equipment/catalog/${targetId}`);

      // 2. Blacklist machinery ID & title only after server confirmation
      saveDeletedEquipmentId(targetId, targetTitle);
      recordCrossDeviceDeletion('equipment', targetId, 'Provider deleted machinery');

      // 3. Remove from local state and storage
      const updated = fleetList.filter(m => m.id !== targetId);
      setFleetList(updated);
      try {
        const uid = user?.id || user?._id;
        localStorage.setItem(getProviderFleetStorageKey(uid), JSON.stringify(updated));
        localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(updated));
        localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(updated));
        localStorage.setItem('agrishield_farmer_catalog_cache', JSON.stringify(updated));
        localStorage.setItem('agrishield_equipment_catalog_synced', 'true');
        window.dispatchEvent(new Event('agrishield_equipment_updated'));
      } catch (e) { }

      toast.success(
        t('provider_hub.machinery_removed', 'Machinery Removed'),
        t('provider_hub.machinery_removed_desc', '{{title}} was permanently deleted from your fleet.', { title: targetTitle })
      );
    } catch (err) {
      console.warn('Backend DELETE machinery warning:', err);
      // FIX 9: Preserve machinery on failure and show user-visible error
      toast.error(
        t('provider_hub.deletion_failed', 'Deletion Failed'),
        t('provider_hub.machine_delete_failed', 'Failed to delete machinery from server.')
      );
    } finally {
      setIsDeletingMachine(false);
      setDeleteModalMachine(null);
    }
  };

  const handleDeleteMachine = (machineOrId) => {
    if (typeof machineOrId === 'object' && machineOrId !== null) {
      setDeleteModalMachine(machineOrId);
    } else {
      const found = fleetList.find(m => m.id === machineOrId);
      if (found) setDeleteModalMachine(found);
    }
  };

  const handleUpdateBookingStatus = async (bookingId, nextStatus, cancelReason = '') => {
    // FIX 8 Action Mutex: Guard against rapid double-clicks on the same booking
    if (updatingBookingId === bookingId) return;

    // C-1 Guard: Do not allow transitioning out of terminal status
    const targetBooking = bookingsList.find(b => (b && (b.id === bookingId || b.bookingId === bookingId)));
    if (!targetBooking) return;
    const currStatus = String(targetBooking.status || 'pending').toLowerCase();
    if (['rejected', 'cancelled', 'completed'].includes(currStatus)) {
      toast.error(
        t('provider_hub.terminal_order', 'Terminal Order'),
        t('provider_hub.cannot_modify_terminal', 'Cannot modify status of a {{status}} booking.', { status: currStatus })
      );
      return;
    }

    setUpdatingBookingId(bookingId);

    // Preserve snapshot of original state for rollback on API failure
    const originalBookings = [...bookingsList];
    const originalFleet = [...fleetList];

    // Dispatch status update to canonical backend API with Idempotency-Key
    const payload = {
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };
    if (cancelReason && cancelReason.trim()) {
      payload.reason = cancelReason.trim();
      payload.cancelReason = cancelReason.trim();
    }
    const idempotencyKey = `idemp_status_${bookingId}_${nextStatus}_${Date.now()}`;

    try {
      const r = await API.patch(`/api/v1/equipment/bookings/${bookingId}/status`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      // API Success: Now and only now update local booking state
      const serverUpdated = (r?.data && typeof r.data === 'object' && r.data.booking) ? r.data.booking : null;
      const updatedBookings = bookingsList.map(b => {
        const bKey = b && (b.id || b.bookingId);
        if (bKey === bookingId) {
          return serverUpdated ? { ...b, ...serverUpdated, status: nextStatus } : { ...b, status: nextStatus, cancelReason: cancelReason || b.cancelReason, updatedAt: new Date().toISOString() };
        }
        return b;
      });

      setBookingsList(updatedBookings);
      try {
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updatedBookings));
        window.dispatchEvent(new Event('agrishield_bookings_updated'));
      } catch (e) { }

      // Auto-sync machine availability when booking is confirmed, completed, or cancelled
      const targetEquipId = targetBooking.equipmentId || targetBooking.machineId;
      const targetEquipTitle = targetBooking.equipmentTitle || targetBooking.title;

      if (nextStatus === 'confirmed') {
        // Machine is now booked
        setFleetList(prev => {
          const synced = prev.map(m => {
            if ((targetEquipId && m.id === targetEquipId) || (targetEquipTitle && m.title === targetEquipTitle)) {
              return { ...m, available: false };
            }
            return m;
          });
          try {
            const uid = user?.id || user?._id;
            localStorage.setItem(getProviderFleetStorageKey(uid), JSON.stringify(synced));
            localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(synced));
            localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(synced));
            window.dispatchEvent(new Event('agrishield_equipment_updated'));
          } catch (e) { }
          return synced;
        });
      } else if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        // Machine is freed up
        setFleetList(prev => {
          const synced = prev.map(m => {
            if ((targetEquipId && m.id === targetEquipId) || (targetEquipTitle && m.title === targetEquipTitle)) {
              return { ...m, available: true };
            }
            return m;
          });
          try {
            const uid = user?.id || user?._id;
            localStorage.setItem(getProviderFleetStorageKey(uid), JSON.stringify(synced));
            localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(synced));
            localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(synced));
            window.dispatchEvent(new Event('agrishield_equipment_updated'));
          } catch (e) { }
          return synced;
        });
      }

      // Success toast
      let toastTitle = t('provider_hub.status_updated', 'Status Updated');
      let toastMsg = t('provider_hub.order_confirmed', 'Order confirmed.');
      if (nextStatus === 'rejected') {
        toastMsg = t('provider_hub.order_declined', 'Order declined. Farmer will immediately see this status on their screen.');
      } else if (nextStatus === 'completed') {
        toastMsg = t('provider_hub.job_completed', 'Service marked completed and settled.');
      } else if (nextStatus === 'cancelled') {
        toastTitle = t('provider_hub.cancelled_tag', 'Booking Cancelled');
        toastMsg = t('provider_hub.booking_cancelled_toast', 'Booking cancelled and time slot released.');
      }
      toast.info(toastTitle, toastMsg);

      // Dispatch real-time farmer notification ONLY after confirmed backend success
      const equipTitle = targetBooking.equipmentTitle || targetBooking.title || 'Machinery';
      const bookingDate = targetBooking.bookingDate || targetBooking.date || 'Scheduled Slot';

      let notifTitle = '';
      let notifMsg = '';

      if (nextStatus === 'confirmed') {
        notifTitle = `✅ ${t('provider_hub.notif_confirmed_title', 'Machinery Booking Accepted')} (#${bookingId})`;
        notifMsg = `${t('provider_hub.notif_confirmed_msg', 'Great news! The equipment provider has ACCEPTED your booking.')} (${equipTitle}, ${bookingDate})`;
      } else if (nextStatus === 'rejected') {
        notifTitle = `❌ ${t('provider_hub.notif_rejected_title', 'Machinery Booking Declined')} (#${bookingId})`;
        notifMsg = t('provider_hub.notif_rejected_msg', 'The equipment provider is unable to accept booking due to prior commitments. Please explore other available machinery.');
      } else if (nextStatus === 'completed') {
        notifTitle = `🎉 ${t('provider_hub.notif_completed_title', 'Machinery Service Completed')} (#${bookingId})`;
        notifMsg = `${t('provider_hub.notif_completed_msg', 'Rental service has been marked COMPLETED.')} (${equipTitle})`;
      } else if (nextStatus === 'cancelled') {
        notifTitle = `⚠️ ${t('provider_hub.notif_cancelled_title', 'Machinery Booking Cancelled')} (#${bookingId})`;
        notifMsg = `${t('provider_hub.notif_cancelled_msg', 'The equipment provider has cancelled booking.')} (${equipTitle}) ${cancelReason ? '- ' + cancelReason : ''}`;
      }

      if (notifTitle) {
        const notifObj = {
          notification_id: `notif-stat-${bookingId}-${Date.now()}`,
          id: `notif-stat-${bookingId}`,
          type: 'booking_status',
          category: 'booking',
          priority: 'HIGH',
          role: 'farmer',
          target_role: 'farmer',
          title: notifTitle,
          title_te: notifTitle,
          message: notifMsg,
          message_te: notifMsg,
          booking_id: bookingId,
          bookingId: bookingId,
          read: false,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString()
        };

        try {
          const userNotifs = getUserNotificationCache(user);
          setUserNotificationCache(user, [notifObj, ...userNotifs.filter(n => n.id !== notifObj.id)]);
        } catch (e) { }

        window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: notifObj }));
      }

      // Write system confirmation milestone notice into the canonical shared booking thread if confirmed
      if (nextStatus === 'confirmed') {
        const cleanBId = String(bookingId).replace(/^notif-(?:stat-)?/, '').replace(/^BK-/, '');
        const canonicalKey = `agrishield_chat_thread_BK-${cleanBId}`;
        try {
          const thread = JSON.parse(localStorage.getItem(canonicalKey) || '[]');
          const noticeMsg = {
            id: `msg_sys_${Date.now()}`,
            sender: 'system',
            type: 'system_notice',
            text: `✅ ${t('provider_hub.notice_booking_accepted', 'Booking Accepted by Provider (Scheduled)')} (${bookingDate})`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          localStorage.setItem(canonicalKey, JSON.stringify([...thread, noticeMsg]));
          window.dispatchEvent(new CustomEvent('agrishield_chat_message_sent', {
            detail: { storageKey: canonicalKey, message: noticeMsg }
          }));
          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('agrishield_equipment_chat');
              bc.postMessage({ canonicalBookingId: `BK-${cleanBId}`, message: noticeMsg, nextStatus });
              bc.close();
            }
          } catch (_) { }
          API.post(`/api/v1/equipment/bookings/BK-${cleanBId}/messages`, noticeMsg).catch(() => { });
        } catch (_) { }
      }

      window.dispatchEvent(new Event('agrishield_bookings_updated'));
    } catch (err) {
      // C-1 State Rollback: Restore original booking and fleet state
      setBookingsList(originalBookings);
      setFleetList(originalFleet);

      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) {
        toast.error(t('provider_hub.slot_conflict', 'Conflict: This time slot is already confirmed.') + (detail ? ` (${detail})` : ''));
      } else if (status === 422) {
        toast.error(t('provider_hub.invalid_request', 'Invalid Request') + (detail ? `: ${detail}` : ''));
      } else if (status === 503) {
        toast.warning(t('provider_hub.server_busy', 'Server contention. Please retry your request in a few moments.'));
      } else {
        toast.error(t('provider_hub.update_failed', 'Update Failed'), detail || err.message);
      }
    } finally {
      setUpdatingBookingId(null);
    }
  };

  // Deduplicated Clean Lists for strict zero-duplicate render guarantees
  const cleanFleetList = useMemo(() => deduplicateEquipment(fleetList), [fleetList]);
  const cleanBookingsList = useMemo(() => deduplicateBookings(bookingsList, getDeletedBookingIds()), [bookingsList, getDeletedBookingIds]);

  // Metrics (Accurate, zero-inflated)
  const totalFleetCount = cleanFleetList.length;
  const availableFleetCount = cleanFleetList.filter(f => f.available).length;
  const pendingOrdersCount = cleanBookingsList.filter(b => b.status === 'confirmed' || b.status === 'pending' || !b.status).length;
  const actionablePendingCount = cleanBookingsList.filter(b => b.status === 'pending' || !b.status).length;
  const completedOrdersCount = cleanBookingsList.filter(b => b.status === 'completed').length;
  const totalEarnings = cleanBookingsList
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + getBookingCost(b), 0);

  // Operational Expenses & Net Profit Aggregation
  const totalLoggedExpenses = useMemo(() => {
    return cleanBookingsList
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => {
        const bId = String(b.id || b.bookingId);
        const exp = jobExpensesMap[bId];
        return sum + (exp ? (exp.totalExpenses || 0) : 0);
      }, 0);
  }, [cleanBookingsList, jobExpensesMap]);

  const totalNetPocketProfit = Math.max(0, totalEarnings - totalLoggedExpenses);

  // Unpaid Balance Dues (Udhari) Aggregation
  const totalPendingDues = useMemo(() => {
    return cleanBookingsList
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => {
        const bId = String(b.id || b.bookingId);
        const due = duesMap[bId];
        return sum + (due ? (due.balanceDue || 0) : 0);
      }, 0);
  }, [cleanBookingsList, duesMap]);

  const overdueBookingsCount = useMemo(() => {
    return cleanBookingsList
      .filter(b => b.status === 'completed')
      .filter(b => {
        const bId = String(b.id || b.bookingId);
        const due = duesMap[bId];
        return due && due.balanceDue > 0;
      }).length;
  }, [cleanBookingsList, duesMap]);

  // Rolling 7-day schedule window for Rental Calendar
  const calendarDays = useMemo(() => {
    const list = [];
    const base = new Date();
    base.setDate(base.getDate() + calendarOffsetDays);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-IN', { month: 'short' });
      const dayNum = d.getDate();
      const isToday = iso === new Date().toISOString().split('T')[0];
      list.push({ date: d, iso, dayName, monthName, dayNum, isToday });
    }
    return list;
  }, [calendarOffsetDays]);

  // ── DEDICATED STANDALONE AI COPILOT VIEW (When bottom AI Copilot tab is tapped) ──
  if (activeTab === 'copilot') {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-24 select-none">
        {/* Dedicated Copilot Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => switchTab('fleet')}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('provider_hub.back_to_fleet', 'Back to Fleet Hub')}</span>
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {t('provider_hub.copilot_title', 'AgriShield Machinery & Fleet Copilot')}
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {t('provider_hub.copilot_tag', 'Strict Machinery Domain')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('provider_hub.copilot_subtitle', 'Specialized expert for tractors, spray drones, diesel/acre formulas & rental economics')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearCopilotChat}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('provider_hub.copilot_clear_chat', 'Clear Chat')}</span>
          </button>
        </div>

        {/* The Chat Container */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          {/* Quick Prompt Presets */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {t('provider_hub.copilot_quick_questions', 'Quick Machinery Inquiries')}
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {COPILOT_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendCopilot(p.query)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Chat Stream */}
          <div className="min-h-[350px] max-h-[550px] overflow-y-auto py-4 space-y-3.5 pr-1">
            {copilotMessages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black shadow-xs ${isUser
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                    }`}>
                    {isUser ? (user?.name ? user.name[0].toUpperCase() : 'U') : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed ${isUser
                    ? 'bg-indigo-600 text-white rounded-tr-none font-medium'
                    : 'bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none font-normal'
                    }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              );
            })}

            {copilotLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span>{t('provider_hub.copilot_consulting', 'Consulting machinery telemetry & calculating...')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendCopilot();
            }}
            className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              placeholder={t('provider_hub.copilot_input_placeholder', 'Ask about tractor maintenance, drone battery care, diesel formulas, or rental rates...')}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!copilotInput.trim() || copilotLoading}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('provider_hub.copilot_send_btn', 'Ask Copilot')}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── ROLE GUARD: If a user is logged in as a Farmer, do not show Provider Portal with orders ──
  if (user && user?.role?.toLowerCase() === 'farmer') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 shadow-xl text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Truck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              {t('provider_hub.farmer_account_detected', 'Farmer Account Detected')}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('provider_hub.provider_hub_only', 'Machinery Provider Hub')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              {t('provider_hub.farmer_logged_in_notice', 'You are currently logged in as a Farmer. The Provider Dashboard is reserved exclusively for registered Machinery & Drone Providers. To book tractors, harvesters, spray drones or track your booking status, please visit Farm Machinery Rentals.')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/equipment-booking')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>{t('provider_hub.go_to_rentals', 'Go to Farm Machinery Rentals →')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/more')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              <span>{t('common.back', 'Back to Tools')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const providerDisplayName = user?.provider_profile?.hub_name || user?.provider_profile?.business_name || user?.name || user?.username || 'Agri Machinery Provider';
  const hubVillage = userLocation.village || user?.provider_profile?.hub_name || t('common.not_specified', 'Not Specified');
  const hubDistrict = userLocation.district || user?.district || t('common.not_specified', 'Not Specified');

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 select-none">
      {/* ── TOP HERO BANNER & CONTROL BAR (Clean Borders & Structured Boxes) ── */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {providerDisplayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {t('provider_hub.verified_provider', 'Verified Provider')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('provider_hub.base_hub', 'Base Hub:')} <strong>{hubVillage}</strong>, {hubDistrict} (AP)</span>
              </p>
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Machinery Provider Helpdesk Link */}
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="px-4 py-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center gap-2 transition-all shadow-xs cursor-pointer btn-spring"
              title={t('provider_hub.helpdesk_support', 'Machinery Provider Helpdesk & Support')}
            >
              <Headphones className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('provider_hub.helpdesk_support', 'Helpdesk & Support')}</span>
            </button>

            {/* ── HIGH VISIBILITY ONLINE / OFFLINE TOGGLE BUTTON ── */}
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`group relative px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-3 transition-all cursor-pointer shadow-sm select-none ${isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/80 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-500/80 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                }`}
              title={isOnline ? 'Click to toggle Offline / Pause bookings' : 'Click to toggle Online / Start taking bookings'}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {isOnline && <span className="absolute w-4 h-4 rounded-full bg-emerald-400 opacity-75 animate-ping" />}
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold leading-none mb-0.5">
                    {t('provider_hub.today_status', "Today's Status")}
                  </p>
                  <span className="text-xs font-black leading-none">
                    {isOnline
                      ? t('provider_hub.online_taking_orders', 'Online Today (Taking Bookings)')
                      : t('provider_hub.offline_orders_paused', 'Offline Today (Orders Paused)')}
                  </span>
                </div>
              </div>

              {/* Modern Switch Pill Graphic */}
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${isOnline ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}>
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </div>
            </button>

            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-4 py-2 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t('provider_hub.add_machinery_btn', 'Add Machinery')}</span>
            </Button>

            <button
              type="button"
              onClick={() => navigate('/support')}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Provider Support & Help Desk"
            >
              <Headphones className="w-4 h-4 text-sky-500" />
              <span className="hidden sm:inline">{t('provider_hub.helpdesk_support', 'Help Desk')}</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── 4 BEAUTIFUL WORKSTATION CARDS (Boxes with Dedicated Page Switching) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Machinery Fleet Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('fleet')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('fleet')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${activeTab === 'fleet'
            ? 'bg-gradient-to-br from-indigo-500/10 via-white to-indigo-500/5 dark:from-indigo-950/40 dark:via-[#0c1626] dark:to-[#070e17] border-2 border-indigo-600 dark:border-indigo-400 shadow-xl shadow-indigo-600/10 ring-4 ring-indigo-500/10'
            : 'bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg'
            }`}
        >
          {/* Subtle Ambient Background Watermark */}
          <div className="absolute -right-3 -bottom-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <Truck className="w-28 h-28 text-indigo-600 dark:text-indigo-400" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 group-hover:scale-105 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
            {activeTab === 'fleet' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-indigo-600 text-white shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t('provider_hub.active_page', 'Active Page')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <span>{t('provider_hub.open_page', 'Open Page')}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {t('provider_hub.machinery_fleet_tab', 'Machinery Fleet')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {t('provider_hub.machinery_fleet_desc', 'List and manage tractors, spray drones, harvesters & live equipment availability')}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
              {cleanFleetList.length} {cleanFleetList.length === 1 ? t('provider_hub.machine_single', 'Machine') : t('provider_hub.machine_plural', 'Machines')}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
              {availableFleetCount} {t('provider_hub.ready_for_hire', 'Ready for Hire')}
            </span>
          </div>
        </div>

        {/* CARD 2: Booking Orders Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('orders')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('orders')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${activeTab === 'orders'
            ? 'bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 dark:from-amber-950/40 dark:via-[#191508] dark:to-[#070e17] border-2 border-amber-500 dark:border-amber-400 shadow-xl shadow-amber-500/10 ring-4 ring-amber-500/10'
            : 'bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg'
            }`}
        >
          {/* Subtle Ambient Background Watermark */}
          <div className="absolute -right-3 -bottom-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <Calendar className="w-28 h-28 text-amber-500 dark:text-amber-400" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            {activeTab === 'orders' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-500 text-white shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>{t('provider_hub.active_page', 'Active Page')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                <span>{t('provider_hub.open_page', 'Open Page')}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {t('provider_hub.booking_orders_tab', 'Booking Orders')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {t('provider_hub.booking_orders_desc', 'Direct farmer hire requests, field schedules, dispatching & customer coordination')}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            {pendingOrdersCount > 0 ? (
              <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-400 text-amber-950 border border-amber-300 animate-pulse">
                ⚡ {pendingOrdersCount} {t('provider_hub.action_required', 'Action Required')}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                0 {t('provider_hub.pending_status', 'Pending')}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {completedOrdersCount} {t('provider_hub.completed_status', 'Completed')}
            </span>
          </div>
        </div>

        {/* CARD 3: Rental Schedule Calendar Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('calendar')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('calendar')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${activeTab === 'calendar'
            ? 'bg-gradient-to-br from-sky-500/10 via-white to-sky-500/5 dark:from-sky-950/40 dark:via-[#091522] dark:to-[#070e17] border-2 border-sky-500 dark:border-sky-400 shadow-xl shadow-sky-500/10 ring-4 ring-sky-500/10'
            : 'bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-lg'
            }`}
        >
          {/* Subtle Ambient Background Watermark */}
          <div className="absolute -right-3 -bottom-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <Calendar className="w-28 h-28 text-sky-500 dark:text-sky-400" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            {activeTab === 'calendar' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-sky-500 text-white shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>{t('provider_hub.active_page', 'Active Page')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                <span>{t('provider_hub.open_page', 'Open Page')}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {t('provider_hub.calendar_tab', 'Rental Calendar')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {t('provider_hub.calendar_desc', '7-day & 30-day slot matrix per tractor. Prevent double-booking.')}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60">
              7-Day View
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Slot Matrix
            </span>
          </div>
        </div>

        {/* CARD 4: Earnings & Ledger Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('earnings')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('earnings')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${activeTab === 'earnings'
            ? 'bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5 dark:from-emerald-950/40 dark:via-[#091a13] dark:to-[#070e17] border-2 border-emerald-500 dark:border-emerald-400 shadow-xl shadow-emerald-500/10 ring-4 ring-emerald-500/10'
            : 'bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg'
            }`}
        >
          {/* Subtle Ambient Background Watermark */}
          <div className="absolute -right-3 -bottom-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="w-28 h-28 text-emerald-500 dark:text-emerald-400" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            {activeTab === 'earnings' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>{t('provider_hub.active_page', 'Active Page')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span>{t('provider_hub.open_page', 'Open Page')}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {t('provider_hub.earnings_ledger_tab', 'Earnings & Profit')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {t('provider_hub.earnings_ledger_desc', 'Direct farmer rental collections, diesel expense deductions & net profit')}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
              ₹{totalEarnings.toLocaleString('en-IN')}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60">
              0% Fee
            </span>
          </div>
        </div>
      </div>

      {/* ── DEDICATED PAGE 1: MACHINERY FLEET INVENTORY ── */}
      {activeTab === 'fleet' && (
        <motion.div
          key="fleet-page"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Dedicated Page Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                <span>{t('provider_hub.provider_badge', 'Provider Hub')}</span>
                <span>/</span>
                <span>{t('provider_hub.machinery_fleet_tab', 'Machinery Fleet')}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🚜</span>
                <span>{t('provider_hub.active_inventory_title', 'Active Machinery Inventory')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('provider_hub.active_inventory_desc', 'Manage your listed tractors, spray drones, and harvest equipment for nearby farmers')}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {cleanFleetList.length} {cleanFleetList.length === 1 ? t('provider_hub.machine_single', 'Machine') : t('provider_hub.machine_plural', 'Machines')}
              </span>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('provider_hub.add_equipment', 'Add Machine')}</span>
              </Button>
            </div>
          </div>

          {/* M-2 FIX 5: Cached Data Warning Banner */}
          {fleetError && cleanFleetList.length > 0 && (
            <div className="p-3 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{t('provider_hub.showing_cached_data', 'Showing cached data. Sync failed.')}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchRemoteFleet(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFleetLoading ? 'animate-spin' : ''}`} />
                <span>{t('provider_hub.retry_sync', 'Retry Sync')}</span>
              </button>
            </div>
          )}

          {/* M-2 FIX 1 & FIX 6: Fleet Loading Skeletons, Error, Empty, and Success states */}
          {isFleetLoading && cleanFleetList.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="fleet-skeleton-loader">
              {[1, 2, 3].map((sk) => (
                <div key={sk} className="bg-white dark:bg-[#070e17] rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm animate-pulse space-y-4">
                  <div className="h-44 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : !isFleetLoading && fleetError && cleanFleetList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20" data-testid="fleet-error-state">
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 border border-rose-300 dark:border-rose-800 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 mb-3">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-rose-900 dark:text-rose-200">
                {t('provider_hub.fleet_load_error', 'Could not load machinery fleet. Please check your connection and retry.')}
              </h3>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchRemoteFleet(true)}
                  className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t('provider_hub.retry_sync', 'Retry Sync')}</span>
                </button>
              </div>
            </div>
          ) : cleanFleetList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17]" data-testid="fleet-empty-state">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-3">
                <Truck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
                {t('provider_hub.no_machinery_listed', 'No machinery listed yet')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {t('provider_hub.no_machinery_listed_desc', 'Add your tractors, spray drones, or harvesting equipment to start receiving rental bookings from farmers.')}
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-4 py-2 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('provider_hub.add_equipment', 'Add Machine')}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cleanFleetList.map((machine) => (
                <motion.div
                  key={machine.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-[#070e17] rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* High-res Studio Cutout Machinery Image Container */}
                    <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-3.5 flex items-center justify-center p-2">
                      <img
                        src={machine.imageUrl || machine.image || getEquipmentFallbackImage(machine.category, machine.title)}
                        alt={machine.title}
                        className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getEquipmentFallbackImage(machine.category, machine.title);
                        }}
                      />

                      {/* Top Left Badge: Category & Power */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-600/95 text-white backdrop-blur-md shadow-sm flex items-center gap-1">
                          <span>{machine.category === 'drone' ? '🛸' : machine.category === 'irrigation' ? '💧' : machine.category === 'harvester' ? '🌾' : '🚜'}</span>
                          <span className="capitalize">{machine.category || 'Machinery'}</span>
                        </span>
                        {machine.horsepower && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md">
                            {machine.horsepower}
                          </span>
                        )}
                      </div>

                      {/* Top Right Badge: Interactive Quick Toggle Availability */}
                      <div className="absolute top-2.5 right-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleMachineAvailability(machine.id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${machine.available
                            ? 'bg-emerald-500/90 text-white border-emerald-400 hover:bg-emerald-600'
                            : 'bg-slate-900/85 text-slate-300 border-slate-700 hover:bg-slate-800'
                            }`}
                          title={t('provider_hub.update_status', 'Click to toggle availability')}
                        >
                          <span className={`w-2 h-2 rounded-full ${machine.available ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                          <span>{machine.available ? t('provider_hub.available_tag', 'Available') : t('provider_hub.booked_tag', 'Booked')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Machine Title */}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {machine.title}
                    </h3>

                    {/* Operator Specs & Fuel Status */}
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{machine.operatorIncluded ? t('provider_hub.driver_included', 'Driver Included') : t('provider_hub.self_drive', 'Self-Drive')}</span>
                      <span>•</span>
                      <span>{machine.fuelIncluded ? t('provider_hub.fuel_included', 'Fuel Included') : t('provider_hub.fuel_extra', 'Fuel Extra')}</span>
                      {machine.dailyAvailableTime && (
                        <>
                          <span>•</span>
                          <span>{machine.dailyAvailableTime}</span>
                        </>
                      )}
                    </p>

                    {/* Pricing Display */}
                    <div className="flex items-baseline gap-1 mt-2.5">
                      <span className="text-xl font-black text-slate-900 dark:text-white">
                        ₹{machine.ratePerAcre || machine.hourlyRate || 1200}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        / {machine.ratePerAcre ? t('provider_hub.per_acre_unit', 'Acre') : t('provider_hub.per_hour_unit', 'hr')}
                      </span>
                      {machine.dailyRate && (
                        <span className="text-[11px] text-slate-400 font-medium ml-1">
                          (or ₹{machine.dailyRate}/day)
                        </span>
                      )}
                    </div>

                    {/* Implements tag list */}
                    {machine.implementsIncluded && machine.implementsIncluded.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {machine.implementsIncluded.map((imp, i) => (
                          <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            ⚙️ {imp}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Machinery Engine Running Hours & 250hr Maintenance Meter */}
                    {(() => {
                      const service = getMachineServiceInfo(machine.id);
                      const isDueSoon = service.remaining <= 40;
                      const isOverdue = service.remaining === 0;
                      return (
                        <div className="mt-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-black">
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{t('provider_hub.engine_hours', 'Engine Running Hours')}</span>
                            </span>
                            <span className="font-mono text-slate-900 dark:text-white">
                              {service.currentHours} / 250 hrs
                            </span>
                          </div>

                          {/* Progress Bar for 250hr Oil Change / Service Interval */}
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isOverdue
                                ? 'bg-rose-500'
                                : isDueSoon
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                                }`}
                              style={{ width: `${service.percent}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className={isOverdue ? 'text-rose-600 dark:text-rose-400 font-black' : isDueSoon ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400'}>
                              {isOverdue
                                ? `⚠️ ${t('provider_hub.service_urgent', 'Service Due!')}`
                                : `${t('provider_hub.service_due_in', 'Next service in')} ${service.remaining}h`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMarkMachineServiced(machine.id, machine.title)}
                              className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              title="Reset 250hr counter after oil change"
                            >
                              {t('provider_hub.mark_serviced', 'Mark Serviced 🛠️')}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bottom Meta & Controls */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[150px]">{machine.locationVillage || machine.village || 'Hub Base'}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleMachineAvailability(machine.id)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {machine.available ? t('provider_hub.mark_busy', 'Mark Busy') : t('provider_hub.mark_free', 'Mark Free')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModalMachine(machine)}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title={t('provider_hub.delete_machinery_tooltip', 'Delete Machinery Listing')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── DEDICATED PAGE 2: INCOMING FARMER BOOKING ORDERS ── */}
      {activeTab === 'orders' && (
        <motion.div
          key="orders-page"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Dedicated Page Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                <span>{t('provider_hub.provider_badge', 'Provider Hub')}</span>
                <span>/</span>
                <span>{t('provider_hub.booking_orders_tab', 'Booking Orders')}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📅</span>
                <span>{t('provider_hub.farmer_requests_title', 'Farmer Rental Booking Orders')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('provider_hub.farmer_requests_desc', 'Accept, decline, coordinate with farmers, and mark field jobs completed')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingOrdersCount > 0 && (
                <span className="px-3 py-1.5 rounded-2xl text-xs font-black bg-amber-400 text-amber-950 border border-amber-300 animate-pulse">
                  ⚡ {pendingOrdersCount} {t('provider_hub.action_required', 'Action Required')}
                </span>
              )}
              <span className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {cleanBookingsList.length} {cleanBookingsList.length === 1 ? t('provider_hub.order_single', 'Order') : t('provider_hub.order_plural', 'Orders')}
              </span>
            </div>
          </div>

          {/* M-2 FIX 5: Cached Data Warning Banner */}
          {bookingsError && cleanBookingsList.length > 0 && (
            <div className="p-3 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{t('provider_hub.showing_cached_data', 'Showing cached data. Sync failed.')}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchProviderBookings(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBookingsLoading ? 'animate-spin' : ''}`} />
                <span>{t('provider_hub.retry_sync', 'Retry Sync')}</span>
              </button>
            </div>
          )}

          {/* M-2 FIX 2 & FIX 7: Bookings Loading Skeletons, Error, Empty, and Success states */}
          {isBookingsLoading && cleanBookingsList.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="orders-skeleton-loader">
              {[1, 2, 3].map((sk) => (
                <div key={sk} className="bg-white dark:bg-[#070e17] rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm animate-pulse space-y-4">
                  <div className="h-40 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/2" />
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : !isBookingsLoading && bookingsError && cleanBookingsList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20" data-testid="orders-error-state">
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 border border-rose-300 dark:border-rose-800 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 mb-3">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-rose-900 dark:text-rose-200">
                {t('provider_hub.orders_load_error', 'Could not load booking orders. Please check your connection and retry.')}
              </h3>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchProviderBookings(true)}
                  className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t('provider_hub.retry_sync', 'Retry Sync')}</span>
                </button>
              </div>
            </div>
          ) : cleanBookingsList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17]" data-testid="orders-empty-state">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-3">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                {t('provider_hub.no_bookings_title', 'No Rental Bookings Yet')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {t('provider_hub.no_bookings_desc', 'When farmers in your mandal browse and book machinery, their live rental orders will appear here immediately.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cleanBookingsList.map((booking) => {
                const farmerPhone = booking.farmerPhone || booking.contactPhone || booking.phone || '';
                const cleanPhone = String(farmerPhone).replace(/[^0-9]/g, '');
                const farmerName = booking.farmerName || t('common.farmer', 'Farmer');
                const equipmentTitle = booking.equipmentTitle || booking.title || t('equipment_hub.title', 'Farm Machinery Rental');
                const village = booking.village || booking.location?.village || booking.location?.mandal || t('common.field_location', 'Field Location');
                const date = booking.bookingDate || booking.date || 'Today';
                const slot = booking.timeSlot || booking.slot || 'Full Day';
                const acres = booking.acres || booking.acreage || '2';
                const crop = booking.targetCrop || booking.crop || 'Field Crop';
                const totalCost = getBookingCost(booking);

                const isPending = !booking.status || booking.status === 'pending';
                const isConfirmed = booking.status === 'confirmed';
                const isCompleted = booking.status === 'completed';
                const isDeclined = booking.status === 'rejected' || booking.status === 'declined' || booking.status === 'cancelled';

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white dark:bg-[#070e17] rounded-3xl p-4 sm:p-5 border shadow-sm transition-all duration-300 flex flex-col justify-between group ${isPending
                      ? 'border-amber-300 dark:border-amber-800/80 bg-amber-500/[0.015]'
                      : isConfirmed
                        ? 'border-sky-300 dark:border-sky-800/80'
                        : isCompleted
                          ? 'border-emerald-300 dark:border-emerald-800/80'
                          : 'border-rose-200 dark:border-rose-900/60 bg-rose-500/[0.015]'
                      }`}
                  >
                    <div>
                      {/* High-res Studio Cutout Machinery Image Container */}
                      <div className="relative h-40 sm:h-44 w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-3 flex items-center justify-center p-2">
                        <img
                          src={booking.imageUrl || booking.image || getEquipmentFallbackImage(booking.category, equipmentTitle)}
                          alt={equipmentTitle}
                          className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getEquipmentFallbackImage(booking.category, equipmentTitle);
                          }}
                        />

                        {/* Top Left Badge: Action Status */}
                        <div className="absolute top-2.5 left-2.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase backdrop-blur-md shadow-sm border flex items-center gap-1 ${isCompleted
                            ? 'bg-emerald-600/95 text-white border-emerald-400'
                            : isDeclined
                              ? 'bg-rose-600/95 text-white border-rose-400'
                              : isConfirmed
                                ? 'bg-sky-600/95 text-white border-sky-400'
                                : 'bg-amber-500/95 text-white border-amber-300 animate-pulse'
                            }`}>
                            {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                            {isConfirmed && <Check className="w-3 h-3 stroke-[2.5]" />}
                            {isDeclined && <X className="w-3 h-3" />}
                            {isPending && <Clock className="w-3 h-3" />}
                            <span>
                              {isPending ? t('provider_hub.pending_action', 'Pending Action') :
                                isConfirmed ? t('provider_hub.confirmed_scheduled', 'Confirmed & Scheduled') :
                                  isCompleted ? t('provider_hub.completed_status', 'Completed') :
                                    t('provider_hub.declined_tag', 'Declined')}
                            </span>
                          </span>
                        </div>

                        {/* Top Right Voucher Code */}
                        <div className="absolute top-2.5 right-2.5">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-slate-900/85 text-white backdrop-blur-md shadow-sm">
                            #{booking.id || booking.bookingId}
                          </span>
                        </div>
                      </div>

                      {/* Machine Rented Title */}
                      <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                        {equipmentTitle}
                      </h3>

                      {/* Customer Dossier Card */}
                      <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{t('provider_hub.farmer_label', 'Farmer:')}</span>
                          </span>
                          <strong className="text-slate-900 dark:text-white font-black">{farmerName}</strong>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold">{t('provider_hub.area_work_label', 'Area & Work:')}</span>
                          <span className="text-slate-800 dark:text-slate-200 font-bold">
                            {acres} {t('provider_hub.acres_unit', 'Acres')} {booking.operation ? `• ${booking.operation}` : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold">{t('provider_hub.crop_stage_label', 'Crop / Stage:')}</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                            {booking.fieldStatus || crop}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{date} ({slot})</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[110px]">{village}</span>
                          </span>
                        </div>
                      </div>

                      {/* Total Rental Amount Display */}
                      <div className="flex items-center justify-between mt-3 px-1">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">{t('provider_hub.total_rental_fare', 'Total Rental Fare')}</p>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            ₹{Number(totalCost).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {t('provider_hub.direct_pay_badge', 'Direct Pay (0% Fee)')}
                        </span>
                      </div>

                      {/* Advance & Dues Status Badge */}
                      {(() => {
                        const bId = String(booking.id || booking.bookingId);
                        const dues = duesMap[bId];
                        if (!dues) return null;
                        return (
                          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-500">
                              {t('provider_hub.advance_paid', 'Advance')}: ₹{(dues.advancePaid || 0).toLocaleString('en-IN')}
                            </span>
                            <span className={dues.balanceDue > 0 ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-emerald-600 dark:text-emerald-400 font-black'}>
                              {dues.balanceDue > 0 ? `${t('provider_hub.balance_due', 'Due')}: ₹${dues.balanceDue.toLocaleString('en-IN')}` : `✓ ${t('provider_hub.fully_settled', 'Fully Paid')}`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Provider Action Buttons (Clean & High Contrast) */}
                    {/* FIX 8: Per-booking action mutex disables button and shows spinner when updating */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      {isPending && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={updatingBookingId === (booking.id || booking.bookingId)}
                            onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'confirmed')}
                            className={`w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer ${updatingBookingId === (booking.id || booking.bookingId) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            {updatingBookingId === (booking.id || booking.bookingId) ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            )}
                            <span>{t('provider_hub.accept_booking', 'Accept Booking')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={updatingBookingId === (booking.id || booking.bookingId)}
                            onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'rejected')}
                            className={`w-full py-2.5 px-3 rounded-xl border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${updatingBookingId === (booking.id || booking.bookingId) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            <X className="w-4 h-4" />
                            <span>{t('provider_hub.decline', 'Decline')}</span>
                          </button>
                        </div>
                      )}

                      {isConfirmed && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={updatingBookingId === (booking.id || booking.bookingId)}
                            onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'completed')}
                            className={`w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer ${updatingBookingId === (booking.id || booking.bookingId) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            {updatingBookingId === (booking.id || booking.bookingId) ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>{t('provider_hub.mark_completed', 'Complete')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={updatingBookingId === (booking.id || booking.bookingId)}
                            onClick={() => setCancelModalBooking(booking)}
                            className={`w-full py-2.5 px-3 rounded-xl border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${updatingBookingId === (booking.id || booking.bookingId) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            <X className="w-4 h-4" />
                            <span>{t('provider_hub.cancel_booking', 'Cancel')}</span>
                          </button>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>{t('provider_hub.settled_logged', 'Settled & Logged')}</span>
                          </span>
                        </div>
                      )}

                      {isDeclined && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold">
                              {booking.status === 'cancelled' ? t('provider_hub.cancelled_tag', 'Cancelled') : t('provider_hub.declined_tag', 'Declined')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDeleteModalBooking(booking)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title={t('provider_hub.delete_order_tooltip', 'Delete Order')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Real-World Upgrade 4: 1-Tap Google Maps Plot GPS Navigation */}
                      <button
                        type="button"
                        onClick={() => handleNavigateToPlot(booking)}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Open Google Maps directions to farmer's field"
                      >
                        <Navigation className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{t('provider_hub.navigate_to_plot', 'Navigate to Plot (GPS)')}</span>
                      </button>

                      {/* Real-World Upgrades 2, 3, 5: Quick Billing, Diesel/Driver Cost, & Dues Buttons */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReceiptModalBooking(booking)}
                          className="py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Generate & Share WhatsApp Bill / Receipt"
                        >
                          <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Bill</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenExpenseModal(booking)}
                          className="py-1.5 px-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Log Diesel Liters & Driver Cost to Calculate Pocket Profit"
                        >
                          <Fuel className="w-3.5 h-3.5 text-amber-600" />
                          <span>Fuel/Cost</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDuesModal(booking)}
                          className="py-1.5 px-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Record Advance Paid & Track Pending Balance Dues"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Dues</span>
                        </button>
                      </div>

                      {/* Direct Communication Bar: 3 Options (In-App Message, WhatsApp, Call) */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => openChatForProviderBooking(booking)}
                          className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                          title={t('provider_hub.in_app_chat_tooltip', 'In-App Direct Chat with Farmer')}
                        >
                          <MessageSquare className="w-3.5 h-3.5 fill-white shrink-0" />
                          <span className="truncate">{t('provider_hub.message_btn', 'Message')}</span>
                        </button>

                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                            `${t('provider_hub.whatsapp_greeting', 'Hello! Contacting you regarding your machinery booking on AgriShield.')} (${farmerName} - #${booking.id} - ${equipmentTitle})`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                          title="WhatsApp"
                        >
                          <span className="text-[12px] leading-none shrink-0">🟢</span>
                          <span className="truncate">WhatsApp</span>
                        </a>

                        <a
                          href={`tel:${cleanPhone}`}
                          className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
                          title={t('provider_hub.call_farmer_tooltip', 'Call Farmer')}
                        >
                          <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{t('provider_hub.call_btn', 'Call')}</span>
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── DEDICATED PAGE: RENTAL SCHEDULE CALENDAR (Slot Matrix) ── */}
      {activeTab === 'calendar' && (
        <motion.div
          key="calendar-page"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Calendar Header Card */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">
                  <span>{t('provider_hub.provider_badge', 'Provider Hub')}</span>
                  <span>/</span>
                  <span>{t('provider_hub.calendar_tab', 'Rental Calendar')}</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📅</span>
                  <span>Interactive Machinery Schedule & Slot Matrix</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visual booking timeline to prevent accidental double-booking during peak agricultural seasons
                </p>
              </div>

              {/* Navigation Controls for 7-Day Window */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCalendarOffsetDays(prev => prev - 7)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev 7 Days</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarOffsetDays(0)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${calendarOffsetDays === 0
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarOffsetDays(prev => prev + 7)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Next 7 Days</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Available / Free</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Pending Farmer Hire</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Confirmed on Field</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>Maintenance / Self-Use</span>
              </span>
            </div>
          </div>

          {/* Slot Matrix Table / Grid */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] overflow-hidden shadow-sm">
            {cleanFleetList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No machinery listed in your fleet yet. Add a tractor in the Fleet Hub to view its schedule matrix.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs font-black text-slate-700 dark:text-slate-300">
                      <th className="p-4 w-52 min-w-[180px]">Machinery Item</th>
                      {calendarDays.map((day) => (
                        <th
                          key={day.iso}
                          className={`p-3 text-center min-w-[120px] ${day.isToday ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' : ''
                            }`}
                        >
                          <div className="text-[10px] uppercase font-bold text-slate-400">{day.dayName}</div>
                          <div className="text-sm font-black text-slate-800 dark:text-slate-100">{day.dayNum} {day.monthName}</div>
                          {day.isToday && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-sky-500 text-white">
                              TODAY
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {cleanFleetList.map((machine) => {
                      return (
                        <tr key={machine.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 align-top">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                <img
                                  src={machine.imageUrl || getEquipmentFallbackImage(machine.category, machine.title)}
                                  alt={machine.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 dark:text-white truncate max-w-[140px]">
                                  {machine.title}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold truncate">
                                  {machine.horsepower || machine.category} • ₹{machine.ratePerAcre || machine.hourlyRate}/ac
                                </p>
                              </div>
                            </div>
                          </td>

                          {calendarDays.map((day) => {
                            // Find any active booking on this date for this machine
                            const booking = cleanBookingsList.find((b) => {
                              const bDate = String(b.bookingDate || b.startDate || b.date || '').split('T')[0];
                              const bMachine = b.equipmentId || b.equipment_id;
                              const matchMachine = bMachine ? String(bMachine) === String(machine.id) : true;
                              return matchMachine && bDate === day.iso && ['confirmed', 'in_progress', 'pending'].includes(b.status || 'pending');
                            });

                            const isBlocked = Boolean(calendarBlocks[`${machine.id}_${day.iso}`]);
                            const blockData = calendarBlocks[`${machine.id}_${day.iso}`];

                            return (
                              <td key={day.iso} className="p-2 align-top text-center border-l border-slate-100 dark:border-slate-800/60">
                                {booking ? (
                                  booking.status === 'pending' ? (
                                    <div
                                      onClick={() => switchTab('orders')}
                                      className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-left space-y-1 cursor-pointer hover:shadow-sm transition-shadow"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">⚡ Pending</span>
                                        <span className="text-[9px] font-mono font-bold">₹{getBookingCost(booking).toLocaleString('en-IN')}</span>
                                      </div>
                                      <p className="font-bold text-[11px] truncate">{booking.farmerName || 'Farmer'}</p>
                                      <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 truncate">{booking.acres || 2} ac</p>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => setReceiptModalBooking(booking)}
                                      className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200 text-left space-y-1 cursor-pointer hover:shadow-sm transition-shadow group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">🔴 Booked</span>
                                        <span className="text-[9px] font-mono font-bold">₹{getBookingCost(booking).toLocaleString('en-IN')}</span>
                                      </div>
                                      <p className="font-bold text-[11px] truncate">{booking.farmerName || 'Farmer'}</p>
                                      <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 truncate">{booking.village || 'Field'}</p>
                                    </div>
                                  )
                                ) : isBlocked ? (
                                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">🔒 Blocked</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleBlockSlot(machine.id, day.iso)}
                                        className="text-[9px] font-bold text-rose-500 hover:underline cursor-pointer"
                                      >
                                        Unlock
                                      </button>
                                    </div>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold truncate">
                                      {blockData?.reason || 'Maintenance'}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-left space-y-1.5 group">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✨ Free</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSlotBlockModalData({ machine, dateIso: day.iso, dateStr: `${day.dayNum} ${day.monthName}` });
                                      }}
                                      className="w-full py-1 px-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-sky-400 transition-colors cursor-pointer"
                                    >
                                      + Lock Slot
                                    </button>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── DEDICATED PAGE 3: EARNINGS & PAYMENT LEDGER ── */}
      {activeTab === 'earnings' && (
        <motion.div
          key="earnings-page"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                  <span>{t('provider_hub.provider_badge', 'Provider Hub')}</span>
                  <span>/</span>
                  <span>{t('provider_hub.earnings_ledger_tab', 'Earnings & Ledger')}</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💰</span>
                  <span>{t('provider_hub.earnings_title', 'Direct Payout & Settled Ledger')}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('provider_hub.earnings_desc', 'Direct payments received from farmers for completed machinery rentals')}
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-2xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>0% Commission (Direct)</span>
              </span>
            </div>

            {/* 4 Studio Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('provider_hub.gross_revenue', 'Gross Revenue')}</p>
                  <DollarSign className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹{totalEarnings.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">{completedOrdersCount} field operations total</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">{t('provider_hub.operational_expenses', 'Operating Expenses')}</p>
                  <Fuel className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1">₹{totalLoggedExpenses.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">Diesel fuel & operator wages</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">{t('provider_hub.net_pocket_profit', 'Net Pocket Profit')}</p>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">₹{totalNetPocketProfit.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                  {totalEarnings > 0 ? `${Math.round((totalNetPocketProfit / totalEarnings) * 100)}% Real Margin` : '100% Retained'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">{t('provider_hub.balance_due', 'Unpaid Dues (బాకీలు)')}</p>
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <p className="text-2xl font-black text-rose-800 dark:text-rose-200 mt-1">₹{totalPendingDues.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
                  {overdueBookingsCount} farmers with balance
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                {t('provider_hub.direct_payments_explanation', 'All equipment rental payments occur directly between you and the farmer (Cash on Field, PhonePe, or Google Pay). AgriShield AI takes 0% commission.')}
              </span>
            </div>
          </div>

          {/* Completed Jobs Feed / History */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>{t('provider_hub.completed_ops_ledger', 'Completed Operations Ledger')}</span>
              </h3>

              {/* Dues filter toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDuesFilterOnly(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    !duesFilterOnly
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All Orders ({cleanBookingsList.filter(b => b.status === 'completed').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilterOnly(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    duesFilterOnly
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Unpaid Dues Only ({overdueBookingsCount})</span>
                </button>
              </div>
            </div>

            {cleanBookingsList.filter(b => b.status === 'completed').length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-400">
                {t('provider_hub.no_completed_orders', 'No completed orders in the ledger yet. When incoming rental jobs are marked completed, their settled earnings will appear here.')}
              </div>
            ) : (
              <div className="space-y-3">
                {cleanBookingsList
                  .filter(b => b.status === 'completed')
                  .filter(b => {
                    if (!duesFilterOnly) return true;
                    const bId = String(b.id || b.bookingId);
                    const due = duesMap[bId];
                    return due && due.balanceDue > 0;
                  })
                  .map((b) => {
                    const bId = String(b.id || b.bookingId);
                    const totalCost = getBookingCost(b);
                    const exp = jobExpensesMap[bId];
                    const dues = duesMap[bId] || { total: totalCost, advancePaid: totalCost, balanceDue: 0 };
                    const hasDues = dues.balanceDue > 0;

                    return (
                      <div
                        key={b.id || b.bookingId}
                        className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                            <img
                              src={b.imageUrl || getEquipmentFallbackImage(b.category, b.equipmentTitle || b.title)}
                              alt={b.equipmentTitle || b.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black text-slate-900 dark:text-white">
                                {b.equipmentTitle || b.title || 'Machinery'}
                              </p>
                              {hasDues ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  ₹{dues.balanceDue.toLocaleString('en-IN')} Due
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                                  100% Settled
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {t('provider_hub.farmer_label', 'Farmer:')} <strong>{b.farmerName || 'Farmer'}</strong> • {b.acres || 2} {t('common.acres', 'Acres')} • {b.village || 'Field'} • {b.bookingDate || 'Recent'}
                            </p>
                            {exp ? (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                                ⛽ Diesel: {exp.dieselLiters}L (₹{exp.dieselCost}) • 👨‍✈️ Driver: ₹{exp.driverWage} • 💰 Net Profit: ₹{exp.netProfit.toLocaleString('en-IN')}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400 mt-1 italic">
                                No operational diesel/driver expenses logged yet.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions & Financial Badges */}
                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                          <div className="text-right mr-2">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Gross Fee</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              ₹{totalCost.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* Action 1: Digital Bill Receipt */}
                          <button
                            type="button"
                            onClick={() => setReceiptModalBooking(b)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="View & Share Digital Receipt"
                          >
                            <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Bill</span>
                          </button>

                          {/* Action 2: Log Diesel & Driver Expenses */}
                          <button
                            type="button"
                            onClick={() => handleOpenExpenseModal(b)}
                            className="px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Log Fuel & Driver Expenses"
                          >
                            <Fuel className="w-3.5 h-3.5 text-amber-600" />
                            <span>Expenses</span>
                          </button>

                          {/* Action 3: Advance & Balance Dues */}
                          <button
                            type="button"
                            onClick={() => handleOpenDuesModal(b)}
                            className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Update Advance Paid & Balance Dues"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Dues</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </motion.div>
      )}



      {/* ── DIGITAL RENTAL BILL & RECEIPT MODAL ── */}
      {receiptModalBooking && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Machinery Rental Bill & Receipt
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Official Voucher #{receiptModalBooking.id || receiptModalBooking.bookingId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalBooking(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Voucher Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Printable Voucher Paper Card */}
              <div id="agrishield-rental-invoice" className="p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
                {/* Voucher Branding Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚜</span>
                    <div>
                      <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight block">
                        AGRISHIELD FARM MECHANIZATION
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        Verified Machinery Rental Network
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    {receiptModalBooking.status === 'completed' ? 'PAID INVOICE' : 'BOOKING RECEIPT'}
                  </span>
                </div>

                {/* Farmer & Provider Dual Column */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">FARMER RECIPIENT</span>
                    <p className="font-black text-slate-900 dark:text-white">{receiptModalBooking.farmerName || 'Registered Farmer'}</p>
                    <p className="text-[11px] text-slate-500">{receiptModalBooking.village || 'Field Sector'}, {receiptModalBooking.mandal || 'Andhra Pradesh'}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{receiptModalBooking.farmerPhone || receiptModalBooking.phone || 'Direct Field Dispatch'}</p>
                  </div>
                  <div className="border-l border-slate-100 dark:border-slate-700/60 pl-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">ISSUED BY PROVIDER</span>
                    <p className="font-black text-slate-900 dark:text-white">{user?.name || user?.username || 'Verified Machinery Hub'}</p>
                    <p className="text-[11px] text-slate-500">{userLocation.village || 'Local Hub'}, {userLocation.district || 'Andhra Pradesh'}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{user?.phone || 'Field Dispatch'}</p>
                  </div>
                </div>

                {/* Machinery & Job Details */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">JOB BREAKDOWN</span>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white block">
                          {receiptModalBooking.equipmentTitle || receiptModalBooking.title || 'Agricultural Tractor'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {receiptModalBooking.category || 'Tractor'} • {receiptModalBooking.acres || 2} Acres • {receiptModalBooking.bookingDate || 'Scheduled'}
                        </span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">
                        ₹{getBookingCost(receiptModalBooking).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Advance Paid:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{((duesMap[String(receiptModalBooking.id || receiptModalBooking.bookingId)]?.advancePaid !== undefined) 
                          ? duesMap[String(receiptModalBooking.id || receiptModalBooking.bookingId)].advancePaid 
                          : getBookingCost(receiptModalBooking)).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {duesMap[String(receiptModalBooking.id || receiptModalBooking.bookingId)]?.balanceDue > 0 && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-rose-500 font-bold">Balance Due:</span>
                        <span className="font-black text-rose-600 dark:text-rose-400">
                          ₹{duesMap[String(receiptModalBooking.id || receiptModalBooking.bookingId)].balanceDue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Paid Badge */}
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 block">TOTAL RENTAL SETTLEMENT</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Direct cash on field / UPI payment (0% commission)</span>
                  </div>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                    ₹{getBookingCost(receiptModalBooking).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Digital Stamp Seal */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Digitally Authenticated by AgriShield Hub</span>
                  </div>
                  <span>{new Date().toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070e17] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setReceiptModalBooking(null)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => handleShareReceiptWhatsApp(receiptModalBooking)}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-transform active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Bill on WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIESEL & OPERATOR EXPENSE LOGGER MODAL ── */}
      {expenseModalBooking && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Log Diesel & Driver Expenses
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Calculate real net profit for {expenseModalBooking.equipmentTitle || 'Rental Job'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModalBooking(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJobExpenses} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Gross Rental Fee</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    ₹{getBookingCost(expenseModalBooking).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Field Area</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {expenseModalBooking.acres || 2} Acres ({expenseModalBooking.farmerName || 'Farmer'})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                    Diesel Consumed (Liters)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={dieselLitersInput}
                    onChange={(e) => setDieselLitersInput(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                    Diesel Rate (₹/L)
                  </label>
                  <input
                    type="number"
                    value={dieselPriceInput}
                    onChange={(e) => setDieselPriceInput(e.target.value)}
                    placeholder="94"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                    Driver Wage / Bata (₹)
                  </label>
                  <input
                    type="number"
                    value={driverWageInput}
                    onChange={(e) => setDriverWageInput(e.target.value)}
                    placeholder="700"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                    Misc (Grease/Tolls) (₹)
                  </label>
                  <input
                    type="number"
                    value={miscExpenseInput}
                    onChange={(e) => setMiscExpenseInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Live Net Profit Preview Box */}
              {(() => {
                const liters = parseFloat(dieselLitersInput) || 0;
                const pricePerL = parseFloat(dieselPriceInput) || 94;
                const fuelTotal = Math.round(liters * pricePerL);
                const wage = parseFloat(driverWageInput) || 0;
                const misc = parseFloat(miscExpenseInput) || 0;
                const expTotal = fuelTotal + wage + misc;
                const gross = getBookingCost(expenseModalBooking);
                const net = Math.max(0, gross - expTotal);
                const margin = gross > 0 ? Math.round((net / gross) * 100) : 0;

                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Total Operating Expenses:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">-₹{expTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-emerald-200/80 dark:border-emerald-800/60">
                      <div>
                        <span className="font-black text-emerald-900 dark:text-emerald-200 block text-xs">Estimated Net Pocket Profit:</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{margin}% Operating Margin</span>
                      </div>
                      <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
                        ₹{net.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition-transform active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Expenses & Profit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADVANCE & BALANCE DUES MODAL (Udhari Tracker) ── */}
      {duesModalBooking && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Advance Payment & Dues Tracker
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Record cash collected vs pending balance for #{duesModalBooking.id || duesModalBooking.bookingId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuesModalBooking(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDues} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Agreed Rental</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    ₹{getBookingCost(duesModalBooking).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Farmer</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {duesModalBooking.farmerName || 'Farmer'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                  Advance Cash / UPI Received (₹)
                </label>
                <input
                  type="number"
                  value={advancePaidInput}
                  onChange={(e) => setAdvancePaidInput(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                  required
                />
              </div>

              {/* Balance Due calculation */}
              {(() => {
                const total = getBookingCost(duesModalBooking);
                const advance = Math.min(total, parseFloat(advancePaidInput) || 0);
                const balance = Math.max(0, total - advance);

                return (
                  <div className={`p-3.5 rounded-2xl border ${
                    balance > 0
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80'
                      : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80'
                  } space-y-1`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-600 dark:text-slate-300">Remaining Balance Due (బాకీ):</span>
                      <span className={`font-black ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        ₹{balance.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {balance > 0
                        ? 'Farmer will be tracked under Unpaid Dues ledger until fully collected.'
                        : '100% rental fee collected. No pending dues.'}
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDuesModalBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-transform active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Update Dues Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SLOT BLOCK MODAL (Calendar Lock) ── */}
      {slotBlockModalData && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Lock Schedule Slot
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSlotBlockModalData(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">{slotBlockModalData.machine.title}</p>
              <p className="text-slate-400">Date: {slotBlockModalData.dateStr || slotBlockModalData.dateIso}</p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">Lock Reason:</label>
              <select
                value={slotBlockReason}
                onChange={(e) => setSlotBlockReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              >
                <option value="Personal Farm Use">Personal Farm Use (Sowing/Ploughing)</option>
                <option value="Routine Maintenance">Routine Workshop Maintenance / Greasing</option>
                <option value="Operator Unavailable">Driver / Operator Leave</option>
                <option value="Festive Holiday">Village Festive Break</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSlotBlockModalData(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => toggleBlockSlot(slotBlockModalData.machine.id, slotBlockModalData.dateIso, slotBlockReason)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-md shadow-sky-600/30 cursor-pointer"
              >
                Confirm Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD EQUIPMENT MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {t('provider_hub.list_machinery_modal_title', 'List Machinery for Rent')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('provider_hub.list_machinery_modal_desc', 'Publish your equipment to live farmer rental catalog')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {/* Real-World Upgrade 7: Live Machinery Camera Photo Upload */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-indigo-950 dark:text-indigo-200 uppercase flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('provider_hub.upload_machine_photo', 'Machinery Photo (Camera / Gallery)')}</span>
                    </label>
                    {newImagePreview && (
                      <button
                        type="button"
                        onClick={() => setNewImagePreview('')}
                        className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {newImagePreview ? (
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-indigo-200 dark:border-indigo-800 shrink-0">
                        <img src={newImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40 transition-all cursor-pointer">
                        <Camera className="w-6 h-6 text-indigo-400 mb-1" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {newImageLoading ? 'Compressing Image...' : 'Tap to Take Photo or Upload'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleMachineImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                    {newImagePreview && (
                      <label className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleMachineImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                    Machinery Title / Model Name *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. John Deere 5050D 50HP Tractor"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    >
                      <option value="tractor">🚜 Tractor & Implements</option>
                      <option value="drone">🛸 AI Spraying Drone</option>
                      <option value="irrigation">💧 Irrigation Pump</option>
                      <option value="harvester">🌾 Harvester</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                      Power / Capacity
                    </label>
                    <input
                      type="text"
                      value={newHp}
                      onChange={(e) => setNewHp(e.target.value)}
                      placeholder="e.g. 50 HP or 16 Litre Tank"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                      Rent per Acre (₹) *
                    </label>
                    <input
                      type="number"
                      value={newAcreRate}
                      onChange={(e) => setNewAcreRate(e.target.value)}
                      placeholder="e.g. 1200"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                      Hourly Rate (₹) [Optional]
                    </label>
                    <input
                      type="number"
                      value={newHourlyRate}
                      onChange={(e) => setNewHourlyRate(e.target.value)}
                      placeholder="e.g. 800"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Real-World Upgrade 6: Initial Machinery Running Hours Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t('provider_hub.engine_hours', 'Current Engine Hours Meter')}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold lowercase">250hr service tracker</span>
                  </label>
                  <input
                    type="number"
                    value={newInitialHours}
                    onChange={(e) => setNewInitialHours(e.target.value)}
                    placeholder="e.g. 185"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                  />
                </div>

                {/* Operating Available Timings (Replacing Daily Rate) */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                  <label className="text-[11px] font-black text-indigo-950 dark:text-indigo-200 uppercase flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Available Operating Hours (Daily Timings)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">From Time:</span>
                      <input
                        type="text"
                        value={newAvailableFrom}
                        onChange={(e) => setNewAvailableFrom(e.target.value)}
                        placeholder="e.g. 06:00 AM"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">To Time:</span>
                      <input
                        type="text"
                        value={newAvailableTo}
                        onChange={(e) => setNewAvailableTo(e.target.value)}
                        placeholder="e.g. 06:00 PM"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['06:00 AM - 12:00 PM (Morning)', '02:00 PM - 07:00 PM (Evening)', '06:00 AM - 06:00 PM (Full Day)'].map(timing => (
                      <button
                        key={timing}
                        type="button"
                        onClick={() => {
                          const [from, to] = timing.split('(')[0].trim().split(' - ');
                          setNewAvailableFrom(from);
                          setNewAvailableTo(to);
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition-colors cursor-pointer"
                      >
                        {timing}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multi-Select Implements & Accessories */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                      Available Implements / Accessories (Multiple Select)
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedImplements.length} Selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    {IMPLEMENT_OPTIONS.map((imp) => {
                      const isSelected = selectedImplements.includes(imp);
                      return (
                        <button
                          key={imp}
                          type="button"
                          onClick={() => toggleImplement(imp)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-300'
                            }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>{imp}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customImplementInput}
                      onChange={(e) => setCustomImplementInput(e.target.value)}
                      placeholder="+ Add custom implement (e.g. Ridge Maker)"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomImplement(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomImplement}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="shrink-0 p-3.5 sm:p-4 bg-slate-50/95 dark:bg-[#070e17]/95 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sm:justify-end gap-3 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('provider_hub.cancel_modal_btn', 'Cancel')}
                </button>
                <Button
                  type="submit"
                  className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t('provider_hub.save_and_publish_btn', 'Save & Publish to Catalog')}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CANCEL CONFIRMED BOOKING MODAL (C-2) ── */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0b131f] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {t('provider_hub.cancel_confirmed_modal_title', 'Cancel Confirmed Booking?')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    #{cancelModalBooking.id || cancelModalBooking.bookingId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.equipment_name', 'Equipment:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {cancelModalBooking.equipmentTitle || cancelModalBooking.title || 'Machinery'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.farmer_label', 'Farmer:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {cancelModalBooking.farmerName || 'Farmer'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('provider_hub.cancellation_reason_label', 'Cancellation Reason:')}
              </label>
              <select
                value={cancelReasonCategory}
                onChange={(e) => setCancelReasonCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="equipment_breakdown">{t('provider_hub.reason_breakdown', 'Equipment Breakdown / Maintenance')}</option>
                <option value="operator_unavailable">{t('provider_hub.reason_operator', 'Operator Unavailable')}</option>
                <option value="weather_issues">{t('provider_hub.reason_weather', 'Adverse Weather Conditions')}</option>
                <option value="other">{t('provider_hub.reason_other', 'Other Reason')}</option>
              </select>
              <input
                type="text"
                placeholder={t('provider_hub.reason_details_placeholder', 'Additional details (optional)...')}
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
              {t('provider_hub.cancellation_warning', 'Cancelling this booking will release the locked time slot and notify the farmer.')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t('provider_hub.keep_booking_btn', 'Keep Booking')}
              </button>
              <button
                type="button"
                disabled={updatingBookingId === (cancelModalBooking.id || cancelModalBooking.bookingId)}
                onClick={async () => {
                  const reason = cancelReasonText.trim() ? `${cancelReasonCategory}: ${cancelReasonText.trim()}` : cancelReasonCategory;
                  const bId = cancelModalBooking.id || cancelModalBooking.bookingId;
                  setCancelModalBooking(null);
                  await handleUpdateBookingStatus(bId, 'cancelled', reason);
                }}
                className={`px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shadow-rose-600/30 transition-all active:scale-95 cursor-pointer ${updatingBookingId === (cancelModalBooking.id || cancelModalBooking.bookingId) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <span>{t('provider_hub.confirm_cancellation_btn', 'Confirm Cancellation')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE BOOKING CONFIRMATION MODAL ── */}
      {deleteModalBooking && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0b131f] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {t('provider_hub.delete_booking_modal_title', 'Delete Booking Order?')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    #{deleteModalBooking.id || deleteModalBooking.bookingId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalBooking(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.equipment_name', 'Equipment:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteModalBooking.equipmentTitle || deleteModalBooking.title || 'Machinery'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.farmer_label', 'Farmer:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteModalBooking.farmerName || 'Farmer'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.equipment_status', 'Status:')}</span>
                <span className="font-bold uppercase text-rose-500">
                  {deleteModalBooking.status}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('provider_hub.delete_booking_warning', 'This order record will be permanently removed from your provider dashboard. This action cannot be undone.')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalBooking(null)}
                disabled={isDeletingBooking}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t('provider_hub.cancel_modal_btn', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteBooking}
                disabled={isDeletingBooking}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingBooking ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('provider_hub.deleting_btn', 'Deleting...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('provider_hub.delete_permanently_btn', 'Delete Permanently')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MACHINERY CONFIRMATION MODAL ── */}
      {deleteModalMachine && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0b131f] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {t('provider_hub.delete_machinery_modal_title', 'Delete Machinery Listing?')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    ID: {deleteModalMachine.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalMachine(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.equipment_name', 'Equipment:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteModalMachine.title}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.equipment_category', 'Category:')}</span>
                <span className="font-bold capitalize text-slate-900 dark:text-white">
                  {deleteModalMachine.category || 'Tractor'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{t('provider_hub.rate_per_acre', 'Rental Rate:')}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  ₹{deleteModalMachine.ratePerAcre || deleteModalMachine.hourlyRate || 800} / {deleteModalMachine.ratePerAcre ? t('provider_hub.per_acre_unit', 'Acre') : 'hr'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('provider_hub.delete_machinery_warning', 'This machinery will be permanently removed from your fleet and marketplace catalog. Farmers will no longer see or book this machine.')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalMachine(null)}
                disabled={isDeletingMachine}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t('provider_hub.cancel_modal_btn', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteMachine}
                disabled={isDeletingMachine}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingMachine ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('provider_hub.deleting_btn', 'Deleting...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('provider_hub.delete_permanently_btn', 'Delete Permanently')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          IN-APP DIRECT MESSAGING & 2-WAY VOICE CHAT MODAL FOR PROVIDER
      ═══════════════════════════════════════════════════════════════════ */}
      {activeChatBooking && (
        <div className="fixed inset-0 z-[9999] bg-[#f1f3f9] dark:bg-[#0d1117] flex flex-col w-full h-full overflow-hidden animate-fade-in">
          <GoogleMessageReader
            message={activeChatBooking}
            lang={currentLang}
            onBack={() => setActiveChatBooking(null)}
            onDelete={() => setActiveChatBooking(null)}
          />
        </div>
      )}
    </div>
  );
}
