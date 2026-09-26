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
  Headphones
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/toast';
import { Button } from '../../components/ui/index';
import GoogleMessageReader from '../../components/common/GoogleMessageReader';
import {
  CANONICAL_STARTER_FLEET,
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

export default function ProviderDashboardPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Active Provider View Tab & URL synchronization
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(requestedTab || 'fleet'); // 'fleet' | 'orders' | 'earnings' | 'copilot'

  useEffect(() => {
    if (requestedTab && ['fleet', 'orders', 'earnings', 'copilot'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ── Dedicated Equipment Provider AI Copilot State ──
  const [copilotMessages, setCopilotMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_provider_ai_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 1,
        role: 'assistant',
        content: isTe 
          ? "నమస్కారం! నేను మీ అగ్రిషీల్డ్ మెషినరీ & ఫ్లీట్ AI కోపైలట్ ని. ట్రాక్టర్ ఇంజిన్ నిర్వహణ, డ్రోన్ లిపో బ్యాటరీలు, ఎకరాల వారీ డీజిల్ వినియోగం, న్యాయమైన అద్దె ధరలు మరియు ప్రభుత్వ SMAM సబ్సిడీల గురించి నన్ను అడగండి."
          : "Hello! I am your AgriShield Machinery & Fleet AI Copilot. Ask me about tractor maintenance schedules, spray drone battery cycles, per-acre diesel consumption formulas, fair rental pricing, and government machinery subsidies."
      }
    ];
  });

  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('agrishield_provider_ai_chat', JSON.stringify(copilotMessages));
  }, [copilotMessages]);

  const COPILOT_PRESETS = [
    { label: isTe ? "⛽ 45HP ట్రాక్టర్ ఎకరాకి డీజిల్ లెక్క" : "⛽ 45HP Tractor diesel/acre", query: "What is the typical diesel consumption per acre for a 45HP tractor with Rotavator vs Cultivator?" },
    { label: isTe ? "🔋 డ్రోన్ లిపో బ్యాటరీ భద్రత" : "🔋 Drone LiPo battery care", query: "What are the safe charging, discharging, and storage voltages for 16L agricultural spray drone LiPo batteries?" },
    { label: isTe ? "💰 ఎకరా అద్దె ధరల ఫార్ములా" : "💰 Fair acre rental pricing", query: "How should I calculate my per-acre rental rate considering current diesel prices, operator daily wage, and implement wear-and-tear?" },
    { label: isTe ? "⚙️ ట్రాక్టర్ ఇంజిన్ ఆయిల్ సర్వీస్" : "⚙️ Tractor service intervals", query: "When should I change engine oil, fuel filters, and hydraulic oil in a commercial farm tractor?" },
    { label: isTe ? "🏛️ SMAM మెషినరీ సబ్సిడీ" : "🏛️ SMAM machinery subsidy", query: "What are the eligibility rules and documents required for Sub-Mission on Agricultural Mechanization (SMAM) Custom Hiring Center 40% subsidy?" }
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
      const errMsg = isTe 
        ? "AI సర్వర్ నుండి సమాధానం పొందడంలో సమస్య ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్నించండి."
        : "Could not connect to Machinery AI service. Please check connection and try again.";
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
        content: isTe 
          ? "చాట్ క్లియర్ చేయబడింది. మీ యంత్రాలు, డీజిల్ లెక్కలు లేదా ఫ్లీట్ షెడ్యూలింగ్ గురించి ఏదైనా అడగండి."
          : "Chat history cleared. Ask me any question about your fleet machinery, fuel consumption, or maintenance."
      }
    ];
    setCopilotMessages(defaultMsg);
    localStorage.setItem('agrishield_provider_ai_chat', JSON.stringify(defaultMsg));
    toast.success('Chat Cleared', 'Copilot conversation reset successfully.');
  };

  // Availability Status
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('agrishield_provider_online_status');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleOnlineStatus = () => {
    const nextVal = !isOnline;
    setIsOnline(nextVal);
    try {
      localStorage.setItem('agrishield_provider_online_status', String(nextVal));
      window.dispatchEvent(new CustomEvent('agrishield_provider_status_changed', { detail: { isOnline: nextVal } }));
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) {}

    toast.success(
      nextVal ? (isTe ? 'ప్రొవైడర్ హబ్: ఆన్‌లైన్' : 'Provider Hub: Online Today') : (isTe ? 'ప్రొవైడర్ హబ్: ఆఫ్‌లైన్' : 'Provider Hub: Offline Today'),
      nextVal 
        ? (isTe ? 'రైతులు ఇప్పుడు మీరు ఆన్‌లైన్‌లో ఉన్నట్లు చూస్తారు మరియు బుకింగ్‌లు పంపగలరు.' : 'Farmers can now see you Online and send rental booking requests.') 
        : (isTe ? 'కొత్త ఆర్డర్లు తాత్కాలికంగా నిలిపివేయబడ్డాయి. రైతులు మిమ్మల్ని ఆఫ్‌లైన్‌లో ఉన్నట్లు చూస్తారు.' : 'Incoming new rental orders paused. Farmers will see you as Offline Today.')
    );
  };

  // ── Fleet Inventory State (Saved to localStorage with Zero Duplicates & Blacklist Protection) ──
  const [fleetList, setFleetList] = useState(() => {
    try {
      const isSynced = localStorage.getItem('agrishield_equipment_catalog_synced') === 'true';
      const saved = localStorage.getItem('agrishield_provider_fleet_inventory');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 || isSynced) {
            return deduplicateEquipment(parsed, getDeletedEquipmentIds());
          }
        }
      }
      if (!isSynced) {
        return deduplicateEquipment(CANONICAL_STARTER_FLEET, getDeletedEquipmentIds());
      }
      return [];
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    const cleanFleet = deduplicateEquipment(fleetList, getDeletedEquipmentIds());
    localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(cleanFleet));
    try {
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanFleet));
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) {}
  }, [fleetList]);

  // Sync remote fleet catalog items from backend for cross-device support (With Zero Duplicates & Blacklist Exclusion)
  useEffect(() => {
    const fetchRemoteFleet = async () => {
      try {
        const phone = user?.phone;
        const endpoint = phone ? `/api/v1/equipment/catalog?provider_phone=${encodeURIComponent(phone)}` : '/api/v1/equipment/catalog';
        let res = null;
        try {
          res = await API.get(endpoint);
        } catch (_) {}

        let catalogItems = null;
        if (res?.data && (Array.isArray(res.data.catalog) || Array.isArray(res.data.equipment))) {
          catalogItems = Array.isArray(res.data.catalog) ? res.data.catalog : res.data.equipment;
        }

        if (catalogItems === null) {
          try {
            res = await axios.get(`https://agrishield-ai-worker-1.onrender.com${endpoint}`, { timeout: 10000 });
            if (res?.data && (Array.isArray(res.data.catalog) || Array.isArray(res.data.equipment))) {
              catalogItems = Array.isArray(res.data.catalog) ? res.data.catalog : res.data.equipment;
            }
          } catch (_) {}
        }

        if (catalogItems === null) {
          try {
            res = await axios.get(`https://agrishield-ai-worker-2.onrender.com${endpoint}`, { timeout: 10000 });
            if (res?.data && (Array.isArray(res.data.catalog) || Array.isArray(res.data.equipment))) {
              catalogItems = Array.isArray(res.data.catalog) ? res.data.catalog : res.data.equipment;
            }
          } catch (_) {}
        }

        if (Array.isArray(catalogItems)) {
          const deletedEquipIds = getDeletedEquipmentIds();
          const cleanCatalog = deduplicateEquipment(catalogItems, deletedEquipIds);
          setFleetList(cleanCatalog);
          try {
            localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(cleanCatalog));
            localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanCatalog));
            localStorage.setItem('agrishield_equipment_catalog_synced', 'true');
          } catch (_) {}
        }
      } catch (_) {}
    };
    fetchRemoteFleet();
    const fleetInterval = setInterval(fetchRemoteFleet, 12000);
    const handleFleetVisibility = () => {
      if (document.visibilityState === 'visible') fetchRemoteFleet();
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
  }, [user?.phone]);

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
    } catch (e) {}
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
    } catch (e) {}
    return [];
  });

  // Delete Booking Confirmation State
  const [deleteModalBooking, setDeleteModalBooking] = useState(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);

  const confirmDeleteBooking = async () => {
    if (!deleteModalBooking) return;
    const targetId = deleteModalBooking.id || deleteModalBooking.bookingId;
    if (!targetId) return;

    setIsDeletingBooking(true);

    // 1. Immediately blacklist the booking and sync tombstone so other mobile devices receive it
    saveDeletedBookingId(targetId);
    recordCrossDeviceDeletion('booking', targetId, 'Provider deleted booking');

    // 2. Remove immediately from local state and localStorage
    setBookingsList(prev => {
      const updated = prev.filter(b => b && b.id !== targetId && b.bookingId !== targetId);
      try {
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 3. Dispatch DELETE to backend API & Render workers
    try {
      let remoteDeleted = false;
      try {
        await API.delete(`/api/v1/equipment/bookings/${targetId}`);
        remoteDeleted = true;
      } catch (_) {}

      if (!remoteDeleted) {
        try {
          await API.delete(`/api/equipment/bookings/${targetId}`);
          remoteDeleted = true;
        } catch (_) {}
      }

      if (!remoteDeleted) {
        try {
          await axios.delete(`https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings/${targetId}`, { timeout: 10000 });
          remoteDeleted = true;
        } catch (_) {}
      }

      if (!remoteDeleted) {
        try {
          await axios.delete(`https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings/${targetId}`, { timeout: 10000 });
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Backend DELETE booking warning:', err);
    } finally {
      setIsDeletingBooking(false);
      setDeleteModalBooking(null);
      window.dispatchEvent(new Event('agrishield_bookings_updated'));
      toast.success(
        isTe ? 'ఆర్డర్ తొలగించబడింది' : 'Order Deleted',
        isTe
          ? `బుకింగ్ #${targetId} రికార్డుల నుండి శాశ్వతంగా తొలగించబడింది.`
          : `Booking order #${targetId} permanently removed from your dashboard.`
      );
    }
  };

  // In-App Direct Chat Active Conversation for Provider
  const [activeChatBooking, setActiveChatBooking] = useState(null);

  const openChatForProviderBooking = (booking) => {
    const rawKey = String(booking.id || booking.bookingId || 'BK-1').trim();
    const cleanId = rawKey.replace(/^notif-(?:stat-)?/, '').replace(/^notif-order-/, '').replace(/^BK-/, '');
    const bKey = `BK-${cleanId}`;
    const farmerPhone = booking.farmerPhone || booking.contactPhone || booking.phone || '9440182736';
    const farmerName = booking.farmerName || 'Trivendra reddy';
    const equipmentTitle = booking.equipmentTitle || booking.title || 'Farm Machinery Rental';
    const village = booking.village || booking.location?.village || booking.location?.mandal || 'Field Location';
    const totalCost = booking.totalCost || '800';

    const chatMessageObj = {
      id: bKey,
      notification_id: bKey,
      category: 'booking',
      type: 'booking',
      bookingId: bKey,
      booking_id: bKey,
      equipmentTitle: equipmentTitle,
      title: equipmentTitle,
      providerName: user?.name || (isTe ? 'ధృవీకరించబడిన ప్రొవైడర్' : 'Verified Provider'),
      providerPhone: user?.phone || '9848012345',
      provider_phone: user?.phone || '9848012345',
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
      message: isTe
        ? `బుకింగ్ #${bKey} కోసం రైతుతో ప్రత్యక్ష సందేశం.`
        : `Direct in-app messaging for booking #${bKey}.`
    };
    setActiveChatBooking(chatMessageObj);
  };

  const fetchProviderBookings = useCallback(async () => {
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
      } catch (e) {}

      // Fetch from backend API to pick up bookings made on PC / other phones (up to 2500 for high-volume stress testing)
      try {
        let res = await API.get('/api/v1/equipment/bookings?limit=2500');
        if (!res.data || typeof res.data !== 'object' || !Array.isArray(res.data.bookings)) {
          try { res = await API.get('/api/equipment/bookings?limit=2500'); } catch (_) {}
        }
        if (!res.data || typeof res.data !== 'object' || !Array.isArray(res.data.bookings)) {
          try { res = await axios.get('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings?limit=2500', { timeout: 15000 }); } catch (_) {}
        }
        if (!res.data || typeof res.data !== 'object' || !Array.isArray(res.data.bookings)) {
          try { res = await axios.get('https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings?limit=2500', { timeout: 15000 }); } catch (_) {}
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
          try {
            localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(merged));
          } catch (e) {}
          return;
        }
      } catch (err) {}

      if (local.length > 0) {
        const clean = deduplicateBookings(local, deletedIds);
        setBookingsList(clean);
      }
    } catch (e) {}
  }, [getDeletedBookingIds]);

  // Poll backend & listen to window/storage/visibility updates
  useEffect(() => {
    fetchProviderBookings();
    const interval = setInterval(fetchProviderBookings, 6000); // 6s fast multi-device sync
    const handleRevalidateBookings = () => {
      if (document.visibilityState === 'visible') fetchProviderBookings();
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

    const newMachine = {
      id: `FL-${Date.now().toString().slice(-4)}`,
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
      availableTime: `${newAvailableFrom} - ${newAvailableTo}`,
      dailyAvailableTime: `${newAvailableFrom} - ${newAvailableTo}`,
      implements: selectedImplements.length > 0 ? selectedImplements : ['Standard Attachments'],
      implementsIncluded: selectedImplements.length > 0 ? selectedImplements : ['Standard Attachments'],
      village: user?.farm_location?.village || 'Pasupugallu',
      locationVillage: user?.farm_location?.village || 'Pasupugallu',
      district: user?.farm_location?.district || 'Prakasam',
      locationDistrict: user?.farm_location?.district || 'Prakasam',
      mandal: user?.farm_location?.mandal || 'Mundlamuru',
      state: user?.farm_location?.state || 'Andhra Pradesh',
      phone: user?.phone || '9876543210',
      contactPhone: user?.phone || '9876543210',
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

    // Also mirror to global equipment listings so farmers can discover it immediately
    try {
      const globalCustom = JSON.parse(localStorage.getItem('agrishield_custom_equipment_listings') || '[]');
      const cleanCustom = deduplicateEquipment([newMachine, ...globalCustom]);
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanCustom));
    } catch (e) {}

    // Multi-device backend sync so machinery appears on all devices
    API.post('/api/v1/equipment/catalog', newMachine).catch(() => {
      axios.post('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/catalog', newMachine).catch(() => {
        axios.post('https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/catalog', newMachine).catch(() => {});
      });
    });

    setIsAddModalOpen(false);
    setNewTitle('');
    toast.success('Equipment Listed!', `${newMachine.title} has been added to your live rental catalog.`);
  };

  const handleToggleMachineAvailability = (id) => {
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
      localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(updated));
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(updated));
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) {}

    // Multi-device backend sync
    API.patch(`/api/v1/equipment/fleet/${id}/availability`, { available: nextAvailable }).catch(() => {});

    toast.info(
      isTe ? 'లభ్యత నవీకరించబడింది' : 'Availability Updated',
      nextAvailable
        ? (isTe ? 'యంత్రం అందుబాటులో ఉన్నట్లుగా గుర్తించబడింది.' : 'Machinery marked as Available.')
        : (isTe ? 'యంత్రం బుక్ చేయబడినట్లుగా మార్చబడింది (రైతుల స్క్రీన్‌లో బుక్ చేయబడింది అని కనిపిస్తుంది).' : 'Machinery marked as Booked (Farmers will see it as Booked).')
    );
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

    // 1. Permanently blacklist machinery ID & title in localStorage and backend tombstones
    saveDeletedEquipmentId(targetId, targetTitle);
    recordCrossDeviceDeletion('equipment', targetId, 'Provider deleted machinery');

    // 2. Remove immediately from local state and localStorage
    const updated = fleetList.filter(m => m.id !== targetId);
    setFleetList(updated);
    try {
      localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(updated));
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(updated));
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) {}

    // 3. Dispatch DELETE to backend API & Render workers
    try {
      let remoteDeleted = false;
      try {
        await API.delete(`/api/v1/equipment/catalog/${targetId}`);
        remoteDeleted = true;
      } catch (_) {}

      if (!remoteDeleted) {
        try {
          await axios.delete(`https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/catalog/${targetId}`, { timeout: 10000 });
          remoteDeleted = true;
        } catch (_) {}
      }

      if (!remoteDeleted) {
        try {
          await axios.delete(`https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/catalog/${targetId}`, { timeout: 10000 });
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Backend DELETE machinery warning:', err);
    } finally {
      setIsDeletingMachine(false);
      setDeleteModalMachine(null);
      toast.success(
        isTe ? 'యంత్రం తొలగించబడింది' : 'Machinery Removed',
        isTe
          ? `${targetTitle} మీ కేటలాగ్ నుండి శాశ్వతంగా తొలగించబడింది.`
          : `${targetTitle} was permanently deleted from your fleet.`
      );
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

  const handleUpdateBookingStatus = (bookingId, nextStatus) => {
    let targetBooking = null;
    const updated = bookingsList.map(b => {
      const bKey = b && (b.id || b.bookingId);
      if (bKey === bookingId) {
        targetBooking = { ...b, status: nextStatus, updatedAt: new Date().toISOString() };
        return targetBooking;
      }
      return b;
    });
    setBookingsList(updated);
    try {
      localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
      window.dispatchEvent(new Event('agrishield_bookings_updated'));
    } catch (e) {}

    toast.info(
      isTe ? 'బుకింగ్ స్థితి నవీకరించబడింది' : 'Status Updated',
      nextStatus === 'rejected'
        ? (isTe ? 'ఆర్డర్ తిరస్కరించబడింది. రైతు స్క్రీన్‌లో ఇది వెంటనే కనిపిస్తుంది.' : 'Order declined. Farmer will immediately see this status on their screen.')
        : (isTe ? 'ఆర్డర్ ఆమోదించబడింది.' : 'Order confirmed.')
    );

    // Dispatch status update to backend API for multi-device cross-browser persistence
    const patchStatusToServer = async () => {
      const payload = { status: nextStatus, updatedAt: new Date().toISOString() };
      try {
        const r = await API.patch(`/api/v1/equipment/bookings/${bookingId}/status`, payload);
        if (r.data && typeof r.data === 'object') return;
      } catch (_) {}
      try {
        const r = await API.patch(`/api/equipment/bookings/${bookingId}/status`, payload);
        if (r.data && typeof r.data === 'object') return;
      } catch (_) {}
      try {
        await axios.patch(`https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings/${bookingId}/status`, payload, { timeout: 15000 });
        return;
      } catch (_) {}
      try {
        await axios.patch(`https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings/${bookingId}/status`, payload, { timeout: 15000 });
      } catch (err) {
        console.warn('Backend status patch notice:', err);
      }
    };
    patchStatusToServer();

    // Auto-sync machine availability when booking is confirmed or completed
    if (targetBooking) {
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
            localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(synced));
            localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(synced));
            window.dispatchEvent(new Event('agrishield_equipment_updated'));
          } catch (e) {}
          return synced;
        });
      } else if (nextStatus === 'completed') {
        // Machine is freed up
        setFleetList(prev => {
          const synced = prev.map(m => {
            if ((targetEquipId && m.id === targetEquipId) || (targetEquipTitle && m.title === targetEquipTitle)) {
              return { ...m, available: true };
            }
            return m;
          });
          try {
            localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(synced));
            localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(synced));
            window.dispatchEvent(new Event('agrishield_equipment_updated'));
          } catch (e) {}
          return synced;
        });
      }
    }

    // Dispatch real-time farmer notification for Accept/Reject/Complete
    if (targetBooking) {
      const equipTitle = targetBooking.equipmentTitle || targetBooking.title || 'Machinery';
      const bookingDate = targetBooking.bookingDate || targetBooking.date || 'Scheduled Slot';

      let notifTitle = '';
      let notifMsg = '';

      if (nextStatus === 'confirmed') {
        notifTitle = isTe ? `✅ బుకింగ్ ధృవీకరించబడింది (#${bookingId})` : `✅ Machinery Booking Accepted (#${bookingId})`;
        notifMsg = isTe
          ? `ప్రొవైడర్ మీ ${equipTitle} బుకింగ్‌ను ఆమోదించారు! షెడ్యూల్ తేదీ: ${bookingDate}. పరికరం సమయానికి చేరుకుంటుంది.`
          : `Great news! The equipment provider has ACCEPTED your booking for ${equipTitle}. Scheduled for ${bookingDate}.`;
      } else if (nextStatus === 'rejected') {
        notifTitle = isTe ? `❌ బుకింగ్ తిరస్కరించబడింది (#${bookingId})` : `❌ Machinery Booking Declined (#${bookingId})`;
        notifMsg = isTe
          ? `క్షమించండి, ప్రొవైడర్ వేరొక షెడ్యూల్‌లో ఉండటం వల్ల మీ బుకింగ్ (#${bookingId}) అంగీకరించలేకపోయారు. దయచేసి సమీపంలోని ఇతర యంత్రాలను చూడండి.`
          : `The equipment provider is unable to accept booking #${bookingId} due to prior commitments. Please explore other available machinery.`;
      } else if (nextStatus === 'completed') {
        notifTitle = isTe ? `🎉 పని పూర్తయింది (#${bookingId})` : `🎉 Machinery Service Completed (#${bookingId})`;
        notifMsg = isTe
          ? `మీ ${equipTitle} అద్దె సేవ విజయవంతంగా పూర్తయింది. ఖాతా రికార్డు నవీకరించబడింది.`
          : `Rental service for ${equipTitle} (#${bookingId}) has been marked COMPLETED.`;
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
          const userNotifs = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
          localStorage.setItem('agrishield_user_notifications', JSON.stringify([notifObj, ...userNotifs.filter(n => n.id !== notifObj.id)]));
        } catch (e) {}

        // Write system confirmation milestone notice into the canonical shared booking thread
        const cleanBId = String(bookingId).replace(/^notif-(?:stat-)?/, '').replace(/^BK-/, '');
        const canonicalKey = `agrishield_chat_thread_BK-${cleanBId}`;
        try {
          const thread = JSON.parse(localStorage.getItem(canonicalKey) || '[]');
          const noticeMsg = {
            id: `msg_sys_${Date.now()}`,
            sender: 'system',
            type: 'system_notice',
            text: isTe
              ? `✅ పరికర ప్రొవైడర్ మీ బుకింగ్‌ను ఆమోదించారు (${bookingDate} కోసం షెడ్యూల్ చేయబడింది)`
              : `✅ Booking Accepted by Provider (Scheduled for ${bookingDate})`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          localStorage.setItem(canonicalKey, JSON.stringify([...thread, noticeMsg]));
          window.dispatchEvent(new CustomEvent('agrishield_chat_message_sent', {
            detail: { storageKey: canonicalKey, message: noticeMsg }
          }));
          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('agrishield_equipment_chat');
              bc.postMessage({ canonicalBookingId: `BK-${cleanBId}`, message: noticeMsg });
              bc.close();
            }
          } catch (_) {}
          API.post(`/api/v1/equipment/bookings/BK-${cleanBId}/messages`, noticeMsg).catch(() => {});
        } catch (_) {}

        window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: notifObj }));
      }
    }

    if (nextStatus === 'confirmed') {
      toast.success(
        isTe ? 'బుకింగ్ ఆమోదించబడింది!' : 'Booking Accepted!',
        isTe ? 'రైతుకు ఆర్డర్ ధృవీకరణ నోటిఫికేషన్ పంపబడింది.' : 'Farmer has been notified that machinery is confirmed.'
      );
    } else if (nextStatus === 'rejected') {
      toast.info(
        isTe ? 'బుకింగ్ తిరస్కరించబడింది' : 'Booking Declined',
        isTe ? 'ఆర్డర్ తిరస్కరించబడింది & రైతుకు సమాచారం అందించబడింది.' : 'Order declined and farmer was updated.'
      );
    } else if (nextStatus === 'completed') {
      toast.success(
        isTe ? 'పని పూర్తయింది!' : 'Job Completed!',
        isTe ? 'ఆర్డర్ పూర్తయినట్లు నమోదు చేయబడింది.' : 'Service marked completed and earnings logged.'
      );
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
    .reduce((sum, b) => sum + (Number(b.totalCost) || 2500), 0);

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
              <span>{isTe ? 'ఫ్లీట్ హబ్‌కు తిరిగి' : 'Back to Fleet Hub'}</span>
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isTe ? 'అగ్రిషీల్డ్ మెషినరీ AI కోపైలట్' : 'AgriShield Machinery & Fleet Copilot'}
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {isTe ? 'నిపుణుడు' : 'Strict Machinery Domain'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isTe ? 'ట్రాక్టర్, స్ప్రే డ్రోన్, డీజిల్ & అద్దె లెక్కల ప్రత్యేక AI సహాయకుడు' : 'Specialized expert for tractors, spray drones, diesel/acre formulas & rental economics'}
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
            <span className="hidden sm:inline">{isTe ? 'చాట్ క్లియర్ చేయండి' : 'Clear Chat'}</span>
          </button>
        </div>

        {/* The Chat Container */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          {/* Quick Prompt Presets */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {isTe ? 'త్వరిత ప్రశ్నలు (Quick Questions)' : 'Quick Machinery Inquiries'}
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
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                  }`}>
                    {isUser ? (user?.name ? user.name[0].toUpperCase() : 'U') : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    isUser
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
                  <span>{isTe ? 'మెషినరీ నిపుణుడు సమాధానం సిద్ధం చేస్తున్నారు...' : 'Consulting machinery telemetry & calculating...'}</span>
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
              placeholder={isTe ? "ట్రాక్టర్ నిర్వహణ, డ్రోన్ బ్యాటరీ లేదా డీజిల్ వినియోగం గురించి అడగండి..." : "Ask about tractor maintenance, drone battery care, diesel formulas, or rental rates..."}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!copilotInput.trim() || copilotLoading}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTe ? 'పంపండి' : 'Ask Copilot'}</span>
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
              {isTe ? 'రైతు ఖాతా గుర్తించబడింది' : 'Farmer Account Detected'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isTe ? 'ఇది మెషినరీ ప్రొవైడర్ల కోసం మాత్రమే' : 'Machinery Provider Hub'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              {isTe
                ? `మీరు ప్రస్తుతం రైతు (${user?.name || user?.username || 'Farmer'}) ఖాతాతో లాగిన్ అయి ఉన్నారు. ఈ ప్రొవైడర్ డ్యాష్‌బోర్డ్ కేవలం రిజిస్టర్ అయిన యంత్రాల సరఫరాదారుల కోసం మాత్రమే. మీ పొలానికి ట్రాక్టర్లు, డ్రోన్లు, హార్వెస్టర్లను బుక్ చేసుకోవడానికి లేదా బుకింగ్ స్థితిని చూడటానికి వ్యవసాయ యంత్రాల అద్దె విభాగానికి వెళ్ళండి.`
                : `You are currently logged in as a Farmer (${user?.name || user?.username || 'Farmer'}). The Provider Dashboard is reserved exclusively for registered Machinery & Drone Providers. To book tractors, harvesters, spray drones or track your booking status, please visit Farm Machinery Rentals.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/equipment-booking')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>{isTe ? 'వ్యవసాయ యంత్రాల అద్దెకు వెళ్ళండి →' : 'Go to Farm Machinery Rentals →'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/more')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              <span>{isTe ? 'వెనుకకు వెళ్లండి' : 'Back to Tools'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const providerDisplayName = user?.provider_profile?.hub_name || user?.provider_profile?.business_name || user?.name || user?.username || 'Agri Machinery Provider';
  const hubVillage = user?.provider_profile?.hub_name || user?.farm_location?.village || 'Ramesh Farm Services';
  const hubDistrict = user?.farm_location?.district || 'Prakasam';

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
                  {isTe ? 'ధృవీకరించబడిన ప్రదాత' : 'Verified Provider'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Base Hub: <strong>{hubVillage}</strong>, {hubDistrict} (AP)</span>
              </p>
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* ── HIGH VISIBILITY ONLINE / OFFLINE TOGGLE BUTTON ── */}
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`group relative px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-3 transition-all cursor-pointer shadow-sm select-none ${
                isOnline
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
                    {isTe ? 'నేటి లభ్యత' : "Today's Status"}
                  </p>
                  <span className="text-xs font-black leading-none">
                    {isOnline
                      ? (isTe ? 'ఆన్‌లైన్ (ఆర్డర్లు స్వీకరిస్తున్నారు)' : 'Online Today (Taking Bookings)')
                      : (isTe ? 'ఆఫ్‌లైన్ (ఆర్డర్లు నిలిపివేయబడ్డాయి)' : 'Offline Today (Orders Paused)')}
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
              <span>{isTe ? 'కొత్త యంత్రం జోడించండి' : 'Add Machinery'}</span>
            </Button>

            <button
              type="button"
              onClick={() => navigate('/support')}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Provider Support & Help Desk"
            >
              <Headphones className="w-4 h-4 text-sky-500" />
              <span className="hidden sm:inline">{isTe ? 'హెల్ప్‌డెస్క్ సపోర్ట్' : 'Help Desk'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── 3 BEAUTIFUL WORKSTATION CARDS (Boxes with Dedicated Page Switching) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: Machinery Fleet Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('fleet')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('fleet')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${
            activeTab === 'fleet'
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
                <span>{isTe ? 'ప్రస్తుత పేజీ' : 'Active Page'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <span>{isTe ? 'పేజీ తెరవండి' : 'Open Page'}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {isTe ? 'యంత్రాల కేటలాగ్' : 'Machinery Fleet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {isTe
              ? 'ట్రాక్టర్లు, స్ప్రే డ్రోన్లు, హార్వెస్టర్లు & పరికరాల ప్రత్యక్ష లభ్యత'
              : 'List and manage tractors, spray drones, harvesters & live equipment availability'}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
              {cleanFleetList.length} {cleanFleetList.length === 1 ? (isTe ? 'యంత్రం' : 'Machine') : (isTe ? 'యంత్రాలు' : 'Machines')}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
              {availableFleetCount} {isTe ? 'లభ్యం' : 'Ready for Hire'}
            </span>
          </div>
        </div>

        {/* CARD 2: Booking Orders Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('orders')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('orders')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${
            activeTab === 'orders'
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
                <span>{isTe ? 'ప్రస్తుత పేజీ' : 'Active Page'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                <span>{isTe ? 'పేజీ తెరవండి' : 'Open Page'}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {isTe ? 'బుకింగ్ ఆర్డర్లు' : 'Booking Orders'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {isTe
              ? 'రైతుల నుండి అద్దె బుకింగ్‌లు, సమయాలు, నిర్ధారణ మరియు ఫీల్డ్ పనులు'
              : 'Direct farmer hire requests, field schedules, dispatching & customer coordination'}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            {pendingOrdersCount > 0 ? (
              <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-400 text-amber-950 border border-amber-300 animate-pulse">
                ⚡ {pendingOrdersCount} {isTe ? 'కొత్త ఆర్డర్లు' : 'Action Required'}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                0 {isTe ? 'పెండింగ్' : 'Pending'}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {completedOrdersCount} {isTe ? 'పూర్తయినవి' : 'Completed'}
            </span>
          </div>
        </div>

        {/* CARD 3: Earnings & Ledger Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => switchTab('earnings')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab('earnings')}
          className={`relative p-5 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer text-left group overflow-hidden ${
            activeTab === 'earnings'
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
                <span>{isTe ? 'ప్రస్తుత పేజీ' : 'Active Page'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span>{isTe ? 'పేజీ తెరవండి' : 'Open Page'}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">
            {isTe ? 'ఆదాయం & లెడ్జర్' : 'Earnings & Ledger'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {isTe
              ? 'రైతుల నుండి సేకరించిన ప్రత్యక్ష అద్దె ఆదాయం, రసీదులు & బ్యాంక్ లెడ్జర్'
              : 'Direct farmer rental collections, zero-commission payout records & statements'}
          </p>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
              ₹{totalEarnings.toLocaleString('en-IN')} {isTe ? 'ఆదాయం' : 'Revenue'}
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
                <span>{isTe ? 'ప్రొవైడర్ హబ్' : 'Provider Hub'}</span>
                <span>/</span>
                <span>{isTe ? 'యంత్రాల కేటలాగ్' : 'Machinery Fleet'}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🚜</span>
                <span>{isTe ? 'మీ యంత్రాల కేటలాగ్' : 'Active Machinery Inventory'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isTe ? 'రైతులకు అందుబాటులో ఉన్న మీ ట్రాక్టర్లు, డ్రోన్లు మరియు పరికరాల నిర్వహణ' : 'Manage your listed tractors, spray drones, and harvest equipment for nearby farmers'}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {cleanFleetList.length} {cleanFleetList.length === 1 ? (isTe ? 'యంత్రం' : 'Machine') : (isTe ? 'యంత్రాలు' : 'Machines')}
              </span>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isTe ? 'కొత్త యంత్రం' : 'Add Machine'}</span>
              </Button>
            </div>
          </div>

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
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                          machine.available
                            ? 'bg-emerald-500/90 text-white border-emerald-400 hover:bg-emerald-600'
                            : 'bg-slate-900/85 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                        title={isTe ? 'లభ్యత మార్చడానికి క్లిక్ చేయండి' : 'Click to toggle availability'}
                      >
                        <span className={`w-2 h-2 rounded-full ${machine.available ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                        <span>{machine.available ? (isTe ? 'అందుబాటులో ఉంది' : 'Available') : (isTe ? 'బుక్ చేయబడింది' : 'Booked')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Machine Title */}
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {machine.title}
                  </h3>

                  {/* Operator Specs & Fuel Status */}
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>{machine.operatorIncluded ? (isTe ? 'ఆపరేటర్ ఉన్నారు' : 'Driver Included') : (isTe ? 'సెల్ఫ్-డ్రైవ్' : 'Self-Drive')}</span>
                    <span>•</span>
                    <span>{machine.fuelIncluded ? (isTe ? 'డీజిల్ చేర్చబడింది' : 'Fuel Included') : (isTe ? 'డీజిల్ అదనం' : 'Fuel Extra')}</span>
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
                      / {machine.ratePerAcre ? (isTe ? 'ఎకరాకు' : 'Acre') : (isTe ? 'గంటకు' : 'hr')}
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
                      {machine.available ? (isTe ? 'బిజీగా గుర్తించండి' : 'Mark Busy') : (isTe ? 'ఖాళీగా గుర్తించండి' : 'Mark Free')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteModalMachine(machine)}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title={isTe ? 'యంత్రాన్ని తొలగించండి' : 'Delete Machinery Listing'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
                <span>{isTe ? 'ప్రొవైడర్ హబ్' : 'Provider Hub'}</span>
                <span>/</span>
                <span>{isTe ? 'బుకింగ్ ఆర్డర్లు' : 'Booking Orders'}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📅</span>
                <span>{isTe ? 'రైతుల నుండి వచ్చిన బుకింగ్ అభ్యర్థనలు' : 'Farmer Rental Booking Orders'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isTe ? 'రైతుల నుండి వచ్చే అద్దె ఆర్డర్లను ఆమోదించండి, కాల్ చేయండి లేదా పూర్తి చేయండి' : 'Accept, decline, coordinate with farmers, and mark field jobs completed'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingOrdersCount > 0 && (
                <span className="px-3 py-1.5 rounded-2xl text-xs font-black bg-amber-400 text-amber-950 border border-amber-300 animate-pulse">
                  ⚡ {pendingOrdersCount} {isTe ? 'కొత్త అభ్యర్థనలు' : 'Action Required'}
                </span>
              )}
              <span className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {cleanBookingsList.length} {cleanBookingsList.length === 1 ? (isTe ? 'ఆర్డర్' : 'Order') : (isTe ? 'ఆర్డర్లు' : 'Orders')}
              </span>
            </div>
          </div>

          {cleanBookingsList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17]">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-3">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                {isTe ? 'ప్రస్తుతానికి పెండింగ్ బుకింగ్‌లు లేవు' : 'No Rental Bookings Yet'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {isTe
                  ? 'మీ పరిసర గ్రామాల రైతులు యంత్రాలను బ్రౌజ్ చేసి అద్దెకు తీసుకున్నప్పుడు ఆర్డర్లు ఇక్కడ వెంటనే కనిపిస్తాయి.'
                  : 'When farmers in your mandal browse and book machinery, their live rental orders will appear here immediately.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cleanBookingsList.map((booking) => {
                const farmerPhone = booking.farmerPhone || booking.contactPhone || booking.phone || '9440182736';
                const cleanPhone = String(farmerPhone).replace(/[^0-9]/g, '');
                const farmerName = booking.farmerName || 'Trivendra reddy';
                const equipmentTitle = booking.equipmentTitle || booking.title || 'Farm Machinery Rental';
                const village = booking.village || booking.location?.village || booking.location?.mandal || 'Field Location';
                const date = booking.bookingDate || booking.date || 'Today';
                const slot = booking.timeSlot || booking.slot || 'Full Day';
                const acres = booking.acres || booking.acreage || '2';
                const crop = booking.targetCrop || booking.crop || 'Field Crop';
                const totalCost = booking.totalCost || '800';

                const isPending = !booking.status || booking.status === 'pending';
                const isConfirmed = booking.status === 'confirmed';
                const isCompleted = booking.status === 'completed';
                const isDeclined = booking.status === 'rejected' || booking.status === 'declined' || booking.status === 'cancelled';

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white dark:bg-[#070e17] rounded-3xl p-4 sm:p-5 border shadow-sm transition-all duration-300 flex flex-col justify-between group ${
                      isPending
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
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase backdrop-blur-md shadow-sm border flex items-center gap-1 ${
                            isCompleted
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
                              {isPending ? (isTe ? 'ధృవీకరణ వేచి ఉంది' : 'Pending Action') :
                               isConfirmed ? (isTe ? 'ధృవీకరించబడింది' : 'Confirmed & Scheduled') :
                               isCompleted ? (isTe ? 'పూర్తయింది' : 'Completed') :
                               (isTe ? 'తిరస్కరించబడింది' : 'Declined')}
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
                            <span>{isTe ? 'రైతు పేరు:' : 'Farmer:'}</span>
                          </span>
                          <strong className="text-slate-900 dark:text-white font-black">{farmerName}</strong>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold">{isTe ? 'విస్తీర్ణం & పని:' : 'Area & Work:'}</span>
                          <span className="text-slate-800 dark:text-slate-200 font-bold">
                            {acres} {isTe ? 'ఎకరాలు' : 'Acres'} {booking.operation ? `• ${booking.operation}` : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold">{isTe ? 'పంట దశ:' : 'Crop / Stage:'}</span>
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
                          <p className="text-[10px] uppercase font-bold text-slate-400">{isTe ? 'అద్దె మొత్తం' : 'Total Rental Fare'}</p>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            ₹{Number(totalCost).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {isTe ? 'డైరెక్ట్ చెల్లింపు (0% ఫీజు)' : 'Direct Pay (0% Fee)'}
                        </span>
                      </div>
                    </div>

                    {/* Provider Action Buttons (Clean & High Contrast) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      {isPending && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'confirmed')}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>{isTe ? 'ఆర్డర్ ఆమోదించండి' : 'Accept Booking'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'rejected')}
                            className="w-full py-2.5 px-3 rounded-xl border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>{isTe ? 'తిరస్కరించండి' : 'Decline'}</span>
                          </button>
                        </div>
                      )}

                      {isConfirmed && (
                        <button
                          type="button"
                          onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'completed')}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isTe ? 'పని పూర్తయింది & సెటిల్ చేయండి' : 'Mark Completed & Settle'}</span>
                        </button>
                      )}

                      {isCompleted && (
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>{isTe ? 'పూర్తయింది & రికార్డ్ చేయబడింది' : 'Settled & Logged'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setDeleteModalBooking(booking)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title={isTe ? 'ఆర్డర్‌ను తొలగించండి' : 'Delete Order'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isDeclined && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold">
                              {booking.status === 'cancelled' ? (isTe ? 'రద్దు చేయబడింది' : 'Cancelled') : (isTe ? 'తిరస్కరించబడింది' : 'Declined')}
                            </span>
                            {booking.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(booking.id || booking.bookingId, 'confirmed')}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {isTe ? 'మళ్లీ ఆమోదించండి' : 'Re-open'}
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setDeleteModalBooking(booking)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title={isTe ? 'ఆర్డర్‌ను తొలగించండి' : 'Delete Order'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Direct Communication Bar: 3 Options (In-App Message, WhatsApp, Call) */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => openChatForProviderBooking(booking)}
                          className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                          title={isTe ? 'రైతుతో యాప్‌లోనే చాట్ చేయండి' : 'In-App Direct Chat with Farmer'}
                        >
                          <MessageSquare className="w-3.5 h-3.5 fill-white shrink-0" />
                          <span className="truncate">{isTe ? 'సందేశం' : 'Message'}</span>
                        </button>

                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                            isTe
                              ? `నమస్తే ${farmerName}! మీ ${equipmentTitle} బుకింగ్ #${booking.id} గురించి అగ్రిషీల్డ్ ప్రొవైడర్ నుండి మాట్లాడుతున్నాను.`
                              : `Hello ${farmerName}! Contacting you regarding your machinery booking #${booking.id} for ${equipmentTitle} on AgriShield.`
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
                          title={isTe ? 'రైతుకు కాల్' : 'Call Farmer'}
                        >
                          <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{isTe ? 'కాల్' : 'Call'}</span>
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
                  <span>{isTe ? 'ప్రొవైడర్ హబ్' : 'Provider Hub'}</span>
                  <span>/</span>
                  <span>{isTe ? 'ఆదాయం & లెడ్జర్' : 'Earnings & Ledger'}</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💰</span>
                  <span>{isTe ? 'ఆదాయం వివరాలు & చెల్లింపు రసీదులు' : 'Direct Payout & Settled Ledger'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isTe ? 'రైతుల నుండి సేకరించిన ప్రత్యక్ష చెల్లింపులు (0% ప్లాట్‌ఫారమ్ కమీషన్)' : 'Direct payments received from farmers for completed machinery rentals'}
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-2xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>0% Commission (Direct)</span>
              </span>
            </div>

            {/* 3 Studio Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">{isTe ? 'సేకరించిన ఆదాయం' : 'Settled Earnings'}</p>
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">₹{totalEarnings.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">{isTe ? 'రైతుల నుండి నేరుగా చేరింది' : '100% retained by provider'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{isTe ? 'ప్లాట్‌ఫారమ్ ఫీజు' : 'Platform Fee'}</p>
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-1">₹0</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">{isTe ? 'పూర్తిగా ఉచితం / జీరో కమీషన్' : '100% Free / Zero Commission'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">{isTe ? 'పూర్తయిన పనులు' : 'Completed Jobs'}</p>
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-2xl font-black text-indigo-800 dark:text-indigo-200 mt-1">{completedOrdersCount}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">{isTe ? 'పొలం ఆపరేషన్లు పూర్తి చేయబడ్డాయి' : 'Field operations completed'}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                {isTe
                  ? 'అన్ని వ్యవసాయ యంత్రాల అద్దె చెల్లింపులు రైతు మరియు మీ మధ్య నేరుగా (పొలంలో నగదు, ఫోన్‌పే లేదా గూగుల్ పే) జరుగుతాయి. అగ్రిషీల్డ్ ఎటువంటి కమీషన్ వసూలు చేయదు.'
                  : 'All equipment rental payments occur directly between you and the farmer (Cash on Field, PhonePe, or Google Pay). AgriShield AI takes 0% commission.'}
              </span>
            </div>
          </div>

          {/* Completed Jobs Feed / History */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>{isTe ? 'ఇటీవల పూర్తయిన ఆర్డర్ల రికార్డు' : 'Completed Operations Ledger'}</span>
            </h3>

            {cleanBookingsList.filter(b => b.status === 'completed').length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-400">
                {isTe
                  ? 'ఇంకా పూర్తయిన ఆర్డర్లు లేవు. రైతుల నుండి వచ్చే ఆర్డర్లను పూర్తి చేసినప్పుడు అవి ఇక్కడ రికార్డ్ చేయబడతాయి.'
                  : 'No completed orders in the ledger yet. When incoming rental jobs are marked completed, their settled earnings will appear here.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {cleanBookingsList
                  .filter(b => b.status === 'completed')
                  .map((b) => (
                    <div
                      key={b.id || b.bookingId}
                      className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                          <img
                            src={b.imageUrl || getEquipmentFallbackImage(b.category, b.equipmentTitle || b.title)}
                            alt={b.equipmentTitle || b.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {b.equipmentTitle || b.title || 'Machinery'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Farmer: <strong>{b.farmerName || 'Farmer'}</strong> • {b.acres || 2} Acres • {b.bookingDate || 'Recent'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-800">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Settled Direct
                        </span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          ₹{Number(b.totalCost || 800).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>
      )}



      {/* ── ADD EQUIPMENT MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isTe ? 'కొత్త యంత్రాన్ని నమోదు చేయండి' : 'List Machinery for Rent'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isTe ? 'మీ పరికరాలను రైతుల కోసం కేటలాగ్‌లో ప్రచురించండి' : 'Publish your equipment to live farmer rental catalog'}
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
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
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
                  {isTe ? 'రద్దు చేయి' : 'Cancel'}
                </button>
                <Button
                  type="submit"
                  className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isTe ? 'సేవ్ చేసి ప్రచురించండి' : 'Save & Publish to Catalog'}</span>
                </Button>
              </div>
            </form>
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
                    {isTe ? 'ఆర్డర్‌ను తొలగించాలా?' : 'Delete Booking Order?'}
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
                <span className="text-slate-400">{isTe ? 'యంత్రం:' : 'Equipment:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteModalBooking.equipmentTitle || deleteModalBooking.title || 'Machinery'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{isTe ? 'రైతు:' : 'Farmer:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteModalBooking.farmerName || 'Farmer'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{isTe ? 'స్థితి:' : 'Status:'}</span>
                <span className="font-bold uppercase text-rose-500">
                  {deleteModalBooking.status}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isTe
                ? 'ఈ ఆర్డర్ మీ ప్రొవైడర్ డ్యాష్‌బోర్డ్ నుండి శాశ్వతంగా తొలగించబడుతుంది. ఇది తిరిగి పొందలేరు.'
                : 'This order record will be permanently removed from your provider dashboard. This action cannot be undone.'}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalBooking(null)}
                disabled={isDeletingBooking}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isTe ? 'రద్దు చేయండి' : 'Cancel'}
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
                    <span>{isTe ? 'తొలగిస్తోంది...' : 'Deleting...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isTe ? 'శాశ్వతంగా తొలగించండి' : 'Delete Permanently'}</span>
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
                    {isTe ? 'యంత్రాన్ని తొలగించాలా?' : 'Delete Machinery Listing?'}
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
                <span className="text-slate-400">{isTe ? 'పేరు:' : 'Equipment:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteModalMachine.title}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{isTe ? 'విభాగం:' : 'Category:'}</span>
                <span className="font-bold capitalize text-slate-900 dark:text-white">
                  {deleteModalMachine.category || 'Tractor'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">{isTe ? 'ధర:' : 'Rental Rate:'}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  ₹{deleteModalMachine.ratePerAcre || deleteModalMachine.hourlyRate || 800} / {deleteModalMachine.ratePerAcre ? (isTe ? 'ఎకరాకు' : 'Acre') : 'hr'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isTe
                ? 'ఈ యంత్రం మీ ఫ్లీట్ మరియు మార్కెట్‌ప్లేస్ నుండి శాశ్వతంగా తొలగించబడుతుంది. రైతులు దీనిని ఇకపై బుక్ చేయలేరు.'
                : 'This machinery will be permanently removed from your fleet and marketplace catalog. Farmers will no longer see or book this machine.'}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalMachine(null)}
                disabled={isDeletingMachine}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isTe ? 'రద్దు చేయండి' : 'Cancel'}
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
                    <span>{isTe ? 'తొలగిస్తోంది...' : 'Deleting...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isTe ? 'శాశ్వతంగా తొలగించండి' : 'Delete Permanently'}</span>
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
            lang={isTe ? 'te' : 'en'}
            onBack={() => setActiveChatBooking(null)}
            onDelete={() => setActiveChatBooking(null)}
          />
        </div>
      )}
    </div>
  );
}
