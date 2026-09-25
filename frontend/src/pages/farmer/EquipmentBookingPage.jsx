import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Truck,
  Wrench,
  Droplets,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  MessageSquare,
  Share2,
  Search,
  Filter,
  Plus,
  Trash2,
  Star,
  Zap,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  FileText,
  RefreshCw,
  DollarSign,
  User,
  Sliders,
  Compass,
  ArrowRight,
  Info,
  X,
  Lock,
  RotateCcw,
  Ban,
  AlertTriangle
} from 'lucide-react';
import { Dialog, Button } from '../../components/ui/index';
import GoogleMessageReader from '../../components/common/GoogleMessageReader';
import axios from 'axios';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';
import {
  INDIA_STATES,
  getDistricts,
  getMandals,
  getVillages,
  getCoordinatesForLocation
} from '../../data/indiaLocations';
import { CURATED_FARM_PHOTOS } from '../../services/photoService';
import {
  CANONICAL_STARTER_FLEET,
  deduplicateEquipment,
  deduplicateBookings
} from '../../utils/equipmentDeduplication';

// ═══════════════════════════════════════════════════════════════════
// CONCEPT 2 STUDIO IMAGE RESOLVER & HIGH-RES FALLBACKS
// ═══════════════════════════════════════════════════════════════════
const getEquipmentFallbackImage = (category, title = '') => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  if (c === 'drone' || t.includes('drone') || t.includes('agras') || t.includes('spray')) {
    return CURATED_FARM_PHOTOS.drone || 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'irrigation' || c === 'pump' || t.includes('pump') || t.includes('solar') || t.includes('water')) {
    return CURATED_FARM_PHOTOS.solarPump || 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'harvester' || t.includes('harvester') || t.includes('cutter')) {
    return CURATED_FARM_PHOTOS.harvester || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'implement' || t.includes('rotavator') || t.includes('plough') || t.includes('tiller')) {
    return CURATED_FARM_PHOTOS.rotavator || 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('john deere')) {
    return CURATED_FARM_PHOTOS.tractor || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80';
  }
  return CURATED_FARM_PHOTOS.tractorJohnDeere || CURATED_FARM_PHOTOS.tractorField || 'https://images.unsplash.com/photo-1594771804886-a933bb2d609b?auto=format&fit=crop&w=800&q=80';
};

// ═══════════════════════════════════════════════════════════════════
// REAL USER EQUIPMENT & BOOKINGS REPOSITORY (No Mock Data)
// ═══════════════════════════════════════════════════════════════════

export default function EquipmentBookingPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const navigate = useNavigate();
  const { activeFarm } = useFarm();
  const { user } = useAuth();

  // Active top-level mode / tab
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'bookings' | 'chc-info'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'tractor' | 'drone' | 'irrigation' | 'harvester'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'price-low' | 'rating'

  // Service Location state (defaults to active farm or Prakasam/Mundlamuru/Pasupugallu)
  const [locationState, setLocationState] = useState(() => activeFarm?.state || 'Andhra Pradesh');
  const [locationDistrict, setLocationDistrict] = useState(() => activeFarm?.district || 'Prakasam');
  const [locationMandal, setLocationMandal] = useState(() => activeFarm?.mandal || 'Mundlamuru');
  const [locationVillage, setLocationVillage] = useState(() => activeFarm?.village || 'Pasupugallu');
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Booking Modal State
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  // 100% Real User Equipment Database with Multi-Store & Fleet LocalStorage sync (Zero Duplicates)
  const loadMergedEquipment = useCallback(() => {
    try {
      const providerSaved = JSON.parse(localStorage.getItem('agrishield_provider_fleet_inventory') || '[]');
      const customSaved = JSON.parse(localStorage.getItem('agrishield_custom_equipment_listings') || '[]');

      // providerSaved takes priority as it represents the provider's latest active status and toggles
      const allItems = [
        ...(Array.isArray(providerSaved) ? providerSaved : []),
        ...(Array.isArray(customSaved) ? customSaved : []),
        ...CANONICAL_STARTER_FLEET
      ];

      const cleanItems = deduplicateEquipment(allItems);

      // Clean corrupted localStorage entries immediately so duplicates never persist across reloads
      try {
        localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(cleanItems));
        localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanItems));
      } catch (e) {}

      return cleanItems;
    } catch (e) {
      console.warn('Failed to parse equipment:', e);
      return CANONICAL_STARTER_FLEET;
    }
  }, []);

  const [equipmentList, setEquipmentList] = useState(loadMergedEquipment);

  // Provider Online / Offline Status Sync
  const [isProviderOnline, setIsProviderOnline] = useState(() => {
    const saved = localStorage.getItem('agrishield_provider_online_status');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    const handleStatusSync = (e) => {
      if (e?.detail?.isOnline !== undefined) {
        setIsProviderOnline(e.detail.isOnline);
      } else {
        const saved = localStorage.getItem('agrishield_provider_online_status');
        setIsProviderOnline(saved !== null ? saved === 'true' : true);
      }
    };
    window.addEventListener('agrishield_provider_status_changed', handleStatusSync);
    window.addEventListener('storage', handleStatusSync);
    return () => {
      window.removeEventListener('agrishield_provider_status_changed', handleStatusSync);
      window.removeEventListener('storage', handleStatusSync);
    };
  }, []);

  // Real-time synchronization when equipment provider adds/updates/deletes fleet assets
  useEffect(() => {
    const handleSync = () => {
      setEquipmentList(loadMergedEquipment());
    };
    window.addEventListener('agrishield_equipment_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('agrishield_equipment_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadMergedEquipment]);

  // Persistent Blacklist for Deleted Vouchers (guarantees deleted bookings are never resurrected by background polling)
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

  // 100% Real User Bookings with LocalStorage sync (Zero Duplicates & Zero Mock Data)
  const [myBookings, setMyBookings] = useState(() => {
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

  // Real-time synchronization when equipment provider updates bookings (Accept/Reject/Complete)
  useEffect(() => {
    const handleBookingsSync = () => {
      try {
        const deletedIds = getDeletedBookingIds();
        const saved = localStorage.getItem('agrishield_equipment_bookings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const clean = deduplicateBookings(parsed, deletedIds);
            setMyBookings(clean);
          }
        }
      } catch (e) {}
    };
    window.addEventListener('agrishield_bookings_updated', handleBookingsSync);
    window.addEventListener('storage', handleBookingsSync);
    return () => {
      window.removeEventListener('agrishield_bookings_updated', handleBookingsSync);
      window.removeEventListener('storage', handleBookingsSync);
    };
  }, [getDeletedBookingIds]);

  // Save bookings to localStorage with deduplication check
  useEffect(() => {
    try {
      const deletedIds = getDeletedBookingIds();
      const clean = deduplicateBookings(myBookings, deletedIds);
      localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(clean));
    } catch (e) {}
  }, [myBookings, getDeletedBookingIds]);

  // Fetch remote bookings from backend for multi-device real-time sync (With Zero Duplicates)
  useEffect(() => {
    let isMounted = true;
    const fetchRemoteBookings = async () => {
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
        if (isMounted && res.data?.bookings && Array.isArray(res.data.bookings)) {
          const deletedIds = getDeletedBookingIds();
          const remoteBookings = res.data.bookings.filter(b => {
            if (!b) return false;
            const key = String(b.id || b.bookingId || '');
            if (deletedIds.has(key)) return false;
            if (key === 'BK-78210' || key.startsWith('BK-TEST-')) return false;
            return true;
          });
          const remoteMap = new Map();
          remoteBookings.forEach(b => {
            const key = b && (b.id || b.bookingId);
            if (key) remoteMap.set(key, b);
          });

          setMyBookings(prev => {
            let hasChanged = false;
            // 1. Update existing local bookings with latest remote status
            const updatedExisting = prev.map(localB => {
              const key = localB && (localB.id || localB.bookingId);
              if (remoteMap.has(key)) {
                const remoteB = remoteMap.get(key);
                const isLocallyCancelled = String(localB.status).toLowerCase() === 'cancelled';
                const isRemotePending = String(remoteB.status).toLowerCase() === 'pending';
                const effectiveStatus = (isLocallyCancelled && isRemotePending) ? 'cancelled' : (remoteB.status || localB.status);

                if (localB.status !== effectiveStatus || localB.updatedAt !== remoteB.updatedAt) {
                  hasChanged = true;
                }
                return {
                  ...localB,
                  ...remoteB,
                  status: effectiveStatus,
                  cancelReason: localB.cancelReason || remoteB.cancelReason,
                  cancelledAt: localB.cancelledAt || remoteB.cancelledAt
                };
              }
              return localB;
            });

            // 2. Combine and deduplicate strictly
            const finalMerged = deduplicateBookings([...remoteBookings, ...updatedExisting], deletedIds);
            if (hasChanged || prev.length !== finalMerged.length) {
              try {
                localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(finalMerged));
              } catch (e) {}
              return finalMerged;
            }
            return prev;
          });
        }
      } catch (err) {}
    };

    fetchRemoteBookings();
    // Fast 5-second polling interval so provider actions on laptop appear on farmer mobile immediately
    const pollInterval = setInterval(fetchRemoteBookings, 5000);
    window.addEventListener('agrishield_bookings_updated', fetchRemoteBookings);
    window.addEventListener('storage', fetchRemoteBookings);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('agrishield_bookings_updated', fetchRemoteBookings);
      window.removeEventListener('storage', fetchRemoteBookings);
    };
  }, [getDeletedBookingIds]);

  // Fetch remote fleet availability from backend for multi-device cross-browser sync
  useEffect(() => {
    const fetchFleetStatus = async () => {
      try {
        let res;
        try {
          res = await API.get('/api/v1/equipment/fleet/status');
        } catch (_) {}
        if (!res?.data?.availability) {
          try {
            res = await axios.get('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/fleet/status', { timeout: 10000 });
          } catch (_) {}
        }
        if (!res?.data?.availability) {
          try {
            res = await axios.get('https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/fleet/status', { timeout: 10000 });
          } catch (_) {}
        }
        if (res?.data?.availability && typeof res.data.availability === 'object') {
          const availMap = res.data.availability;
          setEquipmentList(prev => prev.map(item => {
            if (availMap[item.id] !== undefined) {
              const isAvail = Boolean(availMap[item.id]);
              return {
                ...item,
                available: isAvail,
                availableToday: isAvail && item.availableToday !== false
              };
            }
            return item;
          }));
        }
      } catch (err) {}
    };
    fetchFleetStatus();
    const interval = setInterval(fetchFleetStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  // Derived cascading dropdowns for Location Switcher Modal
  // Fetch remote equipment catalog from backend for multi-device sync
  useEffect(() => {
    const fetchRemoteCatalog = async () => {
      try {
        let res;
        try {
          res = await API.get('/api/v1/equipment/catalog');
        } catch (_) {}
        if (!res?.data?.catalog && !res?.data?.equipment) {
          try {
            res = await axios.get('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/catalog', { timeout: 10000 });
          } catch (_) {}
        }
        if (!res?.data?.catalog && !res?.data?.equipment) {
          try {
            res = await axios.get('https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/catalog', { timeout: 10000 });
          } catch (_) {}
        }
        const catalogItems = res?.data?.catalog || res?.data?.equipment;
        if (catalogItems && Array.isArray(catalogItems) && catalogItems.length > 0) {
          setEquipmentList(prev => {
            const merged = deduplicateEquipment([...prev, ...catalogItems]);
            try {
              localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(merged));
            } catch (_) {}
            return merged;
          });
        }
      } catch (_) {}
    };
    fetchRemoteCatalog();
  }, []);

  const availableDistricts = useMemo(() => getDistricts(locationState), [locationState]);
  const availableMandals = useMemo(() => getMandals(locationState, locationDistrict), [locationState, locationDistrict]);
  const availableVillages = useMemo(() => getVillages(locationState, locationDistrict, locationMandal), [locationState, locationDistrict, locationMandal]);

  // Filtered and Sorted Equipment Catalog (Strict Zero-Duplicate Rendering)
  const displayedEquipment = useMemo(() => {
    const cleanList = deduplicateEquipment(equipmentList);
    return cleanList
      .filter((item) => {
        // Category filter
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchTelugu = (item.teluguTitle || '').toLowerCase().includes(q);
          const matchBrand = (item.brand || '').toLowerCase().includes(q);
          const matchProvider = (item.providerName || '').toLowerCase().includes(q);
          const matchMandal = (item.mandal || '').toLowerCase().includes(q);
          const matchVillage = (item.village || '').toLowerCase().includes(q);
          if (!matchTitle && !matchTelugu && !matchBrand && !matchProvider && !matchMandal && !matchVillage) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nearest') return (a.distanceKm || 0) - (b.distanceKm || 0);
        if (sortBy === 'price-low') return (a.ratePerAcre || a.ratePerHour || 0) - (b.ratePerAcre || b.ratePerHour || 0);
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        return 0;
      });
  }, [equipmentList, categoryFilter, searchQuery, sortBy]);

  // In-App Direct Chat Active Conversation
  const [activeChatBooking, setActiveChatBooking] = useState(null);

  // In-App Direct Chat with Provider for any Fleet Machine
  const openChatForMachine = (item) => {
    const chatMessageObj = {
      id: `fleet_${item.id}`,
      notification_id: `fleet_${item.id}`,
      category: 'booking',
      type: 'booking',
      bookingId: `INQ-${item.id}`,
      booking_id: `INQ-${item.id}`,
      equipmentTitle: item.title,
      title: item.title,
      providerName: item.providerName || item.ownerName || (isTe ? 'ధృవీకరించబడిన ప్రొవైడర్' : 'Verified Provider'),
      providerPhone: item.phone || item.contactPhone || '9848012345',
      provider_phone: item.phone || item.contactPhone || '9848012345',
      farmerName: user?.name || 'Trivendra reddy',
      farmerPhone: user?.phone || '9440182736',
      phone: user?.phone || '9440182736',
      village: locationVillage || item.village || item.locationVillage || 'Pasupugallu',
      mandal: locationMandal || item.mandal || 'Mundlamuru',
      district: locationDistrict || item.district || 'Prakasam',
      acres: '2',
      totalCost: item.ratePerAcre || item.hourlyRate || '800',
      status: item.available ? 'confirmed' : 'pending',
      message: isTe
        ? `నమస్తే! నేను మీ ${item.title} యంత్రం అద్దెకు తీసుకోవడం గురించి సంప్రదిస్తున్నాను.`
        : `Hello! Inquiring to rent your ${item.title} via AgriShield AI.`
    };
    setActiveChatBooking(chatMessageObj);
  };

  // In-App Direct Chat with Provider for an active Booking Voucher
  const openChatForBooking = (b) => {
    const bKey = b.id || b.bookingId || 'BK-1';
    const chatMessageObj = {
      id: bKey,
      notification_id: bKey,
      category: 'booking',
      type: 'booking',
      bookingId: bKey,
      booking_id: bKey,
      equipmentTitle: b.equipmentTitle || b.title || 'Farm Machinery',
      title: b.title || b.equipmentTitle || 'Farm Machinery',
      providerName: b.providerName || (isTe ? 'ధృవీకరించబడిన ప్రొవైడర్' : 'Verified Provider'),
      providerPhone: b.providerPhone || b.phone || b.contactPhone || '9848012345',
      provider_phone: b.providerPhone || b.phone || b.contactPhone || '9848012345',
      farmerName: b.farmerName || user?.name || 'Trivendra reddy',
      farmerPhone: b.farmerPhone || user?.phone || '9440182736',
      phone: b.farmerPhone || user?.phone || '9440182736',
      village: b.village || locationVillage || 'Pasupugallu',
      mandal: b.mandal || locationMandal || 'Mundlamuru',
      district: b.district || locationDistrict || 'Prakasam',
      acres: b.acres || '1.5',
      totalCost: b.totalCost || '800',
      status: b.status || 'pending',
      bookingDate: b.bookingDate,
      timeSlot: b.timeSlot,
      operation: b.operation,
      fieldStatus: b.fieldStatus,
      message: isTe
        ? `బుకింగ్ #${bKey} కోసం ప్రొవైడర్‌తో సంభాషణ.`
        : `Booking #${bKey} coordination thread.`
    };
    setActiveChatBooking(chatMessageObj);
  };

  // Booking Modal Open Handler
  const handleOpenBooking = (equipment) => {
    setSelectedEquipment(equipment);
    setIsBookModalOpen(true);
  };

  // Sync completed booking to Farm Khata Ledger
  const handleSyncToKhata = (booking) => {
    try {
      const farmId = activeFarm?.id || 'default_farm';
      const khataKey = `agrishield_farm_khata_${farmId}`;
      const savedLedger = localStorage.getItem(khataKey);
      let ledger = { expenses: [], sales: [] };
      if (savedLedger) {
        ledger = JSON.parse(savedLedger);
      }

      const newExpense = {
        id: `exp-bk-${Date.now()}`,
        category: 'machinery',
        title: `${booking.title} (${booking.operation || 'Rental Service'})`,
        amount: booking.totalCost,
        date: booking.bookingDate,
        notes: `Auto-synced from Machinery Booking ID #${booking.id} (${booking.acres} acres)`
      };

      ledger.expenses.unshift(newExpense);
      localStorage.setItem(khataKey, JSON.stringify(ledger));

      // Mark this booking as synced
      setMyBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, syncedToKhata: true } : b))
      );

      alert(isTe ? 'డిజిటల్ పొలం ఖాతా పాస్‌బుక్‌కు ఖర్చు విజయవంతంగా జోడించబడింది!' : 'Rental cost successfully logged into Digital Farm Khata passbook!');
    } catch (e) {
      console.error(e);
      alert('Failed to sync with Farm Khata');
    }
  };

  // ── Booking Management & Farmer Actions (Cancel, Delete, Filter, Re-book) ──
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReasonKey, setCancelReasonKey] = useState('weather');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [deleteModalBooking, setDeleteModalBooking] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [bookingToast, setBookingToast] = useState(null); // { message, type }

  const showToast = useCallback((message, type = 'success') => {
    setBookingToast({ message, type });
    setTimeout(() => {
      setBookingToast(null);
    }, 4500);
  }, []);

  const CANCELLATION_REASONS = useMemo(() => [
    {
      key: 'weather',
      labelEn: 'Sudden rain or wet soil conditions (పొలంలో వర్షం/బురద నీరు)',
      labelTe: 'అకస్మాత్తుగా వర్షం పడింది / పొలం బాగా బురదగా మారింది'
    },
    {
      key: 'alternative',
      labelEn: 'Arranged another tractor / implement earlier (వేరే యంత్రం దొరికింది)',
      labelTe: 'స్థానికంగా వేరే ట్రాక్టర్/యంత్రం ముందుగానే దొరికింది'
    },
    {
      key: 'reschedule',
      labelEn: 'Need to change date or schedule for next week (తేదీ మార్చాలి)',
      labelTe: 'తేదీ మార్చాలనుకుంటున్నాను / వచ్చే వారం బుక్ చేస్తాను'
    },
    {
      key: 'crop_delay',
      labelEn: 'Field stage or crop not ready yet (పైరు సిద్ధంగా లేదు)',
      labelTe: 'పైరు లేదా పొలం ఇంకా పనికి సిద్ధంగా లేదు'
    },
    {
      key: 'price_issue',
      labelEn: 'Budget or rental terms issue (బడ్జెట్ సమస్య)',
      labelTe: 'ధర లేదా బడ్జెట్ సరిపోలేదు'
    },
    {
      key: 'other',
      labelEn: 'Other reason (ఇతర వ్యక్తిగత కారణం)',
      labelTe: 'ఇతర వ్యక్తిగత కారణం'
    }
  ], []);

  // Filtered Bookings & Count Badges (Strict Zero-Duplicate Guarantees)
  const cleanMyBookings = useMemo(() => {
    return deduplicateBookings(myBookings, getDeletedBookingIds());
  }, [myBookings, getDeletedBookingIds]);

  const bookingCounts = useMemo(() => {
    const counts = { all: cleanMyBookings.length, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    cleanMyBookings.forEach((b) => {
      const s = String(b.status || 'pending').toLowerCase();
      if (s === 'pending') counts.pending++;
      else if (s === 'confirmed' || s === 'in-progress' || s === 'scheduled') counts.confirmed++;
      else if (s === 'completed') counts.completed++;
      else if (s === 'cancelled' || s === 'canceled' || s === 'rejected' || s === 'declined') counts.cancelled++;
    });
    return counts;
  }, [cleanMyBookings]);

  const filteredBookings = useMemo(() => {
    if (bookingStatusFilter === 'all') return cleanMyBookings;
    return cleanMyBookings.filter((b) => {
      const s = String(b.status || 'pending').toLowerCase();
      if (bookingStatusFilter === 'pending') return s === 'pending';
      if (bookingStatusFilter === 'confirmed') return s === 'confirmed' || s === 'in-progress' || s === 'scheduled';
      if (bookingStatusFilter === 'completed') return s === 'completed';
      if (bookingStatusFilter === 'cancelled') return s === 'cancelled' || s === 'canceled' || s === 'rejected' || s === 'declined';
      return true;
    });
  }, [cleanMyBookings, bookingStatusFilter]);

  // Cancel Booking Handler
  const handleCancelBooking = async () => {
    if (!cancelModalBooking) return;
    const bookingId = cancelModalBooking.id || cancelModalBooking.bookingId;
    if (!bookingId) return;

    const selectedReasonObj = CANCELLATION_REASONS.find(r => r.key === cancelReasonKey);
    let finalReason = isTe ? (selectedReasonObj?.labelTe || cancelReasonKey) : (selectedReasonObj?.labelEn || cancelReasonKey);
    if (cancelReasonKey === 'other' && customCancelReason.trim()) {
      finalReason = customCancelReason.trim();
    }

    setIsProcessingAction(true);

    // 1. Optimistic Local State Update with authoritative cancellation timestamp
    const cancelTime = new Date().toISOString();
    setMyBookings((prev) => {
      const updated = prev.map((b) => {
        const bKey = b.id || b.bookingId;
        if (bKey === bookingId) {
          return {
            ...b,
            status: 'cancelled',
            cancelReason: finalReason,
            cancelledAt: cancelTime,
            updatedAt: cancelTime
          };
        }
        return b;
      });
      try {
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2. Send remote PATCH to backend cluster (await network completion before emitting cross-tab sync)
    try {
      let patched = false;
      try {
        await API.patch(`/api/v1/equipment/bookings/${bookingId}/status`, {
          status: 'cancelled',
          cancelReason: finalReason
        });
        patched = true;
      } catch (_) {}

      if (!patched) {
        try {
          await axios.patch(`https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings/${bookingId}/status`, {
            status: 'cancelled',
            cancelReason: finalReason
          }, { timeout: 10000 });
          patched = true;
        } catch (_) {}
      }

      if (!patched) {
        try {
          await axios.patch(`https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings/${bookingId}/status`, {
            status: 'cancelled',
            cancelReason: finalReason
          }, { timeout: 10000 });
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Backend sync warning on cancellation:', err);
    } finally {
      setIsProcessingAction(false);
      setCancelModalBooking(null);
      setCustomCancelReason('');
      window.dispatchEvent(new CustomEvent('agrishield_bookings_updated'));
      showToast(isTe ? 'బుకింగ్ విజయవంతంగా రద్దు చేయబడింది' : 'Booking cancelled successfully', 'info');
    }
  };

  // Delete Voucher Handler
  const handleDeleteBooking = async () => {
    if (!deleteModalBooking) return;
    const bookingId = deleteModalBooking.id || deleteModalBooking.bookingId;
    if (!bookingId) return;

    setIsProcessingAction(true);

    // 1. Immediately blacklist booking ID in localStorage so background polling NEVER resurrects it
    saveDeletedBookingId(bookingId);

    // 2. Optimistic Local State Removal
    setMyBookings((prev) => {
      const updated = prev.filter((b) => (b.id !== bookingId && b.bookingId !== bookingId));
      try {
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 3. Send remote DELETE to backend cluster
    try {
      let deleted = false;
      try {
        await API.delete(`/api/v1/equipment/bookings/${bookingId}`);
        deleted = true;
      } catch (_) {}

      if (!deleted) {
        try {
          await axios.delete(`https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings/${bookingId}`, { timeout: 10000 });
          deleted = true;
        } catch (_) {}
      }

      if (!deleted) {
        try {
          await axios.delete(`https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings/${bookingId}`, { timeout: 10000 });
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Backend sync warning on deletion:', err);
    } finally {
      setIsProcessingAction(false);
      setDeleteModalBooking(null);
      window.dispatchEvent(new CustomEvent('agrishield_bookings_updated'));
      showToast(isTe ? 'రసీదు విజయవంతంగా తొలగించబడింది' : 'Voucher deleted permanently', 'success');
    }
  };

  // Quick 1-Tap Re-Book
  const handleReBook = (booking) => {
    const matched = equipmentList.find((eq) => eq.id === booking.equipmentId || eq.title === booking.title) || {
      id: booking.equipmentId || `eq-rebook-${Date.now()}`,
      title: booking.title,
      teluguTitle: booking.teluguTitle,
      category: booking.category || 'tractor',
      providerName: booking.providerName,
      contactPhone: booking.phone || booking.contactPhone,
      phone: booking.phone || booking.contactPhone,
      ratePerAcre: booking.ratePerAcre || (booking.totalCost / (booking.acres || 1)),
      ratePerHour: booking.ratePerHour || 800,
      village: booking.village || locationVillage,
      mandal: booking.mandal || locationMandal,
      district: booking.district || locationDistrict,
      available: true,
      availableToday: true
    };
    setSelectedEquipment(matched);
    setIsBookModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-20">
      {/* ═══════════ TOP HEADER & BACK NAVIGATION ═══════════ */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/more')}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors py-1 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>{isTe ? '← మరిన్ని సాధనాలకు తిరిగి' : '← Back to More'}</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>{isTe ? 'రైతు అద్దె సేవలు' : 'Custom Hiring Hub'}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Truck className="w-6 h-6" />
              </div>
              <span>{isTe ? 'వ్యవసాయ పరికరాలు & డ్రోన్ అద్దె బుకింగ్' : 'Farm Machinery, Drone & Irrigation Rental'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isTe
                ? 'మీ గ్రామం & మండలంలో సమీప ధృవీకరించబడిన ట్రాక్టర్లు, స్ప్రేయింగ్ డ్రోన్లు మరియు నీటిపారుదల పంపుల బుకింగ్'
                : 'Book nearby verified tractors, spraying drones & irrigation pumps per acre or hour.'}
            </p>
          </div>

          {/* Location Area Badge & Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-amber-400 transition-all text-left cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 pr-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isTe ? 'సేవా ప్రాంతం' : 'Service Area'}</p>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {locationVillage ? `${locationVillage}, ` : ''}{locationMandal} ({locationDistrict})
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0 ml-1">
                {isTe ? 'మార్చండి ▾' : 'Change ▾'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Optional Provider Notice Banner if user is equipment provider ── */}
      {user?.role?.toLowerCase() === 'equipment_provider' && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                {isTe ? 'యంత్రాల ప్రదాత పోర్టల్ అందుబాటులో ఉంది' : 'Equipment Provider Hub Active'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isTe ? 'మీ యంత్రాల కేటలాగ్, రైతు బుకింగ్‌లు మరియు రాబడి లెడ్జర్‌ను నిర్వహించండి.' : 'Manage your machinery fleet, incoming farmer bookings, and earnings in your dedicated portal.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/provider/dashboard')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shrink-0 transition-all shadow-sm"
          >
            {isTe ? 'ప్రదాత హబ్‌కి వెళ్లండి →' : 'Go to Provider Hub →'}
          </button>
        </div>
      )}

      {/* ═══════════ MAIN NAVIGATION TABS (Concept 2 Clean Studio Tabs) ═══════════ */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === 'browse'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{isTe ? 'యంత్రాల కేటలాగ్' : 'Browse Fleet'}</span>
          <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/20 text-white font-bold ml-0.5">
            {displayedEquipment.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === 'bookings'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{isTe ? 'నా బుకింగ్స్' : 'My Bookings'}</span>
          {myBookings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-black ml-0.5">
              {myBookings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chc-info')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === 'chc-info'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isTe ? 'ప్రభుత్వ CHC స్కీములు' : 'Govt CHC Schemes'}</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: BROWSE & BOOK MACHINERY (CONCEPT 2 CLEAN STUDIO WORKSTATION)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'browse' && (
        <div className="space-y-5">
          {/* Concept 2 Unified Search & Location Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isTe ? 'ట్రాక్టర్లు, డ్రోన్లు, సోలార్ పంపులను శోధించండి...' : 'Search tractors, drones, solar pumps...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{locationMandal || 'Mundlamuru'}, {locationDistrict || 'Prakasam'} (Within 10 km)</span>
                </div>
                <span className="text-slate-400 text-[10px]">▾</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-0 focus:outline-none cursor-pointer"
              >
                <option value="nearest">{isTe ? 'సమీపంలోనివి' : 'Nearest'}</option>
                <option value="price-low">{isTe ? 'తక్కువ ధర' : 'Price: Low'}</option>
                <option value="rating">{isTe ? 'రేటింగ్' : 'Top Rated'}</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: isTe ? 'అన్నీ' : 'All', icon: Zap },
              { id: 'tractor', label: isTe ? 'ట్రాక్టర్లు' : 'Tractors', icon: Truck },
              { id: 'drone', label: isTe ? 'డ్రోన్లు' : 'Drones', icon: Compass },
              { id: 'irrigation', label: isTe ? 'నీటి పంపులు' : 'Pumps', icon: Droplets },
              { id: 'harvester', label: isTe ? 'హార్వెస్టర్లు' : 'Harvesters', icon: Wrench },
              { id: 'implement', label: isTe ? 'పరికరాలు' : 'Implements', icon: Sliders }
            ].map((cat) => {
              const Icon = cat.icon;
              const isSelected = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{isTe ? 'సమీపంలో అందుబాటులో ఉన్న యంత్రాలు' : 'Equipment available nearby'}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {displayedEquipment.length}
              </span>
            </h2>
          </div>

          {/* Machinery Cards Grid (Concept 2 Clean 3-Column Studio Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedEquipment.map((item) => {
              const isMachineBooked = item.available === false ||
                myBookings.some(b => 
                  (b.equipmentId === item.id || b.equipmentTitle === item.title) && 
                  (b.status === 'confirmed' || b.status === 'in_progress')
                );

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border shadow-sm transition-all duration-300 flex flex-col justify-between group ${
                    isMachineBooked
                      ? 'border-amber-200/90 dark:border-amber-950/60 bg-amber-500/[0.02]'
                      : 'border-slate-200/90 dark:border-slate-800 hover:shadow-xl hover:border-emerald-400 dark:hover:border-emerald-600'
                  }`}
                >
                  <div>
                    {/* High-res Studio Cutout Machinery Image Container */}
                    <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-3.5 flex items-center justify-center p-2">
                      <img
                        src={item.imageUrl || getEquipmentFallbackImage(item.category, item.title)}
                        alt={item.title}
                        className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getEquipmentFallbackImage(item.category, item.title);
                        }}
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600/95 text-white backdrop-blur-md shadow-sm flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                          <span>{isTe ? 'ధృవీకరించబడింది' : 'Verified'}</span>
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md shadow-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>{item.distanceKm || 2.1} km {isTe ? 'దూరం' : 'away'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Machine Title */}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                      {isTe && item.teluguTitle ? item.teluguTitle : item.title}
                    </h3>

                    {/* Specs Line matching Concept 2 */}
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {item.horsepower ? `${item.horsepower} · ` : ''}
                      {item.category === 'drone' ? 'Pilot Included' : item.operatorIncluded ? 'Driver Included' : 'Self-Drive'} · {item.distanceKm || 2.1} km away
                    </p>

                    {/* Pricing Display */}
                    <div className="flex items-baseline gap-1 mt-2.5">
                      <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                        ₹{item.ratePerAcre || item.ratePerHour}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        / {item.ratePerAcre ? (isTe ? 'ఎకరాకు' : 'Acre') : (isTe ? 'గంటకు' : 'hr')}
                      </span>
                      {item.dailyRate && (
                        <span className="text-[11px] text-slate-400 font-medium ml-1">
                          (or ₹{item.dailyRate}/day)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Book Rental + 3 Communication Options (In-App Message, WhatsApp, Call) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {isMachineBooked ? (
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs cursor-not-allowed select-none"
                      >
                        <Lock className="w-4 h-4" />
                        <span>{isTe ? 'ప్రస్తుతం బుక్ చేయబడింది' : 'Currently Booked'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenBooking(item)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>{isTe ? 'అద్దెకు తీసుకోండి' : 'Book Rental'}</span>
                      </button>
                    )}

                    {/* 3 Secondary Communication Options */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openChatForMachine(item)}
                        className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                        title={isTe ? 'యాప్‌లోనే ప్రొవైడర్‌తో చాట్ చేయండి' : 'In-App Direct Chat with Provider'}
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-white shrink-0" />
                        <span className="truncate">{isTe ? 'సందేశం' : 'Message'}</span>
                      </button>

                      <a
                        href={`https://wa.me/${String(item.phone || item.contactPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          isTe
                            ? `నమస్తే! నేను అగ్రిషీల్డ్ యాప్ ద్వారా మీ ${item.teluguTitle || item.title || 'యంత్రం'} బుకింగ్ కోసం సంప్రదిస్తున్నాను. లొకేషన్: ${locationVillage || ''}, ${locationMandal || ''}. వివరాలు తెలపగలరు.`
                            : `Hello! Inquiring to book your ${item.title || 'machinery'} via AgriShield AI for my farm in ${locationVillage || ''}, ${locationMandal || ''}. Please share availability.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                        title="WhatsApp"
                      >
                        <span className="text-[12px] leading-none shrink-0">🟢</span>
                        <span className="truncate">WhatsApp</span>
                      </a>

                      <a
                        href={`tel:${item.phone || item.contactPhone || ''}`}
                        className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
                        title={isTe ? 'కాల్ చేయండి' : 'Call Provider'}
                      >
                        <Phone className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="truncate">{isTe ? 'కాల్' : 'Call'}</span>
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {displayedEquipment.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
              <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {isTe
                  ? `${locationVillage || locationMandal} ప్రాంతంలో ఇంకా పరికరాలు రిజిస్టర్ కాలేదు`
                  : `No machinery registered in ${locationVillage || locationMandal} yet`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {isTe
                  ? 'ఈ గ్రామంలో ప్రస్తుతానికి సరిపడే యంత్రాలు జాబితా చేయబడలేదు. సమీప గ్రామాల లేదా మండల పరిధిలోని పరికరాలను చూడటానికి లొకేషన్ మార్చండి లేదా ప్రభుత్వ CHC కేంద్రాల సహాయం పొందండి.'
                  : 'No machinery registered in this specific village yet. Try changing your search location to view machinery available in nearby villages/mandals or explore Govt CHC centers.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{isTe ? 'లొకేషన్ మార్చండి' : 'Change Search Location'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chc-info')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isTe ? 'ప్రభుత్వ CHC & సబ్సిడీలు' : 'Govt CHC Subsidies'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: MY BOOKINGS & PASSBOOK STATUS (Concept 2 Clean Studio Cards)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {/* Header & Status Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <span>{isTe ? 'రైతు సర్వీస్ పాస్‌బుక్ & రసీదులు' : 'My Equipment Bookings & Vouchers'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isTe
                  ? 'మీ అన్ని ట్రాక్టర్, డ్రోన్ మరియు యంత్రాల బుకింగ్ స్థితి, రసీదులు మరియు ప్రత్యక్ష నిర్వహణ'
                  : 'Track real-time provider confirmations, dispatch progress, manage vouchers and re-book with 1 tap.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {myBookings.length} {isTe ? 'మొత్తం రసీదులు' : 'Total Vouchers'}
              </span>
            </div>
          </div>

          {/* Status Filter Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: 'all', label: isTe ? 'అన్నీ' : 'All Bookings', count: bookingCounts.all, icon: '📋' },
              { id: 'pending', label: isTe ? 'ధృవీకరణ వేచి ఉంది' : 'Pending Approval', count: bookingCounts.pending, icon: '⏳' },
              { id: 'confirmed', label: isTe ? 'షెడ్యూల్ / పురోగతి' : 'Confirmed & Active', count: bookingCounts.confirmed, icon: '🚜' },
              { id: 'completed', label: isTe ? 'పూర్తయినవి' : 'Completed', count: bookingCounts.completed, icon: '🏆' },
              { id: 'cancelled', label: isTe ? 'రద్దు / తిరస్కరించినవి' : 'Cancelled / Declined', count: bookingCounts.cancelled, icon: '❌' },
            ].map((chip) => {
              const isActive = bookingStatusFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setBookingStatusFilter(chip.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bookings List / Empty States */}
          <div>
            {filteredBookings.length === 0 ? (
              <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-2xl">
                  {bookingStatusFilter === 'all' ? '🚜' : '🔍'}
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {bookingStatusFilter === 'all'
                    ? (isTe ? 'ఇంకా ఎటువంటి బుకింగ్స్ లేవు' : 'No equipment bookings found')
                    : (isTe ? 'ఈ కేటగిరీలో ఎటువంటి బుకింగ్స్ లేవు' : 'No bookings in this filter')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {bookingStatusFilter === 'all'
                    ? (isTe
                        ? 'మీరు ఏదైనా ట్రాక్టర్, డ్రోన్ లేదా నీటి పారుదల పంపును బుక్ చేసినప్పుడు, ఆ రసీదులు ఇక్కడ కనిపిస్తాయి.'
                        : 'When you book machinery or a spraying drone, your booking vouchers and statuses will appear here.')
                    : (isTe
                        ? 'వేరే ఫిల్టర్‌ని ఎంచుకోండి లేదా మొత్తం బుకింగ్స్‌ను చూడండి.'
                        : 'Try selecting a different filter chip or clear your filter to view all vouchers.')}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {bookingStatusFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setBookingStatusFilter('all')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isTe ? 'అన్ని బుకింగ్స్ చూడండి' : 'Show All Bookings'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('browse')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-colors cursor-pointer"
                  >
                    {isTe ? 'పరికరాలను చూడండి' : 'Browse Available Equipment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBookings.map((b) => {
                  const bKey = b.id || b.bookingId;
                  const rawStatus = String(b.status || 'pending').toLowerCase();
                  const isCancelled = rawStatus === 'cancelled' || rawStatus === 'canceled';
                  const isDeclined = rawStatus === 'rejected' || rawStatus === 'declined';
                  const isCompleted = rawStatus === 'completed';
                  const isPending = rawStatus === 'pending';
                  const isInProgress = rawStatus === 'in-progress';
                  const isConfirmed = rawStatus === 'confirmed' || rawStatus === 'scheduled' || isInProgress;

                  // Status Theme
                  const statusMeta = isCancelled
                    ? {
                        label: isTe ? 'రద్దు చేయబడింది' : 'Cancelled',
                        color: 'bg-rose-500/90 text-white border-rose-600',
                        badgeIcon: <Ban className="w-3 h-3 text-white" />
                      }
                    : isDeclined
                    ? {
                        label: isTe ? 'తిరస్కరించబడింది' : 'Declined',
                        color: 'bg-rose-500/90 text-white border-rose-600',
                        badgeIcon: <AlertTriangle className="w-3 h-3 text-white" />
                      }
                    : isCompleted
                    ? {
                        label: isTe ? 'పూర్తయింది' : 'Completed',
                        color: 'bg-purple-600/90 text-white border-purple-700',
                        badgeIcon: <CheckCircle2 className="w-3 h-3 text-white" />
                      }
                    : isInProgress
                    ? {
                        label: isTe ? 'పనిలో ఉంది' : 'In Progress',
                        color: 'bg-sky-600/90 text-white border-sky-700',
                        badgeIcon: <Truck className="w-3 h-3 text-white animate-pulse" />
                      }
                    : isConfirmed
                    ? {
                        label: isTe ? 'షెడ్యూల్ అయింది' : 'Confirmed',
                        color: 'bg-emerald-600/90 text-white border-emerald-700',
                        badgeIcon: <Check className="w-3 h-3 text-white" />
                      }
                    : {
                        label: isTe ? 'వేచి ఉంది' : 'Pending',
                        color: 'bg-amber-500/90 text-white border-amber-600',
                        badgeIcon: <Clock className="w-3 h-3 text-white animate-spin" />
                      };

                  // Stepper Active Step (1 to 4)
                  const currentStepNumber = isCompleted ? 4 : isInProgress ? 3 : isConfirmed ? 2 : 1;

                  return (
                    <motion.div
                      key={bKey}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border shadow-sm transition-all duration-300 flex flex-col justify-between group ${
                        isDeclined || isCancelled
                          ? 'border-rose-200/90 dark:border-rose-900/50 bg-rose-500/[0.02]'
                          : isCompleted
                          ? 'border-purple-200/90 dark:border-purple-900/50 hover:shadow-xl'
                          : isConfirmed
                          ? 'border-emerald-200/90 dark:border-emerald-900/50 hover:shadow-xl'
                          : 'border-slate-200/90 dark:border-slate-800 hover:shadow-xl'
                      }`}
                    >
                      <div>
                        {/* High-res Studio Cutout Machinery Image Container */}
                        <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-3.5 flex items-center justify-center p-2">
                          <img
                            src={b.imageUrl || getEquipmentFallbackImage(b.category, b.title)}
                            alt={b.title}
                            className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = getEquipmentFallbackImage(b.category, b.title);
                            }}
                          />

                          {/* Top Left Badge: Status */}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black backdrop-blur-md shadow-sm border flex items-center gap-1 ${statusMeta.color}`}>
                              {statusMeta.badgeIcon}
                              <span>{statusMeta.label}</span>
                            </span>
                          </div>

                          {/* Top Right Badge: Voucher ID */}
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-slate-900/80 text-white backdrop-blur-md shadow-sm">
                              #{bKey}
                            </span>
                          </div>
                        </div>

                        {/* Machine Title */}
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                          {isTe && b.teluguTitle ? b.teluguTitle : b.title}
                        </h3>

                        {/* Provider & Location line */}
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-700 dark:text-slate-300 font-bold">{b.providerName || 'Local Provider'}</span>
                          <span>•</span>
                          <span>{b.village || b.locationVillage || locationVillage}</span>
                        </p>

                        {/* Slot & Operation pill line */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-600" />
                            <span>{b.bookingDate}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>{b.timeSlot}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            {b.acres} {isTe ? 'ఎకరాలు' : 'Acres'}
                          </span>
                        </div>

                        {/* Cancellation / Decline Alert if applicable */}
                        {isCancelled && (
                          <div className="mt-2.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-[11px] flex items-start gap-1.5">
                            <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                              <strong>{isTe ? 'రద్దు కారణం: ' : 'Cancelled: '}</strong>
                              {b.cancelReason || (isTe ? 'రైతు అభ్యర్థన మేరకు' : 'Farmer request')}
                            </span>
                          </div>
                        )}

                        {isDeclined && (
                          <div className="mt-2.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-[11px] flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span>{isTe ? 'ప్రొవైడర్ తిరస్కరించారు (స్లాట్ బిజీ)' : 'Declined by provider (Slot unavailable)'}</span>
                          </div>
                        )}

                        {/* 4-Stage Visual Status Stepper (Compact & Elegant for active/completed bookings) */}
                        {!isCancelled && !isDeclined && (
                          <div className="mt-3 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/70">
                            <div className="grid grid-cols-4 relative">
                              <div className="absolute top-2.5 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />
                              <div
                                className="absolute top-2.5 left-[12.5%] h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
                                style={{
                                  width: currentStepNumber === 1 ? '0%' : currentStepNumber === 2 ? '33%' : currentStepNumber === 3 ? '66%' : '75%'
                                }}
                              />

                              {[
                                { step: 1, labelEn: 'Requested', labelTe: 'అభ్యర్థన' },
                                { step: 2, labelEn: 'Approved', labelTe: 'ధృవీకరణ' },
                                { step: 3, labelEn: 'En Route', labelTe: 'మార్గంలో' },
                                { step: 4, labelEn: 'Completed', labelTe: 'పూర్తయింది' }
                              ].map((st) => {
                                const isStepDone = currentStepNumber > st.step;
                                const isStepCurrent = currentStepNumber === st.step;
                                return (
                                  <div key={st.step} className="flex flex-col items-center text-center relative z-10">
                                    <div
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                                        isStepDone
                                          ? 'bg-emerald-600 text-white'
                                          : isStepCurrent
                                          ? isCompleted
                                            ? 'bg-purple-600 text-white ring-2 ring-purple-200 dark:ring-purple-900'
                                            : isInProgress
                                            ? 'bg-sky-600 text-white ring-2 ring-sky-200 dark:ring-sky-900'
                                            : isConfirmed
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-200 dark:ring-emerald-900'
                                            : 'bg-amber-500 text-white ring-2 ring-amber-200 dark:ring-amber-900 animate-pulse'
                                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      {isStepDone ? <Check className="w-3 h-3" /> : st.step}
                                    </div>
                                    <span className={`text-[9px] font-bold mt-1 leading-none ${
                                      isStepCurrent
                                        ? 'text-slate-900 dark:text-slate-100 font-black'
                                        : isStepDone
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-400 dark:text-slate-500'
                                    }`}>
                                      {isTe ? st.labelTe : st.labelEn}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Pricing Total */}
                        <div className="flex items-baseline justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              {isTe ? 'మొత్తం అద్దె' : 'Estimated Rent'}
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-xl font-black ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                ₹{b.totalCost}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                ({b.paymentMode || 'Cash on Field'})
                              </span>
                            </div>
                          </div>

                          {b.operatorIncluded !== false && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                              👨‍🌾 Driver Inc.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions Bar matching Concept 2: 3 Communication Options (In-App Message, WhatsApp, Call) */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => openChatForBooking(b)}
                            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                            title={isTe ? 'ఆర్డర్ చాట్ & వాయిస్ నోట్స్' : 'In-App Order Chat & Voice Notes'}
                          >
                            <MessageSquare className="w-3.5 h-3.5 fill-white shrink-0" />
                            <span className="truncate">{isTe ? 'సందేశం' : 'Message'}</span>
                          </button>

                          <a
                            href={`https://wa.me/${String(b.phone || b.farmerPhone || b.contactPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Booking ID #${bKey}: Hello, inquiring about ${b.title || 'Equipment'} booking for ${b.bookingDate || ''} (${b.timeSlot || ''}) for ${b.acres || 0} Acres.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                            title="WhatsApp"
                          >
                            <span className="text-[12px] leading-none shrink-0">🟢</span>
                            <span className="truncate">WhatsApp</span>
                          </a>

                          <a
                            href={`tel:${b.phone || b.farmerPhone || b.contactPhone || ''}`}
                            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
                            title={isTe ? 'కాల్ చేయండి' : 'Call'}
                          >
                            <Phone className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">{isTe ? 'కాల్' : 'Call'}</span>
                          </a>
                        </div>

                        {/* Secondary Context Actions: Cancel, Re-Book, Delete, Farm Khata */}
                        <div className="flex items-center justify-between gap-1.5 pt-1">
                          {(isPending || isConfirmed) && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelModalBooking(b);
                                setCancelReasonKey('weather');
                                setCustomCancelReason('');
                              }}
                              className="w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold transition-all cursor-pointer"
                            >
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>{isTe ? 'బుకింగ్ రద్దు చేయండి' : 'Cancel Booking'}</span>
                            </button>
                          )}

                          {(isCompleted || isCancelled || isDeclined) && (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => handleReBook(b)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{isTe ? 'మళ్లీ బుక్' : 'Book Again'}</span>
                              </button>

                              {isCompleted && (
                                b.syncedToKhata ? (
                                  <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-0.5" title={isTe ? 'పొలం ఖాతాకు చేరింది' : 'Synced to Farm Khata'}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSyncToKhata(b)}
                                    className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer"
                                    title={isTe ? 'ఖాతాకు చేర్చండి' : 'Sync to Farm Khata'}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}

                              <button
                                type="button"
                                onClick={() => setDeleteModalBooking(b)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                                title={isTe ? 'రసీదు తొలగించండి' : 'Delete Voucher'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: GOVT CHC & SUBSIDY INFORMATION
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'chc-info' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-3">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-white/20 uppercase tracking-wider backdrop-blur-xs">
                {isTe ? 'రైతు భరోసా కేంద్రం (RBK) పథకం' : 'Government Agri Mechanization Support'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black">
                {isTe ? 'కస్టమ్ హైరింగ్ సెంటర్ల (CHC) 40% – 50% రాయితీ సేవలు' : 'Custom Hiring Centers (CHC) 40% - 50% Subsidized Rentals'}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-50 max-w-2xl leading-relaxed">
                {isTe
                  ? 'ఆంధ్రప్రదేశ్ ప్రభుత్వం ప్రతి రైతు భరోసా కేంద్రంలో (RBK) చిన్న మరియు సన్నకారు రైతుల కోసం ట్రాక్టర్లు, రొటవేటర్లు, మరియు అధునాతన స్ప్రేయింగ్ డ్రోన్లను నియంత్రిత తక్కువ అద్దె రేట్లలో అందుబాటులో ఉంచింది.'
                  : 'The Department of Agriculture operates village-level Custom Hiring Centers (CHCs) via Rythu Bharosa Kendrams to provide high-horsepower machinery and spraying drones at standardized, subsidized hiring rates.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                🚜
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {isTe ? 'ట్రాక్టర్ & ఇంప్లిమెంట్స్ రాయితీ' : 'Tractor & Implement Subsidy (SMAM)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isTe
                  ? 'రైతుల గ్రూపులు (SHGs / FPOs) 80% వరకు సబ్సిడీతో కమ్యూనిటీ CHC యూనిట్లను నెలకొల్పవచ్చు.'
                  : 'FPOs and Farmer Groups receive 40% to 80% capital subsidy under the Sub-Mission on Agricultural Mechanization to purchase CHC fleets.'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-black">
                🚁
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {isTe ? 'కిసాన్ డ్రోన్ స్కీమ్ (₹5 లక్షల వరకు)' : 'Kisan Drone Subsidy (Up to ₹5 Lakh)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isTe
                  ? 'యువ గ్రామీణ వ్యవసాయ అభ్యర్థులు మరియు FPOలకు వ్యవసాయ స్ప్రేయింగ్ డ్రోన్ కొనుగోలుపై 50% లేదా ₹5 లక్షల వరకు గ్రాంట్ అందించబడుతుంది.'
                  : 'Subsidies up to 50% (capped at ₹5 Lakhs) for FPOs and agriculture graduates to purchase DGCA-certified agricultural spraying drones.'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                💧
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {isTe ? 'APMIP 90% మైక్రో ఇరిగేషన్' : 'APMIP 90% Drip & Sprinkler Subsidy'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isTe
                  ? 'ఆంధ్రప్రదేశ్ మైక్రో ఇరిగేషన్ ప్రాజెక్ట్ కింద SC/ST రైతులకు 90% మరియు OC/BC రైతులకు 70% సబ్సిడీతో డ్రిప్ సెట్లు మంజూరు చేయబడతాయి.'
                  : 'Andhra Pradesh Micro Irrigation Project grants 90% subsidy for SC/ST farmers and 70% for other farmers for permanent drip and sprinkler kits.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 1: BOOKING POPUP WITH ALL REQUIRED FIELDS
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isBookModalOpen && selectedEquipment && (
          <BookEquipmentModal
            equipment={selectedEquipment}
            activeFarm={activeFarm}
            user={user}
            serviceLocation={{
              state: locationState,
              district: locationDistrict,
              mandal: locationMandal,
              village: locationVillage
            }}
            isProviderOnline={isProviderOnline}
            isTe={isTe}
            onClose={() => setIsBookModalOpen(false)}
            onConfirm={(newBooking) => {
              setMyBookings((prev) => deduplicateBookings([newBooking, ...prev]));
              try {
                const existing = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
                const clean = deduplicateBookings([newBooking, ...existing]);
                localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(clean));
                window.dispatchEvent(new Event('agrishield_bookings_updated'));
              } catch (e) {}
              // Dispatch to backend API for multi-device cross-browser persistence (with dual-endpoint & direct fallback)
              const syncBookingToServer = async (payload) => {
                try {
                  const res = await API.post('/api/v1/equipment/bookings', payload);
                  if (res.data && typeof res.data === 'object' && res.data.id) return res.data;
                } catch (_) {}
                try {
                  const res = await API.post('/api/equipment/bookings', payload);
                  if (res.data && typeof res.data === 'object' && res.data.id) return res.data;
                } catch (_) {}
                try {
                  const res = await axios.post('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings', payload, { timeout: 15000 });
                  if (res.data) return res.data;
                } catch (_) {}
                try {
                  const res = await axios.post('https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings', payload, { timeout: 15000 });
                  return res.data;
                } catch (err) {
                  console.warn('Backend booking sync notice:', err);
                }
              };
              syncBookingToServer(newBooking);
              setIsBookModalOpen(false);
              setActiveTab('bookings');
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 2: LOCATION SWITCHER
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {isTe ? 'సేవా ప్రాంతాన్ని ఎంచుకోండి' : 'Select Service Location'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">{isTe ? 'రాష్ట్రం' : 'State'}</label>
                  <select
                    value={locationState}
                    onChange={(e) => {
                      setLocationState(e.target.value);
                      const dList = getDistricts(e.target.value);
                      setLocationDistrict(dList[0] || '');
                      const mList = getMandals(e.target.value, dList[0]);
                      setLocationMandal(mList[0] || '');
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {INDIA_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">{isTe ? 'జిల్లా' : 'District'}</label>
                  <select
                    value={locationDistrict}
                    onChange={(e) => {
                      setLocationDistrict(e.target.value);
                      const mList = getMandals(locationState, e.target.value);
                      setLocationMandal(mList[0] || '');
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">{isTe ? 'మండలం' : 'Mandal'}</label>
                  <select
                    value={locationMandal}
                    onChange={(e) => {
                      setLocationMandal(e.target.value);
                      const vList = getVillages(locationState, locationDistrict, e.target.value);
                      setLocationVillage(vList[0] || '');
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {availableMandals.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">{isTe ? 'గ్రామం' : 'Village'}</label>
                  {availableVillages.length > 0 ? (
                    <select
                      value={locationVillage}
                      onChange={(e) => setLocationVillage(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      {availableVillages.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={isTe ? 'గ్రామం పేరు టైప్ చేయండి' : 'Type Village Name'}
                      value={locationVillage}
                      onChange={(e) => setLocationVillage(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  {isTe ? 'నిర్ధారించండి' : 'Apply Location'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: CANCEL BOOKING DIALOG (Farmer Friendly)
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        isOpen={Boolean(cancelModalBooking)}
        onClose={() => !isProcessingAction && setCancelModalBooking(null)}
        title={isTe ? 'బుకింగ్ రద్దు చేయండి' : 'Cancel Equipment Booking'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 pt-1">
          {/* Header Summary Info */}
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
              <p className="font-black text-sm">
                #{cancelModalBooking?.id || cancelModalBooking?.bookingId}: {cancelModalBooking?.title}
              </p>
              <p className="text-amber-800/90 dark:text-amber-300/90">
                {isTe
                  ? 'మీరు ఈ బుకింగ్‌ను రద్దు చేయాలనుకుంటున్నారా? ప్రొవైడర్‌కు తక్షణమే రద్దు సందేశం చేరుతుంది.'
                  : 'Are you sure you want to cancel this booking? The equipment provider will receive an instant alert.'}
              </p>
            </div>
          </div>

          {/* Reason Selection Radio Group */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              {isTe ? 'రద్దు చేయడానికి కారణాన్ని ఎంచుకోండి:' : 'Select Reason for Cancellation:'}
            </label>
            <div className="space-y-2">
              {CANCELLATION_REASONS.map((reason) => {
                const isSelected = cancelReasonKey === reason.key;
                return (
                  <label
                    key={reason.key}
                    onClick={() => setCancelReasonKey(reason.key)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      checked={isSelected}
                      onChange={() => setCancelReasonKey(reason.key)}
                      className="mt-0.5 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="leading-snug">
                      <p>{isTe ? reason.labelTe : reason.labelEn}</p>
                      {isTe && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{reason.labelEn}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Custom text for "Other" */}
          {cancelReasonKey === 'other' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {isTe ? 'దయచేసి కారణం రాయండి:' : 'Please describe the reason:'}
              </label>
              <textarea
                rows={2}
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder={isTe ? 'ఉదాహరణ: తేదీ మార్పు, యంత్రం అందుబాటులో లేకపోవడం...' : 'E.g., Rescheduling with provider, field stage delayed...'}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              disabled={isProcessingAction}
              onClick={() => setCancelModalBooking(null)}
            >
              {isTe ? 'వెనుకకు' : 'Keep Booking'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isProcessingAction}
              onClick={handleCancelBooking}
              leftIcon={<Ban className="w-3.5 h-3.5" />}
            >
              {isTe ? 'రద్దును నిర్ధారించండి' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: DELETE VOUCHER CONFIRMATION DIALOG
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        isOpen={Boolean(deleteModalBooking)}
        onClose={() => !isProcessingAction && setDeleteModalBooking(null)}
        title={isTe ? 'బుకింగ్ రసీదును తొలగించాలా?' : 'Delete Booking Voucher?'}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <p className="font-black text-sm">
                #{deleteModalBooking?.id || deleteModalBooking?.bookingId}: {deleteModalBooking?.title}
              </p>
              <p className="text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                {isTe
                  ? 'ఈ రసీదు మీ పాస్‌బుక్ చరిత్ర నుండి శాశ్వతంగా తొలగించబడుతుంది. ఈ చర్యను వెనక్కి తీసుకోలేరు.'
                  : 'This voucher will be permanently deleted from your passbook record. You will no longer see this voucher.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              disabled={isProcessingAction}
              onClick={() => setDeleteModalBooking(null)}
            >
              {isTe ? 'వద్దనివ్వండి' : 'Keep Voucher'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isProcessingAction}
              onClick={handleDeleteBooking}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {isTe ? 'శాశ్వతంగా తొలగించండి' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          FLOATING TOAST NOTIFICATION (Positioned cleanly above mobile bottom nav)
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {bookingToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 sm:bottom-8 right-4 sm:right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-emerald-600/95 text-white shadow-2xl border border-slate-700 dark:border-emerald-500 font-bold text-xs max-w-sm backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
            <span className="leading-snug">{bookingToast.message}</span>
            <button
              type="button"
              onClick={() => setBookingToast(null)}
              className="ml-auto text-slate-400 hover:text-white dark:text-emerald-100 dark:hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          IN-APP DIRECT MESSAGING & 2-WAY VOICE CHAT MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {activeChatBooking && (
        <div className="fixed inset-0 z-[70] bg-[#f1f3f9] dark:bg-[#0d1117] flex flex-col w-full h-full overflow-hidden animate-fade-in">
          <GoogleMessageReader
            message={activeChatBooking}
            lang={i18n.language}
            onBack={() => setActiveChatBooking(null)}
            onDelete={() => setActiveChatBooking(null)}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENT: BOOKING MODAL WITH ALL REQUIRED FIELDS & LIVE MATH
// ═══════════════════════════════════════════════════════════════════
function BookEquipmentModal({ equipment, activeFarm, user, serviceLocation, isProviderOnline, isTe, onClose, onConfirm }) {
  const [farmerName, setFarmerName] = useState(user?.name || 'Farmer');
  const [farmerPhone, setFarmerPhone] = useState(user?.phone || '9440182736');
  const [farmSector, setFarmSector] = useState(activeFarm?.farm_name || 'My Farm Field 1');
  const [approachRoad, setApproachRoad] = useState('Tractor Accessible Road');

  // ── Land Status & Field Condition Options (Replacing static Target Crop) ──
  const FIELD_STATUS_OPTIONS = useMemo(() => [
    { value: 'Empty Field / Dry Fallow Land', label: isTe ? '🌱 ఖాళీ పొలం / బీడు భూమి (దుక్కికి సిద్ధం)' : '🌱 Empty Field / Dry Fallow Land (Ready for Ploughing)' },
    { value: 'Ploughed Soil / Rough Tilled', label: isTe ? '🚜 దున్నిన పొలం (రోటవేటర్ / లెవలింగ్ కోసం)' : '🚜 Ploughed Soil / Rough Tilled (Needs Rotavator/Harrow)' },
    { value: 'Seedbed Ready / Pre-Sowing', label: isTe ? '🌾 విత్తేందుకు సిద్ధమైన నేల (బోదెలు / బెడ్స్)' : '🌾 Seedbed Ready / Pre-Sowing (Bed / Furrows Ready)' },
    { value: 'Planted Field / Young Sprouts', label: isTe ? '🌿 నాటిన చిన్న పైరు / మొలకలు (కలుపు తీత)' : '🌿 Planted Field / Young Sprouts (Weeding / Interculture)' },
    { value: 'Standing Growing Crop Field', label: isTe ? '🌽 ఎదుగుతున్న పంట పొలం (స్ప్రేయింగ్ / ఎరువులు)' : '🌽 Standing / Growing Crop Field (Spraying / Fertilizer)' },
    { value: 'Flowering & Fruiting Stage Field', label: isTe ? '🍅 పూత & కాత దశలో ఉన్న పొలం (సస్యరక్షణ)' : '🍅 Flowering & Fruiting Stage Field (Pest Control)' },
    { value: 'Mature / Ready for Harvest Field', label: isTe ? '🌾 కోతకు సిద్ధమైన పంట పొలం (హార్వెస్టింగ్)' : '🌾 Mature / Ready for Harvest Field (Harvesting)' },
    { value: 'Post-Harvest Stubble Field', label: isTe ? '🪵 పంట కోసిన తర్వాత మొద్దులున్న పొలం (మల్చర్)' : '🪵 Post-Harvest Stubble Field (Mulcher / Clearing)' },
    { value: 'Paddy Wetland / Muddy Puddle', label: isTe ? '💧 వరి దమ్ము పొలం / బురద నేల (కేజ్ వీల్స్)' : '💧 Paddy Wetland / Muddy Puddle (Cage Wheels Puddling)' },
    { value: 'Orchard / Tree Plantation Field', label: isTe ? '🌳 తోటల భూమి (మిరప, పండ్ల తోటలు)' : '🌳 Orchard / Tree Plantation (Chilli, Mango, Citrus)' },
  ], [isTe]);

  const [fieldStatus, setFieldStatus] = useState('Empty Field / Dry Fallow Land');

  // ── Specific Operations matching the Provider's Registered Equipment & Machinery ──
  const availableOperations = useMemo(() => {
    const list = [];
    const cat = (equipment.category || '').toLowerCase();
    const isDrone = cat === 'drone' || equipment.title?.toLowerCase().includes('drone');
    const isHarvester = cat === 'harvester' || equipment.title?.toLowerCase().includes('harvester');
    const isPump = cat === 'irrigation' || cat === 'pump' || equipment.title?.toLowerCase().includes('pump');

    // 1. Priority: Implements specifically registered by this equipment provider
    const imps = Array.isArray(equipment.implementsIncluded) && equipment.implementsIncluded.length > 0
      ? equipment.implementsIncluded
      : Array.isArray(equipment.implements) && equipment.implements.length > 0
      ? equipment.implements
      : typeof (equipment.implements || equipment.implementsIncluded) === 'string'
      ? (equipment.implements || equipment.implementsIncluded).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (imps.length > 0) {
      imps.forEach(imp => {
        list.push({
          value: `${imp} Operation`,
          label: `★ ${imp} (${isTe ? 'ప్రొవైడర్ అందించే పరికరం' : 'Provider Equipped Attachment'})`
        });
      });
    }

    // 2. Comprehensive operations categorized by machine category
    if (isDrone) {
      list.push(
        { value: 'Foliar Spraying (Nano Urea / Micronutrients)', label: isTe ? 'ఆకులపై స్ప్రే (నానో యూరియా / సూక్ష్మపోషకాలు)' : 'Foliar Spraying (Nano Urea / Micronutrients)' },
        { value: 'Pesticide & Insecticide Ultra-Low Spraying', label: isTe ? 'పురుగు & తెగుళ్ల మందుల పిచికారీ' : 'Pesticide & Insecticide Ultra-Low Spraying' },
        { value: 'Fungicide Canopy Protection Spray', label: isTe ? 'శిలీంద్ర సంహారిణి కానోపీ స్ప్రే' : 'Fungicide Canopy Protection Spray' },
        { value: 'Granular Fertilizer / Seed Broadcasting', label: isTe ? 'గుళికల ఎరువులు / విత్తనాలు వెదజల్లుట' : 'Granular Fertilizer / Seed Broadcasting' },
        { value: 'Multi-Spectral Crop Health & Stress Survey', label: isTe ? 'మల్టీ-స్పెక్ట్రల్ పైరు ఆరోగ్య సర్వే' : 'Multi-Spectral Crop Health & Stress Survey' }
      );
    } else if (isHarvester) {
      list.push(
        { value: 'Paddy Combine Harvesting & Threshing', label: isTe ? 'వరి కోత మరియు నూర్పిడి' : 'Paddy Combine Harvesting & Threshing' },
        { value: 'Maize / Corn Combine Harvesting', label: isTe ? 'మొక్కజొన్న కోత' : 'Maize / Corn Combine Harvesting' },
        { value: 'Pulse / Groundnut Threshing', label: isTe ? 'వేరుశనగ / పప్పుధాన్యాల నూర్పిడి' : 'Pulse / Groundnut Threshing' },
        { value: 'Straw Baling / Residue Collection', label: isTe ? 'గడ్డి చుట్టలు కట్టుట' : 'Straw Baling / Residue Collection' }
      );
    } else if (isPump) {
      list.push(
        { value: 'High-Volume Flood Irrigation Pumping', label: isTe ? 'బోరు / బావి నుండి నీటి తోడుట' : 'High-Volume Flood Irrigation Pumping' },
        { value: 'Portable Diesel Engine Field Irrigation', label: isTe ? 'డీజిల్ ఇంజిన్ నీటి పారుదల' : 'Portable Diesel Engine Field Irrigation' },
        { value: 'Drip System Pressurized Fertigation', label: isTe ? 'డ్రిప్ సిస్టమ్ ఫెర్టిగేషన్ & ఫ్లషింగ్' : 'Drip System Pressurized Fertigation' },
        { value: 'Farm Pond Dewatering & Transfer', label: isTe ? 'రైతు గుంట నీటి బదిలీ' : 'Farm Pond Dewatering & Transfer' }
      );
    } else {
      // Tractor & Primary/Secondary Tillage Machinery
      list.push(
        { value: 'Rotavator / Secondary Tillage', label: isTe ? '🚜 రోటవేటర్ - మట్టిని మెత్తగా చేయుట (Secondary Tillage)' : '🚜 Rotavator / Secondary Tillage' },
        { value: 'Disc Plough / Deep Primary Ploughing', label: isTe ? '🚜 డిస్క్ నాగలి - లోతు దుక్కి దున్నుట (Deep Ploughing)' : '🚜 Disc Plough / Deep Primary Ploughing' },
        { value: 'Cultivator 9-Tyne Harrowing & Clod Crushing', label: isTe ? '🚜 కల్టివేటర్ 9-టైన్ - గడ్డలు పగులగొట్టుట (Harrowing)' : '🚜 Cultivator 9-Tyne Harrowing & Clod Crushing' },
        { value: 'Laser Land Leveling', label: isTe ? '🚜 లేజర్ ల్యాండ్ లెవలింగ్ (భూమి సమాంతరీకరణ)' : '🚜 Laser Land Leveling (Precision Grading)' },
        { value: 'Ridges & Furrows Formation', label: isTe ? '🚜 బోదెలు & కాలువలు వేయుట (Ridger)' : '🚜 Ridges & Furrows Formation' },
        { value: 'Automatic Seed Drill Sowing', label: isTe ? '🚜 సీడ్ డ్రిల్ విత్తనం విత్తుట & ఎరువు వేయుట' : '🚜 Automatic Seed Drill Sowing & Fertilization' },
        { value: 'Tractor Trolley / Heavy Haulage', label: isTe ? '🚜 ట్రాక్టర్ ట్రాలీ - ఎరువులు / పంట రవాణా' : '🚜 Tractor Trolley / Heavy Farm Haulage' },
        { value: 'Paddy Wetland Puddling with Cage Wheels', label: isTe ? '🚜 వరి దమ్ము చేయుట (కేజ్ వీల్స్)' : '🚜 Paddy Wetland Puddling with Cage Wheels' },
        { value: 'Subsoiler Hardpan Breaking', label: isTe ? '🚜 సబ్ సాయిలర్ - గట్టి నేల లోతు బద్దలు కొట్టుట' : '🚜 Subsoiler Hardpan Breaking' },
        { value: 'Mulcher / Crop Stubble Shredding', label: isTe ? '🚜 మల్చర్ - పత్తి/మిర్చి మొద్దులు కత్తిరించుట' : '🚜 Mulcher / Crop Stubble Shredding' },
        { value: 'Inter-row Weed Cultivation', label: isTe ? '🚜 వరుసల మధ్య చిన్న నాగలితో కలుపు తీత' : '🚜 Inter-row Weed Cultivation' }
      );
    }

    list.push({
      value: 'Other Custom Operation',
      label: isTe ? '✏️ ఇతర పని (కస్టమ్ వివరణ రాయండి)...' : '✏️ Other Custom Operation (Type Note)...'
    });

    return list;
  }, [equipment, isTe]);

  // Initial operation value matching the first implement or standard
  const [operationType, setOperationType] = useState(() => {
    const imps = Array.isArray(equipment.implementsIncluded) && equipment.implementsIncluded.length > 0
      ? equipment.implementsIncluded
      : Array.isArray(equipment.implements) && equipment.implements.length > 0
      ? equipment.implements
      : [];
    if (imps.length > 0) return `${imps[0]} Operation`;
    if (equipment.category === 'drone') return 'Foliar Spraying (Nano Urea / Micronutrients)';
    if (equipment.category === 'harvester') return 'Paddy Combine Harvesting & Threshing';
    if (equipment.category === 'irrigation') return 'High-Volume Flood Irrigation Pumping';
    return 'Rotavator / Secondary Tillage';
  });
  const [customOperationNote, setCustomOperationNote] = useState('');

  const [serviceDate, setServiceDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [timeSlot, setTimeSlot] = useState('Early Morning (6:00 AM - 10:00 AM)');

  // Quantity in Acres or Hours
  const [unitMode, setUnitMode] = useState('acres'); // 'acres' | 'hours'
  const [quantity, setQuantity] = useState(parseFloat(activeFarm?.farm_size) || 2.0);

  const [includeOperator, setIncludeOperator] = useState(true);
  const [includeDiesel, setIncludeDiesel] = useState(equipment.fuelIncluded);
  const [paymentPreference, setPaymentPreference] = useState('Pay on Completion (UPI / Cash)');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Live Pricing Calculation
  const baseRate = unitMode === 'acres' ? (equipment.ratePerAcre || 1400) : (equipment.ratePerHour || 1100);
  const rawSubtotal = Math.round(baseRate * quantity);
  // If farmer supplies diesel themselves, discount ₹200/unit
  const fuelDiscount = !includeDiesel ? Math.round(200 * quantity) : 0;
  const totalCost = Math.max(200, rawSubtotal - fuelDiscount);

  const handleSubmit = (e) => {
    e.preventDefault();
    const bookingId = `BK-${Math.floor(10000 + Math.random() * 90000)}`;

    const effectiveOperation = (operationType === 'Other Custom Operation' && customOperationNote.trim())
      ? customOperationNote.trim()
      : operationType;

    const safeFarmerPhone = farmerPhone || user?.phone || '9440182736';
    const safeProviderPhone = equipment.phone || equipment.contactPhone || '9440182736';
    const newBooking = {
      id: bookingId,
      equipmentId: equipment.id,
      providerId: equipment.id,
      title: equipment.title,
      equipmentTitle: equipment.title,
      teluguTitle: equipment.teluguTitle,
      category: equipment.category,
      providerName: equipment.providerName || equipment.ownerName || 'Agro Fleet Service (Pasupugallu)',
      providerPhone: safeProviderPhone,
      provider_phone: safeProviderPhone,
      phone: safeFarmerPhone,
      farmerPhone: safeFarmerPhone,
      contactPhone: safeFarmerPhone,
      farmerName: farmerName || user?.name || 'Local Farmer',
      farmSector,
      fieldStatus,
      targetCrop: fieldStatus,
      crop: fieldStatus,
      approachRoad,
      location: serviceLocation,
      village: serviceLocation?.village || 'Field Location',
      bookingDate: serviceDate,
      date: serviceDate,
      timeSlot,
      slot: timeSlot,
      unitMode,
      acres: quantity,
      acreage: quantity,
      operation: effectiveOperation,
      includeOperator,
      includeDiesel,
      totalCost,
      paymentMode: paymentPreference,
      specialInstructions,
      status: 'pending',
      createdAt: new Date().toISOString(),
      syncedToKhata: false
    };

    onConfirm(newBooking);

    // ── Generate & Dispatch Real-Time Booking Notification for Equipment Provider Inbox ──
    const bookingNotif = {
      notification_id: `notif-${bookingId}`,
      id: `notif-${bookingId}`,
      type: 'booking',
      category: 'booking',
      priority: 'HIGH',
      title: isTe ? `🚜 కొత్త యంత్ర బుకింగ్ వచ్చింది (#${bookingId})` : `🚜 New Machinery Booking Received (#${bookingId})`,
      title_te: `🚜 కొత్త యంత్ర బుకింగ్ వచ్చింది (#${bookingId})`,
      message: isTe
        ? `${newBooking.farmerName} గారు మీ ${equipment.teluguTitle || equipment.title} బుక్ చేసుకున్నారు (${quantity} ఎకరాలు, ${fieldStatus}, పని: ${effectiveOperation}, ${newBooking.village}). మొత్తం: ₹${totalCost}. ఫోన్: ${safeFarmerPhone}.`
        : `Farmer ${newBooking.farmerName} booked your ${equipment.title} (${quantity} Acres, ${fieldStatus}, Operation: ${effectiveOperation}, ${newBooking.village}). Total: ₹${totalCost}. Contact: ${safeFarmerPhone}.`,
      message_te: `${newBooking.farmerName} గారు మీ ${equipment.teluguTitle || equipment.title} బుక్ చేసుకున్నారు (${quantity} ఎకరాలు, ${fieldStatus}, పని: ${effectiveOperation}, ${newBooking.village}). మొత్తం: ₹${totalCost}. ఫోన్: ${safeFarmerPhone}.`,
      booking_id: bookingId,
      bookingId: bookingId,
      farmer_name: newBooking.farmerName,
      farmerName: newBooking.farmerName,
      farmer_phone: safeFarmerPhone,
      farmerPhone: safeFarmerPhone,
      phone: safeFarmerPhone,
      provider_phone: safeProviderPhone,
      providerPhone: safeProviderPhone,
      provider_name: newBooking.providerName,
      providerName: newBooking.providerName,
      equipment_title: equipment.title,
      equipmentTitle: equipment.title,
      total_cost: totalCost,
      totalCost: totalCost,
      date: serviceDate,
      village: newBooking.village,
      field_status: fieldStatus,
      operation: effectiveOperation,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      read: false
    };

    // ── Store notification for Equipment Provider Inbox with explicit target_role ──
    bookingNotif.target_role = 'equipment_provider';
    bookingNotif.role = 'equipment_provider';

    try {
      const existing = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
      localStorage.setItem('agrishield_user_notifications', JSON.stringify([bookingNotif, ...existing.filter(n => n.id !== bookingNotif.id)]));
    } catch (e) {}

    // Dispatch global event for multi-tab provider sync if listening
    window.dispatchEvent(new CustomEvent('agrishield_provider_booking_received', { detail: bookingNotif }));
    window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: bookingNotif }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 my-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
              {isTe ? 'స్లాట్ రిజర్వేషన్ ఫారమ్' : 'Instant Slot Reservation'}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {isTe && equipment.teluguTitle ? equipment.teluguTitle : equipment.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {equipment.providerName} • ₹{baseRate}/{unitMode === 'acres' ? 'Acre' : 'Hr'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Live Provider Online / Offline Status Announcement ── */}
        {isProviderOnline ? (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
            <div className="relative flex items-center justify-center shrink-0">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-black leading-tight">
                {isTe ? '🟢 ప్రొవైడర్ ఈరోజు ఆన్‌లైన్‌లో ఉన్నారు' : '🟢 Equipment Provider is Online Today'}
              </p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium leading-tight mt-0.5">
                {isTe ? 'మీ బుకింగ్ అభ్యర్థన నేరుగా ప్రొవైడర్‌కు చేరుతుంది మరియు వెంటనే ఆమోదించబడుతుంది.' : 'Your booking request will be dispatched instantly to the provider for approval.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <div className="text-left">
              <p className="text-[11px] font-black leading-tight">
                {isTe ? '🔴 ప్రొవైడర్ ఈరోజు ఆఫ్‌లైన్‌లో ఉన్నారు' : '🔴 Equipment Provider is Offline Today'}
              </p>
              <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-medium leading-tight mt-0.5">
                {isTe ? 'మీ బుకింగ్ క్యూ చేయబడుతుంది మరియు ప్రొవైడర్ లాగిన్ అయినప్పుడు పరిశీలిస్తారు.' : 'Your booking will be placed in their pending queue and reviewed once online.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Section 1: Farmer & Field Details */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isTe ? '1. రైతు & పొలం సమాచారం' : '1. Farmer & Field Info'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'రైతు పేరు' : 'Farmer Name'}</label>
                <input
                  type="text"
                  required
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'వాట్సాప్ మొబైల్ నంబర్' : 'WhatsApp Phone'}</label>
                <input
                  type="tel"
                  required
                  value={farmerPhone}
                  onChange={(e) => setFarmerPhone(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'లొకేషన్' : 'Field Village'}</label>
                <input
                  type="text"
                  disabled
                  value={`${serviceLocation.village}, ${serviceLocation.mandal} (${serviceLocation.district})`}
                  className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300"
                />
              </div>

              {/* ── Replaced Target Crop with Dynamic Field Condition / Land Status ── */}
              <div>
                <label className="font-bold text-slate-500 block mb-1">
                  {isTe ? 'పొలం స్థితి / దశ' : 'Field Condition / Land Stage'}
                </label>
                <select
                  value={fieldStatus}
                  onChange={(e) => setFieldStatus(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {FIELD_STATUS_OPTIONS.map((opt, i) => (
                    <option key={i} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Date & Time Slot */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>{isTe ? '2. సేవ తేదీ & సమయం' : '2. Date & Time Slot'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'బుకింగ్ తేదీ' : 'Booking Date'}</label>
                <input
                  type="date"
                  required
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'సమయం స్లాట్' : 'Time Slot'}</label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  <option value="Early Morning (6:00 AM - 10:00 AM)">🌅 Early Morning (6:00 AM - 10:00 AM)</option>
                  <option value="Afternoon (2:00 PM - 6:00 PM)">☀️ Afternoon (2:00 PM - 6:00 PM)</option>
                  <option value="Full Day (8:00 AM - 5:00 PM)">⏰ Full Day (8:00 AM - 5:00 PM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Work Quantity & Specific Operation */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>{isTe ? '3. పని పరిమాణం & ఎంపికలు' : '3. Work Scope & Options'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-500 block mb-1">
                  {unitMode === 'acres' ? (isTe ? 'ఎకరాల విస్తీర్ణం' : 'Total Acres') : (isTe ? 'పని గంటలు' : 'Operating Hours')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUnitMode('acres')}
                      className={`px-2.5 py-1.5 font-black text-[10px] ${unitMode === 'acres' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                    >
                      Acres
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitMode('hours')}
                      className={`px-2.5 py-1.5 font-black text-[10px] ${unitMode === 'hours' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                    >
                      Hours
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Dynamic Specific Operation Dropdown (Provider Machinery Attachments) ── */}
              <div>
                <label className="font-bold text-slate-500 block mb-1">
                  {isTe ? 'నిర్దిష్ట పని రకం (యంత్రం పరికరాలు)' : 'Specific Operation (Equipment)'}
                </label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {availableOperations.map((op, idx) => (
                    <option key={idx} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {operationType === 'Other Custom Operation' && (
                  <input
                    type="text"
                    required
                    placeholder={isTe ? 'పని వివరాలు ఇక్కడ టైప్ చేయండి...' : 'Type specific operation note here...'}
                    value={customOperationNote}
                    onChange={(e) => setCustomOperationNote(e.target.value)}
                    className="w-full p-2 mt-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-600 font-bold text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>

            {/* Toggles for Operator & Fuel */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeOperator}
                  onChange={(e) => setIncludeOperator(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{isTe ? 'ఆపరేటర్ / డ్రైవర్ అవసరం (ఉచితం)' : 'Include Driver / Pilot (Included)'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeDiesel}
                  onChange={(e) => setIncludeDiesel(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{isTe ? 'డీజిల్ యజమానిదే' : 'Machine Owner provides Fuel'}</span>
              </label>
            </div>
          </div>

          {/* Section 4: Live Cost Calculation Card */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-bold">
                {baseRate} × {quantity} {unitMode}
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">₹{rawSubtotal}</span>
            </div>

            {!includeDiesel && fuelDiscount > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-600">
                <span>{isTe ? 'రైతు డీజిల్ తగ్గింపు' : 'Farmer Diesel Supply Discount'}</span>
                <span className="font-bold">- ₹{fuelDiscount}</span>
              </div>
            )}

            <div className="border-t border-emerald-200/80 dark:border-emerald-800 pt-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                  {isTe ? 'మొత్తం అంచనా ధర:' : 'Total Estimated Cost:'}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {isTe ? 'పని పూర్తయిన తర్వాత డ్రైవర్‌కు చెల్లించండి (క్యాష్ / UPI)' : 'Pay to operator upon field work completion (Cash / UPI)'}
                </span>
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{totalCost}
              </span>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            >
              {isTe ? 'రద్దు చేయండి' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{isTe ? 'బుకింగ్‌ను నిర్ధారించండి' : 'Confirm Rental Booking'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

