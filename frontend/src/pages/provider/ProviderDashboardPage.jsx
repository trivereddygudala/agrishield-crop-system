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

  // ── Fleet Inventory State (Saved to localStorage) ──
  const [fleetList, setFleetList] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_provider_fleet_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    // Default starting machinery for provider if brand new
    return [
      {
        id: 'FL-001',
        title: 'Mahindra 575 DI 45HP Tractor',
        category: 'tractor',
        modelYear: '2023',
        horsepower: '45 HP',
        hourlyRate: 850,
        dailyRate: 6500,
        available: true,
        implementsIncluded: ['Rotavator', 'Cultivator', 'Disc Plough'],
        locationVillage: user?.farm_location?.village || 'Pasupugallu',
        locationDistrict: user?.farm_location?.district || 'Prakasam',
        contactPhone: user?.phone || '9876543210'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(fleetList));
    try {
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(fleetList));
      window.dispatchEvent(new Event('agrishield_equipment_updated'));
    } catch (e) {}
  }, [fleetList]);

  // Sync remote fleet catalog items from backend for cross-device support
  useEffect(() => {
    const fetchRemoteFleet = async () => {
      try {
        const phone = user?.phone;
        const endpoint = phone ? `/api/v1/equipment/catalog?provider_phone=${encodeURIComponent(phone)}` : '/api/v1/equipment/catalog';
        let res;
        try {
          res = await API.get(endpoint);
        } catch (_) {}
        if (!res?.data?.catalog && !res?.data?.equipment) {
          try {
            res = await axios.get(`https://agrishield-ai-worker-1.onrender.com${endpoint}`, { timeout: 10000 });
          } catch (_) {}
        }
        if (!res?.data?.catalog && !res?.data?.equipment) {
          try {
            res = await axios.get(`https://agrishield-ai-worker-2.onrender.com${endpoint}`, { timeout: 10000 });
          } catch (_) {}
        }
        const catalogItems = res?.data?.catalog || res?.data?.equipment;
        if (catalogItems && Array.isArray(catalogItems) && catalogItems.length > 0) {
          setFleetList(prev => {
            const map = new Map();
            prev.forEach(item => map.set(item.id, item));
            catalogItems.forEach(item => {
              if (!map.has(item.id)) map.set(item.id, item);
            });
            return Array.from(map.values());
          });
        }
      } catch (_) {}
    };
    fetchRemoteFleet();
  }, [user?.phone]);

  // ── Incoming Farmer Bookings State (Multi-Device & Cross-Browser Real-Time Sync) ──
  const [bookingsList, setBookingsList] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_equipment_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const fetchProviderBookings = useCallback(async () => {
    try {
      let local = [];
      try {
        const saved = localStorage.getItem('agrishield_equipment_bookings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) local = parsed;
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
          const remote = res.data.bookings;
          const mergedMap = new Map();
          remote.forEach(b => { if (b && b.id) mergedMap.set(b.id, b); });
          local.forEach(b => {
            if (b && b.id) {
              if (!mergedMap.has(b.id)) {
                mergedMap.set(b.id, b);
              } else {
                const existing = mergedMap.get(b.id);
                mergedMap.set(b.id, { ...existing, ...b });
              }
            }
          });
          const merged = Array.from(mergedMap.values());
          setBookingsList(merged);
          localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(merged));
          return;
        }
      } catch (err) {}

      if (local.length > 0) {
        setBookingsList(local);
      }
    } catch (e) {}
  }, []);

  // Poll backend & listen to window/storage updates
  useEffect(() => {
    fetchProviderBookings();
    const interval = setInterval(fetchProviderBookings, 6000); // 6s fast multi-device sync
    window.addEventListener('agrishield_bookings_updated', fetchProviderBookings);
    window.addEventListener('storage', fetchProviderBookings);
    return () => {
      clearInterval(interval);
      window.removeEventListener('agrishield_bookings_updated', fetchProviderBookings);
      window.removeEventListener('storage', fetchProviderBookings);
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

    setFleetList([newMachine, ...fleetList]);

    // Also mirror to global equipment listings so farmers can discover it immediately
    try {
      const globalCustom = JSON.parse(localStorage.getItem('agrishield_custom_equipment_listings') || '[]');
      globalCustom.unshift(newMachine);
      localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(globalCustom));
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

  const handleDeleteMachine = (id) => {
    if (window.confirm('Are you sure you want to remove this equipment from your fleet?')) {
      const updated = fleetList.filter(m => m.id !== id);
      setFleetList(updated);
      try {
        localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(updated));
        localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(updated));
        window.dispatchEvent(new Event('agrishield_equipment_updated'));
      } catch (e) {}
      // Sync delete with backend
      API.delete(`/api/v1/equipment/catalog/${id}`).catch(() => {});
      toast.success('Removed', 'Machinery listing was deleted.');
    }
  };

  const handleUpdateBookingStatus = (bookingId, nextStatus) => {
    let targetBooking = null;
    const updated = bookingsList.map(b => {
      if (b.id === bookingId) {
        targetBooking = { ...b, status: nextStatus };
        return targetBooking;
      }
      return b;
    });
    setBookingsList(updated);
    try {
      localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
      window.dispatchEvent(new Event('agrishield_bookings_updated'));
    } catch (e) {}

    // Dispatch status update to backend API for multi-device cross-browser persistence
    const patchStatusToServer = async () => {
      try {
        const r = await API.patch(`/api/v1/equipment/bookings/${bookingId}/status`, { status: nextStatus });
        if (r.data && typeof r.data === 'object') return;
      } catch (_) {}
      try {
        const r = await API.patch(`/api/equipment/bookings/${bookingId}/status`, { status: nextStatus });
        if (r.data && typeof r.data === 'object') return;
      } catch (_) {}
      try {
        await axios.patch(`https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings/${bookingId}/status`, { status: nextStatus }, { timeout: 15000 });
        return;
      } catch (_) {}
      try {
        await axios.patch(`https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings/${bookingId}/status`, { status: nextStatus }, { timeout: 15000 });
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

  // Metrics
  const totalFleetCount = fleetList.length;
  const availableFleetCount = fleetList.filter(f => f.available).length;
  const pendingOrdersCount = bookingsList.filter(b => b.status === 'confirmed' || b.status === 'pending' || !b.status).length;
  const actionablePendingCount = bookingsList.filter(b => b.status === 'pending' || !b.status).length;
  const completedOrdersCount = bookingsList.filter(b => b.status === 'completed').length;
  const totalEarnings = bookingsList
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
                  {user?.name || user?.username || 'Agri Machinery Provider'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {isTe ? 'ధృవీకరించబడిన ప్రదాత' : 'Verified Provider'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Base Hub: <strong>{user?.farm_location?.village || 'Pasupugallu'}</strong>, {user?.farm_location?.district || 'Prakasam'} (AP)</span>
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

        {/* ── KEY METRIC OVERVIEW CARDS (Structured Boxes) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isTe ? 'మొత్తం యంత్రాలు' : 'Fleet Assets'}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{totalFleetCount}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{availableFleetCount} Available</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isTe ? 'రైతు ఆర్డర్లు' : 'Incoming Bookings'}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{pendingOrdersCount}</span>
              <span className="text-[10px] text-slate-400 font-bold">Active</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isTe ? 'పూర్తయిన పనులు' : 'Completed Jobs'}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{completedOrdersCount}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100% Rate</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isTe ? 'మొత్తం ఆదాయం' : 'Total Revenue'}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{totalEarnings.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 font-bold">Direct Ledger</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CLEAN 3-TAB FLEET HUB NAVIGATION (Machinery Fleet, Booking Orders, Earnings & Ledger) ── */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800">
        <button
          type="button"
          onClick={() => switchTab('fleet')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'fleet'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span className="truncate">{isTe ? 'యంత్రాలు' : 'Machinery Fleet'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'fleet' ? 'bg-white/20 text-white' : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'}`}>
            {fleetList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('orders')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">{isTe ? 'బుకింగ్ ఆర్డర్లు' : 'Booking Orders'}</span>
          {pendingOrdersCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-amber-950 font-black">
              {pendingOrdersCount}
            </span>
          ) : (
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
              0
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => switchTab('earnings')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'earnings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4 shrink-0" />
          <span className="truncate">{isTe ? 'ఆదాయం & లెడ్జర్' : 'Earnings & Ledger'}</span>
        </button>
      </div>

      {/* ── TAB 1: MACHINERY FLEET INVENTORY ── */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {isTe ? 'మీ యంత్రాల కేటలాగ్' : 'Active Machinery Inventory'}
            </h2>
            <span className="text-xs text-slate-400">
              {fleetList.length} {fleetList.length === 1 ? 'machine' : 'machines'} configured
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleetList.map((machine) => (
              <div
                key={machine.id}
                className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-5 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-lg font-black">
                        {machine.category === 'drone' ? '🛸' : machine.category === 'irrigation' ? '💧' : machine.category === 'harvester' ? '🌾' : '🚜'}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{machine.title}</h3>
                        <p className="text-[11px] text-slate-400 font-semibold">{machine.horsepower || 'Heavy Equipment'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleMachineAvailability(machine.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                        machine.available
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {machine.available ? 'Available' : 'Booked'}
                    </button>
                  </div>

                  {/* Pricing & Timing Box */}
                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{isTe ? 'ఎకరాకు అద్దె' : 'Rent per Acre'}</p>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">₹{machine.ratePerAcre || machine.hourlyRate || 1200} / acre</p>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{isTe ? 'అందుబాటు సమయం' : 'Available Time'}</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">{machine.availableTime || machine.dailyAvailableTime || '6:00 AM - 6:00 PM'}</p>
                    </div>
                  </div>

                  {/* Implements tag list */}
                  {machine.implementsIncluded && machine.implementsIncluded.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {machine.implementsIncluded.map((imp, i) => (
                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {imp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {machine.locationVillage}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteMachine(machine.id)}
                    className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: INCOMING FARMER BOOKING ORDERS ── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {isTe ? 'రైతుల నుండి వచ్చిన బుకింగ్ అభ్యర్థనలు' : 'Farmer Rental Booking Orders'}
            </h2>
            <span className="text-xs text-slate-400">
              {bookingsList.length} total orders recorded
            </span>
          </div>

          {bookingsList.length === 0 ? (
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
            <div className="space-y-3">
              {bookingsList.map((booking) => {
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

                return (
                  <div
                    key={booking.id}
                    className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                            #{booking.id}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            booking.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : booking.status === 'rejected' || booking.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : booking.status === 'confirmed'
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse'
                          }`}>
                            {(!booking.status || booking.status === 'pending') 
                              ? (isTe ? 'ధృవీకరణ వేచి ఉంది' : 'Pending Action')
                              : booking.status === 'confirmed'
                              ? (isTe ? 'షెడ్యూల్ చేయబడింది' : 'Confirmed')
                              : booking.status}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                          {equipmentTitle}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium flex flex-wrap items-center gap-2">
                          <span>{isTe ? 'రైతు:' : 'Farmer:'} <strong className="text-slate-900 dark:text-white">{farmerName}</strong></span>
                          <span>&bull;</span>
                          <span>{isTe ? 'విస్తీర్ణం:' : 'Area:'} {acres} Acres</span>
                          <span>&bull;</span>
                          <span>{isTe ? 'పొలం స్థితి:' : 'Field Stage:'} <strong className="text-emerald-700 dark:text-emerald-300">{booking.fieldStatus || crop}</strong></span>
                        </p>

                        {booking.operation && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isTe ? 'పని రకం:' : 'Operation:'}</span>
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-black text-[11px]">
                              ⚙️ {booking.operation}
                            </span>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{date} &bull; Slot: {slot}</span>
                          <span>&bull;</span>
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{village}</span>
                        </p>
                      </div>

                      {/* Fare & Status Actions (Accept / Reject / Complete) */}
                      <div className="flex flex-col md:items-end justify-between gap-2.5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{isTe ? 'అద్దె మొత్తం' : 'Rental Amount'}</p>
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                            ₹{Number(totalCost).toLocaleString('en-IN')}
                          </p>
                        </div>

                        {/* Interactive Action Controls */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(!booking.status || booking.status === 'pending') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/25 transition-all active:scale-95"
                                title={isTe ? 'బుకింగ్‌ను ఆమోదించండి' : 'Accept Farmer Booking'}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{isTe ? 'ఆమోదించండి' : 'Accept Booking'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(booking.id, 'rejected')}
                                className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title={isTe ? 'బుకింగ్‌ను తిరస్కరించండి' : 'Decline Booking'}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{isTe ? 'తిరస్కరించండి' : 'Decline'}</span>
                              </button>
                            </>
                          )}

                          {booking.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/25 transition-all active:scale-95"
                              title={isTe ? 'పని పూర్తయినట్లు నమోదు చేయండి' : 'Mark Service as Completed'}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{isTe ? 'పూర్తయినట్లు గుర్తించండి' : 'Mark Completed'}</span>
                            </button>
                          )}

                          {booking.status === 'completed' && (
                            <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{isTe ? 'పూర్తయింది & సెటిల్ అయింది' : 'Completed & Settled'}</span>
                            </span>
                          )}

                          {booking.status === 'rejected' && (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-black flex items-center gap-1">
                                <X className="w-3.5 h-3.5 text-rose-500" />
                                <span>{isTe ? 'తిరస్కరించబడింది' : 'Declined'}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {isTe ? 'మళ్లీ ఆమోదించండి' : 'Re-open & Accept'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Direct Farmer Contact & WhatsApp Bar ── */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 -mx-5 -mb-5 p-4 rounded-b-3xl">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">{isTe ? 'రైతు ఫోన్ నంబర్' : 'Farmer Contact Number'}</p>
                          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white select-all">
                            +{cleanPhone.startsWith('91') ? cleanPhone : `91 ${cleanPhone}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shadow-indigo-600/25 transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{isTe ? 'కాల్ చేయండి' : 'Call Farmer'}</span>
                        </a>

                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${farmerName}, this is regarding your machinery booking #${booking.id} for ${equipmentTitle} on AgriShield.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: EARNINGS & PAYMENT LEDGER ── */}
      {activeTab === 'earnings' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6">
            <h2 className="text-base font-black text-slate-900 dark:text-white mb-4">
              {isTe ? 'ఆదాయం వివరాలు & చెల్లింపు రసీదులు' : 'Direct Payout Ledger'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Settled Earnings</p>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">₹{totalEarnings.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Paid directly by farmers</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase">Platform Fee</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-1">₹0</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">100% Free / Zero Commission</p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase">Jobs Logged</p>
                <p className="text-2xl font-black text-indigo-800 dark:text-indigo-200 mt-1">{completedOrdersCount}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">Field operations served</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                All equipment rental payments occur directly between you and the farmer (Cash on Field, PhonePe, or Google Pay). AgriShield AI takes 0% commission.
              </span>
            </div>
          </div>
        </div>
      )}



      {/* ── ADD EQUIPMENT MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#070e17] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {isTe ? 'కొత్త యంత్రాన్ని నమోదు చేయండి' : 'List Machinery for Rent'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                  Machinery Title / Model Name
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
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-5 py-2.5 text-xs font-black shadow-md shadow-indigo-600/30"
                >
                  Save & Publish to Catalog
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
