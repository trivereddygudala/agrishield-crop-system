import { getLocalizedField } from '../../utils/localizationHelper';
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
import { getUserNotificationCache, setUserNotificationCache } from '../../utils/notificationStorage';
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
  deduplicateBookings,
  getDeletedBookingIds,
  saveDeletedBookingId,
  getDeletedEquipmentIds
} from '../../utils/equipmentDeduplication';
import { recordCrossDeviceDeletion } from '../../services/crossDeviceSync';

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

// ── Robust Location Normalization (Fixes ', 0' and ', ()' bugs) ──
export const parseLocationParts = (farmLoc, activeFarm, user) => {
  let village = '';
  let mandal = '';
  let district = '';
  let state = 'Andhra Pradesh';

  if (activeFarm && typeof activeFarm === 'object') {
    if (activeFarm.village && activeFarm.village !== '0') village = String(activeFarm.village).trim();
    if (activeFarm.mandal && activeFarm.mandal !== '0') mandal = String(activeFarm.mandal).trim();
    if (activeFarm.district && activeFarm.district !== '0') district = String(activeFarm.district).trim();
    if (activeFarm.state && activeFarm.state !== '0') state = String(activeFarm.state).trim();
  }

  const rawLoc = farmLoc || user?.farm_location;
  if (rawLoc && typeof rawLoc === 'object') {
    if (!village && rawLoc.village && rawLoc.village !== '0') village = String(rawLoc.village).trim();
    if (!mandal && rawLoc.mandal && rawLoc.mandal !== '0') mandal = String(rawLoc.mandal).trim();
    if (!district && rawLoc.district && rawLoc.district !== '0') district = String(rawLoc.district).trim();
    if ((!state || state === 'Andhra Pradesh') && rawLoc.state) state = String(rawLoc.state).trim();
  } else if (typeof rawLoc === 'string' && rawLoc.trim()) {
    const segments = rawLoc.split(',').map(s => s.trim()).filter(s => s && s !== '0' && s !== 'undefined');
    if (segments.length === 1) {
      if (!village) village = segments[0];
    } else if (segments.length === 2) {
      if (!village) village = segments[0];
      if (!district) district = segments[1];
    } else if (segments.length >= 3) {
      if (!village) village = segments[0];
      if (!mandal) mandal = segments[1];
      if (!district) district = segments[2];
      if (segments.length >= 4 && (!state || state === 'Andhra Pradesh')) state = segments[3];
    }
  }

  if (!village && user?.village && user.village !== '0') village = String(user.village).trim();
  if (!mandal && user?.mandal && user.mandal !== '0') mandal = String(user.mandal).trim();
  if (!district && user?.district && user.district !== '0') district = String(user.district).trim();

  return { village, mandal, district, state };
};

export const formatLocationSummary = (loc, notSetLabel = 'Location not set') => {
  if (!loc || typeof loc !== 'object') {
    return typeof notSetLabel === 'string' ? notSetLabel : 'Location not set';
  }
  const cleanV = loc.village && loc.village !== '0' && loc.village !== 'undefined' ? String(loc.village).trim() : '';
  const cleanM = loc.mandal && loc.mandal !== '0' && loc.mandal !== 'undefined' ? String(loc.mandal).trim() : '';
  const cleanD = loc.district && loc.district !== '0' && loc.district !== 'undefined' ? String(loc.district).trim() : '';

  const parts = [];
  if (cleanV) parts.push(cleanV);
  if (cleanM) parts.push(cleanM);

  let main = parts.join(', ');
  if (cleanD) {
    main = main ? `${main} (${cleanD})` : cleanD;
  }

  return main || (typeof notSetLabel === 'string' ? notSetLabel : 'Location not set');
};

// ═══════════════════════════════════════════════════════════════════
// REAL USER EQUIPMENT & BOOKINGS REPOSITORY (No Mock Data)
// ═══════════════════════════════════════════════════════════════════

export default function EquipmentBookingPage() {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const navigate = useNavigate();
  const { activeFarm } = useFarm();
  const { user } = useAuth();

  // Active top-level mode / tab
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'bookings' | 'chc-info'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'tractor' | 'drone' | 'irrigation' | 'harvester'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'price-low' | 'rating'

  // Service Location state with robust parsing
  const initialLoc = useMemo(() => parseLocationParts(user?.farm_location, activeFarm, user), [user, activeFarm]);
  const [locationState, setLocationState] = useState(() => initialLoc.state);
  const [locationDistrict, setLocationDistrict] = useState(() => initialLoc.district);
  const [locationMandal, setLocationMandal] = useState(() => initialLoc.mandal);
  const [locationVillage, setLocationVillage] = useState(() => initialLoc.village);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Booking Modal State
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  // 100% Real User Equipment Database with Multi-Store & Fleet LocalStorage sync (Zero Duplicates)
  const loadMergedEquipment = useCallback(() => {
    try {
      const deletedEquipIds = getDeletedEquipmentIds();
      const isSynced = localStorage.getItem('agrishield_equipment_catalog_synced') === 'true';
      const rawSaved = localStorage.getItem('agrishield_farmer_catalog_cache');
      const customRaw = localStorage.getItem('agrishield_custom_equipment_listings');

      if (rawSaved !== null) {
        const farmerSaved = JSON.parse(rawSaved);
        if (Array.isArray(farmerSaved)) {
          if (farmerSaved.length > 0 || isSynced) {
            return deduplicateEquipment(farmerSaved, deletedEquipIds);
          }
        }
      }

      if (customRaw !== null) {
        const customSaved = JSON.parse(customRaw);
        if (Array.isArray(customSaved) && (customSaved.length > 0 || isSynced)) {
          return deduplicateEquipment(customSaved, deletedEquipIds);
        }
      }

      // If never synced before, load canonical starter fleet filtered by blacklisted deletions
      if (!isSynced) {
        return deduplicateEquipment(CANONICAL_STARTER_FLEET, deletedEquipIds);
      }

      return [];
    } catch (e) {
      console.warn('Failed to parse equipment:', e);
      return [];
    }
  }, []);

  const [equipmentList, setEquipmentList] = useState(loadMergedEquipment);

  // Provider Online / Offline Status Sync (H-3: never default unknown to true)
  const [isProviderOnline, setIsProviderOnline] = useState(false);

  useEffect(() => {
    const handleStatusSync = (e) => {
      if (e?.detail?.isOnline !== undefined) {
        setIsProviderOnline(Boolean(e.detail.isOnline));
      }
    };
    window.addEventListener('agrishield_provider_status_changed', handleStatusSync);
    return () => {
      window.removeEventListener('agrishield_provider_status_changed', handleStatusSync);
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

  // Canonical Blacklist for Deleted Vouchers (guarantees deleted bookings are never resurrected by background polling)

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
            const nowMs = Date.now();
            // Preserve only freshly submitted local bookings created in the last 45s that haven't hit the server yet
            const inFlightRecent = prev.filter(localB => {
              const key = localB && (localB.id || localB.bookingId);
              if (remoteMap.has(key) || deletedIds.has(key)) return false;
              const createdMs = localB?.createdAt ? new Date(localB.createdAt).getTime() : 0;
              return (nowMs - createdMs < 45000);
            });

            // The remote server is authoritative for all historical bookings across all mobile phones.
            // Any booking deleted on another device disappears permanently here.
            const finalMerged = deduplicateBookings([...inFlightRecent, ...remoteBookings], deletedIds);
            try {
              localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(finalMerged));
            } catch (e) {}
            return finalMerged;
          });
        }
      } catch (err) {}
    };

    fetchRemoteBookings();
    // 20-second polling interval (visibility-guarded) with instant focus/storage/visibility revalidation
    const pollInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchRemoteBookings();
    }, 20000);
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        fetchRemoteBookings();
      }
    };

    window.addEventListener('agrishield_bookings_updated', fetchRemoteBookings);
    window.addEventListener('storage', fetchRemoteBookings);
    window.addEventListener('focus', fetchRemoteBookings);
    document.addEventListener('visibilitychange', handleRevalidate);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('agrishield_bookings_updated', fetchRemoteBookings);
      window.removeEventListener('storage', fetchRemoteBookings);
      window.removeEventListener('focus', fetchRemoteBookings);
      document.removeEventListener('visibilitychange', handleRevalidate);
    };
  }, [getDeletedBookingIds]);

  // Fetch remote equipment catalog to sync machinery additions & deletions across devices
  useEffect(() => {
    let isMounted = true;
    const fetchRemoteCatalog = async () => {
      try {
        let res;
        try {
          res = await API.get('/api/v1/equipment/catalog');
        } catch (_) {}
        let serverItems = null;
        if (res?.data && (Array.isArray(res.data.equipment) || Array.isArray(res.data.catalog))) {
          serverItems = Array.isArray(res.data.equipment) ? res.data.equipment : res.data.catalog;
        }

        if (serverItems === null) {
          try {
            res = await API.get('/api/equipment/catalog');
            if (res?.data && (Array.isArray(res.data.equipment) || Array.isArray(res.data.catalog))) {
              serverItems = Array.isArray(res.data.equipment) ? res.data.equipment : res.data.catalog;
            }
          } catch (_) {}
        }



        if (isMounted && Array.isArray(serverItems)) {
          const deletedEquipIds = getDeletedEquipmentIds();
          const cleanCatalog = deduplicateEquipment(serverItems, deletedEquipIds);
          setEquipmentList(cleanCatalog);
          try {
            localStorage.setItem('agrishield_farmer_catalog_cache', JSON.stringify(cleanCatalog));
            localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(cleanCatalog));
            localStorage.setItem('agrishield_equipment_catalog_synced', 'true');
          } catch (_) {}
        }
      } catch (_) {}
    };

    fetchRemoteCatalog();
    const catInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchRemoteCatalog();
    }, 60000);
    const handleVisibilityCat = () => {
      if (document.visibilityState === 'visible') fetchRemoteCatalog();
    };
    window.addEventListener('agrishield_equipment_updated', fetchRemoteCatalog);
    window.addEventListener('focus', fetchRemoteCatalog);
    document.addEventListener('visibilitychange', handleVisibilityCat);

    return () => {
      isMounted = false;
      clearInterval(catInterval);
      window.removeEventListener('agrishield_equipment_updated', fetchRemoteCatalog);
      window.removeEventListener('focus', fetchRemoteCatalog);
      document.removeEventListener('visibilitychange', handleVisibilityCat);
    };
  }, [getDeletedEquipmentIds]);

  // Fetch remote fleet availability from backend for multi-device cross-browser sync
  useEffect(() => {
    const fetchFleetStatus = async () => {
      try {
        let res;
        try {
          res = await API.get('/api/v1/equipment/fleet/status');
        } catch (_) {}

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
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchFleetStatus();
    }, 30000);
    return () => clearInterval(interval);
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
      providerName: item.providerName || item.ownerName || t('equipment_hub.verified_provider', 'Verified Provider'),
      providerPhone: item.phone || item.contactPhone || '',
      provider_phone: item.phone || item.contactPhone || '',
      farmerName: user?.name || user?.full_name || t('equipment_hub.farmer', 'Farmer'),
      farmerPhone: user?.phone || user?.mobile || '',
      phone: user?.phone || user?.mobile || '',
      village: locationVillage || item.village || item.locationVillage || t('equipment_hub.field_location', 'Field Location'),
      mandal: locationMandal || item.mandal || '',
      district: locationDistrict || item.district || '',
      acres: '2',
      totalCost: item.ratePerAcre || item.hourlyRate || '800',
      status: 'inquiry',
      message: t('equipment_hub.chat_inquiry_msg', { title: item.title, defaultValue: `Hello! Inquiring to rent your ${item.title} via AgriShield AI.` })
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
      providerName: b.providerName || t('equipment_hub.verified_provider', 'Verified Provider'),
      providerPhone: b.providerPhone || b.phone || b.contactPhone || '',
      provider_phone: b.providerPhone || b.phone || b.contactPhone || '',
      farmerName: b.farmerName || user?.name || user?.full_name || t('equipment_hub.farmer', 'Farmer'),
      farmerPhone: b.farmerPhone || user?.phone || user?.mobile || '',
      phone: b.farmerPhone || user?.phone || user?.mobile || '',
      village: b.village || locationVillage || t('equipment_hub.field_location', 'Field Location'),
      mandal: b.mandal || locationMandal || '',
      district: b.district || locationDistrict || '',
      acres: b.acres || '1.5',
      totalCost: b.totalCost || '800',
      status: b.status || 'pending',
      bookingDate: b.bookingDate,
      timeSlot: b.timeSlot,
      operation: b.operation,
      fieldStatus: b.fieldStatus,
      message: t('equipment_hub.booking_conversation_msg', { bookingId: bKey, defaultValue: `Booking #${bKey} coordination thread.` })
    };
    setActiveChatBooking(chatMessageObj);
  };

  // Booking Modal Open Handler
  const handleOpenBooking = (equipment) => {
    setSelectedEquipment(equipment);
    setIsBookModalOpen(true);
  };

  // Sync completed booking to Farm Khata Ledger
  const handleSyncToKhata = async (booking) => {
    const canonicalFarmId = activeFarm?.id || activeFarm?._id;
    const bookingId = booking.id || booking._id;

    if (!canonicalFarmId) {
      alert(t('equipment_hub.select_farm_first', 'Please select an active farm profile first.'));
      return;
    }

    // Prevent duplicate booking-expense insertion when the same booking is synced repeatedly
    if (booking.syncedToKhata) {
      alert(t('equipment_hub.already_synced_khata', 'This booking is already synced to Farm Khata!'));
      return;
    }

    const txPayload = {
      type: 'expense',
      category: 'machinery',
      description: `${booking.title || 'Equipment Rental'} (${booking.operation || 'Rental Service'}) - Booking #${bookingId}`,
      amount: parseFloat(booking.totalCost) || 0,
      date: booking.bookingDate || new Date().toISOString().split('T')[0],
      booking_id: String(bookingId)
    };

    try {
      // 1. Post to backend first - strictly require confirmed success
      const res = await API.post(`/api/farms/${canonicalFarmId}/khata`, txPayload);
      const createdTx = res.data;

      // 2. Update local cache for offline viewing only after confirmed server response
      const khataKey = `agrishield_khata_${canonicalFarmId}`;
      try {
        const cached = JSON.parse(localStorage.getItem(khataKey) || '[]');
        const targetId = createdTx?.id || createdTx?._id || `bk-${bookingId}`;
        const exists = cached.some(tx => tx.booking_id === String(bookingId) || tx.id === targetId || tx._id === targetId);
        if (!exists) {
          cached.unshift(createdTx || {
            id: targetId,
            ...txPayload
          });
          localStorage.setItem(khataKey, JSON.stringify(cached));
        }
      } catch (_) {}

      // 3. Mark this booking as synced ONLY after confirmed backend persistence
      setMyBookings((prev) =>
        prev.map((b) => ((b.id === booking.id || b._id === booking._id) ? { ...b, syncedToKhata: true } : b))
      );

      alert(t('equipment_hub.sync_khata_success', 'Rental cost successfully logged into Digital Farm Khata passbook!'));
    } catch (apiErr) {
      console.error('Backend Khata sync error:', apiErr);
      // DO NOT mark synced. Allow farmer to retry.
      alert(t('equipment_hub.sync_khata_failed', 'Failed to sync with Farm Khata. Please check your connection and try again.'));
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
    let finalReason = selectedReasonObj ? t(selectedReasonObj.key, selectedReasonObj.labelEn) : cancelReasonKey;
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

    // 2. Send remote PATCH to canonical backend with Idempotency-Key
    try {
      const idempotencyKey = `idemp_cancel_${bookingId}_${Date.now()}`;
      await API.patch(`/api/v1/equipment/bookings/${bookingId}/status`, {
        status: 'cancelled',
        cancelReason: finalReason
      }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
    } catch (err) {
      console.warn('Backend sync warning on cancellation:', err);
    } finally {
      setIsProcessingAction(false);
      setCancelModalBooking(null);
      setCustomCancelReason('');
      window.dispatchEvent(new CustomEvent('agrishield_bookings_updated'));
      showToast(t('equipment_hub.booking_cancelled_success', 'Booking cancelled successfully'), 'info');
    }
  };

  // Delete Voucher Handler
  const handleDeleteBooking = async () => {
    if (!deleteModalBooking) return;
    const bookingId = deleteModalBooking.id || deleteModalBooking.bookingId;
    if (!bookingId) return;

    setIsProcessingAction(true);

    // 1. Immediately blacklist booking ID in localStorage and server tombstones so other phones receive it
    saveDeletedBookingId(bookingId);
    recordCrossDeviceDeletion('booking', bookingId, 'Farmer deleted booking');

    // 2. Optimistic Local State Removal
    setMyBookings((prev) => {
      const updated = prev.filter((b) => (b.id !== bookingId && b.bookingId !== bookingId));
      try {
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 3. Send remote DELETE to canonical backend
    try {
      await API.delete(`/api/v1/equipment/bookings/${bookingId}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 400) {
        showToast(detail || 'Active bookings cannot be deleted. Cancel first.', 'error');
      } else {
        console.warn('Backend sync warning on deletion:', err);
      }
    } finally {
      setIsProcessingAction(false);
      setDeleteModalBooking(null);
      window.dispatchEvent(new CustomEvent('agrishield_bookings_updated'));
      showToast(t('equipment_hub.voucher_deleted_success', 'Voucher deleted permanently'), 'success');
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
            <span>{t('equipment_hub.back_to_more', '← Back to More')}</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>{t('equipment_hub.custom_hiring_hub', 'Custom Hiring Hub')}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Truck className="w-6 h-6" />
              </div>
              <span>{t('equipment_hub.title', 'Farm Machinery, Drone & Irrigation Rental')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('equipment_hub.hero_desc', 'Book nearby verified tractors, spraying drones & irrigation pumps per acre or hour.')}
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('equipment_hub.service_area', 'Service Area')}</p>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {formatLocationSummary({ village: locationVillage, mandal: locationMandal, district: locationDistrict }, t('equipment_hub.location_not_set', 'Location not set'))}
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0 ml-1">
                {t('equipment_hub.change_btn', 'Change ▾')}
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
                {t('equipment_hub.provider_portal_active', 'Equipment Provider Hub Active')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('equipment_hub.provider_portal_desc', 'Manage your machinery fleet, incoming farmer bookings, and earnings in your dedicated portal.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/provider/dashboard')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shrink-0 transition-all shadow-sm"
          >
            {t('equipment_hub.go_to_provider_hub', 'Go to Provider Hub →')}
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
          <span>{t('equipment_hub.browse_fleet', 'Browse Fleet')}</span>
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
          <span>{t('equipment_hub.my_bookings', 'My Bookings')}</span>
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
          <span>{t('equipment_hub.govt_chc_schemes', 'Govt CHC Schemes')}</span>
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
              <label htmlFor="equipment-search-query" className="sr-only">
                {t('equipment_hub.search_placeholder', 'Search tractors, drones, solar pumps...')}
              </label>
              <input
                id="equipment-search-query"
                type="text"
                placeholder={t('equipment_hub.search_placeholder', 'Search tractors, drones, solar pumps...')}
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
                <option value="nearest">{t('equipment_hub.sort_nearest', 'Nearest')}</option>
                <option value="price-low">{t('equipment_hub.sort_price_low', 'Price: Low')}</option>
                <option value="rating">{t('equipment_hub.sort_rating', 'Top Rated')}</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: t('equipment_hub.category_all', 'All'), icon: Zap },
              { id: 'tractor', label: t('equipment_hub.category_tractors', 'Tractors'), icon: Truck },
              { id: 'drone', label: t('equipment_hub.category_drones', 'Drones'), icon: Compass },
              { id: 'irrigation', label: t('equipment_hub.category_irrigation', 'Pumps'), icon: Droplets },
              { id: 'harvester', label: t('equipment_hub.category_harvesters', 'Harvesters'), icon: Wrench },
              { id: 'implement', label: t('equipment_hub.category_tillage', 'Implements'), icon: Sliders }
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
              <span>{t('equipment_hub.equipment_nearby', 'Equipment available nearby')}</span>
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
                          <span>{t('equipment_hub.verified', 'Verified')}</span>
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md shadow-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>{item.distanceKm || 2.1} km {t('equipment_hub.away', 'away')}</span>
                        </span>
                      </div>
                    </div>

                    {/* Machine Title */}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                      {getLocalizedField(item, 'title', currentLang)}
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
                        / {item.ratePerAcre ? t('equipment_hub.per_acre', 'Acre') : t('equipment_hub.per_hour', 'hr')}
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
                        <span>{t('equipment_hub.currently_booked', 'Currently Booked')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenBooking(item)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>{t('equipment_hub.book_now', 'Book Rental')}</span>
                      </button>
                    )}

                    {/* 3 Secondary Communication Options */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openChatForMachine(item)}
                        className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                        title={t('equipment_hub.chat_with_provider', 'In-App Direct Chat with Provider')}
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-white shrink-0" />
                        <span className="truncate">{t('equipment_hub.message', 'Message')}</span>
                      </button>

                      <a
                        href={`https://wa.me/${String(item.phone || item.contactPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          t('equipment_hub.wa_booking_inquiry', { title: item.title || 'machinery', village: locationVillage || '', mandal: locationMandal || '', defaultValue: `Hello! Inquiring to book your ${item.title || 'machinery'} via AgriShield AI for my farm in ${locationVillage || ''}, ${locationMandal || ''}. Please share availability.` })
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
                        title={t('equipment_hub.call_provider', 'Call Provider')}
                      >
                        <Phone className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="truncate">{t('equipment_hub.call', 'Call')}</span>
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
                {t('equipment_hub.no_machinery_area_title', { area: locationVillage || locationMandal || '', defaultValue: `No machinery registered in ${locationVillage || locationMandal} yet` })}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {t('equipment_hub.no_machinery_area_desc', 'No machinery registered in this specific village yet. Try changing your search location to view machinery available in nearby villages/mandals or explore Govt CHC centers.')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{t('equipment_hub.change_location', 'Change Search Location')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chc-info')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('equipment_hub.govt_chc_subsidies', 'Govt CHC Subsidies')}</span>
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
                <span>{t('equipment_hub.farmer_passbook_title', 'My Equipment Bookings & Vouchers')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('equipment_hub.my_bookings_subtitle', 'Track real-time provider confirmations, dispatch progress, manage vouchers and re-book with 1 tap.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {myBookings.length} {t('equipment_hub.total_vouchers', 'Total Vouchers')}
              </span>
            </div>
          </div>

          {/* Status Filter Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: 'all', label: t('equipment_hub.tab_all_bookings', 'All Bookings'), count: bookingCounts.all, icon: '📋' },
              { id: 'pending', label: t('equipment_hub.tab_pending', 'Pending Approval'), count: bookingCounts.pending, icon: '⏳' },
              { id: 'confirmed', label: t('equipment_hub.tab_confirmed', 'Confirmed & Active'), count: bookingCounts.confirmed, icon: '🚜' },
              { id: 'completed', label: t('equipment_hub.tab_completed', 'Completed'), count: bookingCounts.completed, icon: '🏆' },
              { id: 'cancelled', label: t('equipment_hub.tab_cancelled', 'Cancelled / Declined'), count: bookingCounts.cancelled, icon: '❌' },
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
                ? t('equipment_hub.no_bookings_yet', 'No equipment bookings found')
                : t('equipment_hub.no_bookings_in_filter', 'No bookings in this filter')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {bookingStatusFilter === 'all'
                    ? t('equipment_hub.when_you_book_desc', 'When you book machinery or a spraying drone, your booking vouchers and statuses will appear here.')
                    : t('equipment_hub.try_other_filter_desc', 'Try selecting a different filter chip or clear your filter to view all vouchers.')}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {bookingStatusFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setBookingStatusFilter('all')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {t('equipment_hub.show_all_bookings', 'Show All Bookings')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('browse')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-colors cursor-pointer"
                  >
                    {t('equipment_hub.browse_available', 'Browse Available Equipment')}
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
            label: t('equipment_hub.status_cancelled', 'Cancelled'),
                        color: 'bg-rose-500/90 text-white border-rose-600',
                        badgeIcon: <Ban className="w-3 h-3 text-white" />
                      }
                    : isDeclined
                    ? {
            label: t('equipment_hub.status_declined', 'Declined'),
                        color: 'bg-rose-500/90 text-white border-rose-600',
                        badgeIcon: <AlertTriangle className="w-3 h-3 text-white" />
                      }
                    : isCompleted
                    ? {
            label: t('equipment_hub.status_completed', 'Completed'),
                        color: 'bg-purple-600/90 text-white border-purple-700',
                        badgeIcon: <CheckCircle2 className="w-3 h-3 text-white" />
                      }
                    : isInProgress
                    ? {
            label: t('equipment_hub.status_in_progress', 'In Progress'),
                        color: 'bg-sky-600/90 text-white border-sky-700',
                        badgeIcon: <Truck className="w-3 h-3 text-white animate-pulse" />
                      }
                    : isConfirmed
                    ? {
            label: t('equipment_hub.status_confirmed', 'Confirmed'),
                        color: 'bg-emerald-600/90 text-white border-emerald-700',
                        badgeIcon: <Check className="w-3 h-3 text-white" />
                      }
                    : {
            label: t('equipment_hub.status_pending', 'Pending'),
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
                          {getLocalizedField(b, 'title', currentLang)}
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
                            {b.acres} {t('equipment_hub.acres', 'Acres')}
                          </span>
                        </div>

                        {/* Cancellation / Decline Alert if applicable */}
                        {isCancelled && (
                          <div className="mt-2.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-[11px] flex items-start gap-1.5">
                            <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                            <strong>{t('equipment_hub.cancel_reason_prefix', 'Cancelled: ')}</strong>
                            {b.cancelReason || t('equipment_hub.farmer_request_default', 'Farmer request')}
                            </span>
                          </div>
                        )}

                        {isDeclined && (
                          <div className="mt-2.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-[11px] flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span>{t('equipment_hub.declined_by_provider', 'Declined by provider (Slot unavailable)')}</span>
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
                                      {st.label}
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
                              {t('equipment_hub.estimated_rent', 'Estimated Rent')}
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
                            title={t('equipment_hub.order_chat_tooltip', 'In-App Order Chat & Voice Notes')}
                          >
                            <MessageSquare className="w-3.5 h-3.5 fill-white shrink-0" />
                            <span className="truncate">{t('equipment_hub.message', 'Message')}</span>
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
                            title={t('equipment_hub.call', 'Call')}
                          >
                            <Phone className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">{t('equipment_hub.call', 'Call')}</span>
                          </a>
                        </div>

                        {/* Secondary Context Actions: Cancel, Re-Book, Delete, Farm Khata */}
                        <div className="flex items-center justify-between gap-1.5 pt-1">
                          {(isPending || isConfirmed) && (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalBooking(b);
                                  setCancelReasonKey('weather');
                                  setCustomCancelReason('');
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold transition-all cursor-pointer"
                              >
                                <Ban className="w-3 h-3 text-rose-600" />
                        <span>{t('equipment_hub.cancel_booking', 'Cancel Booking')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteModalBooking(b)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                                title={t('equipment_hub.delete_voucher', 'Delete Voucher')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {(isCompleted || isCancelled || isDeclined) && (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => handleReBook(b)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                        <span>{t('equipment_hub.book_again', 'Book Again')}</span>
                              </button>

                              {isCompleted && (
                                b.syncedToKhata ? (
                                  <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-0.5" title={t('equipment_hub.synced_to_khata_badge', 'Synced to Farm Khata')}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSyncToKhata(b)}
                                    className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer"
                                    title={t('equipment_hub.sync_to_khata_btn', 'Sync to Farm Khata')}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}

                              <button
                                type="button"
                                onClick={() => setDeleteModalBooking(b)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                                title={t('equipment_hub.delete_voucher', 'Delete Voucher')}
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
                {t('equipment_hub.govt_support_sub', 'Government Agri Mechanization Support')}
              </span>
              <h2 className="text-xl sm:text-2xl font-black">
                {t('equipment_hub.govt_chc_head', 'Custom Hiring Centers (CHC) 40% - 50% Subsidized Rentals')}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-50 max-w-2xl leading-relaxed">
                {t('equipment_hub.chc_rbk_desc', 'The Department of Agriculture operates village-level Custom Hiring Centers (CHCs) via Rythu Bharosa Kendrams to provide high-horsepower machinery and spraying drones at standardized, subsidized hiring rates.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                🚜
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {t('equipment_hub.tractor_subsidy_title', 'Tractor & Implement Subsidy (SMAM)')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('equipment_hub.fpo_shg_subsidy_desc', 'FPOs and Farmer Groups receive 40% to 80% capital subsidy under the Sub-Mission on Agricultural Mechanization to purchase CHC fleets.')}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-black">
                🚁
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {t('equipment_hub.drone_subsidy_title', 'Kisan Drone Subsidy (Up to ₹5 Lakh)')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('equipment_hub.drone_grant_desc', 'Subsidies up to 50% (capped at ₹5 Lakhs) for FPOs and agriculture graduates to purchase DGCA-certified agricultural spraying drones.')}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                💧
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {t('equipment_hub.irrigation_subsidy_title', 'APMIP 90% Drip & Sprinkler Subsidy')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('equipment_hub.irrigation_subsidy_desc', '90% subsidy for SC/ST smallholders and 70% for other farmers for drip lines, sprinklers, and solar pumps.')}
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
            onClose={() => setIsBookModalOpen(false)}
            onConfirm={async (newBooking) => {
              // F-04: Stable Idempotency-Key per logical booking submission
              const idempotencyKey = `idemp_create_${newBooking.id || newBooking.bookingId}`;
              try {
                const res = await API.post('/api/v1/equipment/bookings', newBooking, {
                  headers: { 'Idempotency-Key': idempotencyKey }
                });
                const serverBooking = (res?.data && res?.data?.booking) ? res.data.booking : newBooking;
                // Only persist optimistic/local booking state after successful canonical backend creation
                setMyBookings((prev) => deduplicateBookings([serverBooking, ...prev]));
                try {
                  const existing = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
                  const clean = deduplicateBookings([serverBooking, ...existing]);
                  localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(clean));
                  window.dispatchEvent(new Event('agrishield_bookings_updated'));
                } catch (e) {}
                setIsBookModalOpen(false);
                setActiveTab('bookings');
              } catch (err) {
                console.warn('Backend booking sync notice:', err);
                const detail = err?.response?.data?.detail;
      alert(t('equipment_hub.booking_failed_msg', { detail: detail || t('equipment_hub.please_retry', 'Please retry.'), defaultValue: `Booking failed: ${detail || 'Please retry.'}` }));
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 2: LOCATION SWITCHER
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
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
            {t('equipment_hub.select_service_location', 'Select Service Location')}
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
                  <label className="font-bold text-slate-500 block mb-1">{t('equipment_hub.state', 'State')}</label>
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
                  <label className="font-bold text-slate-500 block mb-1">{t('equipment_hub.district', 'District')}</label>
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
                  <label className="font-bold text-slate-500 block mb-1">{t('equipment_hub.mandal', 'Mandal')}</label>
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
                  <label className="font-bold text-slate-500 block mb-1">{t('equipment_hub.village', 'Village')}</label>
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
                      id="manual-village-input"
                      type="text"
                      aria-label={t('equipment_hub.village', 'Village Name')}
                      placeholder={t('equipment_hub.type_village_name', 'Type Village Name')}
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
                  {t('equipment_hub.apply_location', 'Apply Location')}
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
        title={t('equipment_hub.cancel_booking_title', 'Cancel Equipment Booking')}
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
                {t('equipment_hub.cancel_modal_desc', 'Are you sure you want to cancel this equipment booking? The equipment provider will be notified immediately.')}
              </p>
            </div>
          </div>

          {/* Reason Selection Radio Group */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              {t('equipment_hub.select_cancel_reason', 'Select Reason for Cancellation:')}
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
                      <p>{t(reason.key, reason.labelEn)}</p>
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
                {t('equipment_hub.describe_cancel_reason', 'Please describe the reason:')}
              </label>
              <textarea
                rows={2}
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder={t('equipment_hub.cancel_reason_placeholder', 'E.g., Rescheduling with provider, field stage delayed...')}
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
              {t('equipment_hub.keep_booking', 'Keep Booking')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isProcessingAction}
              onClick={handleCancelBooking}
              leftIcon={<Ban className="w-3.5 h-3.5" />}
            >
              {t('equipment_hub.confirm_cancellation', 'Confirm Cancellation')}
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
        title={t('equipment_hub.delete_voucher_title', 'Delete Booking Voucher?')}
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
                {t('equipment_hub.voucher_permanent_del_warn', 'This voucher will be permanently deleted from your passbook record. You will no longer see this voucher.')}
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
              {t('equipment_hub.keep_voucher', 'Keep Voucher')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isProcessingAction}
              onClick={handleDeleteBooking}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {t('equipment_hub.delete_permanently', 'Delete Permanently')}
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
            className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[110] flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-emerald-600/95 text-white shadow-2xl border border-slate-700 dark:border-emerald-500 font-bold text-xs max-w-[calc(100vw-32px)] sm:max-w-sm backdrop-blur-md"
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
        <div className="fixed inset-0 z-[9999] bg-[#f1f3f9] dark:bg-[#0d1117] flex flex-col w-full h-full overflow-hidden animate-fade-in">
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
function BookEquipmentModal({ equipment, activeFarm, user, serviceLocation, isProviderOnline, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [farmerName, setFarmerName] = useState(user?.name || user?.full_name || t('equipment_hub.farmer', 'Farmer'));
  const [farmerPhone, setFarmerPhone] = useState(user?.phone || user?.mobile || '');
  const [farmSector, setFarmSector] = useState(activeFarm?.farm_name || 'My Farm Field 1');
  const [approachRoad, setApproachRoad] = useState('Tractor Accessible Road');

  // Server-backed provider online status (H-3)
  const [providerStatus, setProviderStatus] = useState('unknown');

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      const pId = equipment?.providerId || equipment?.owner_id;
      const pPhone = equipment?.phone || equipment?.contactPhone;
      const q = [];
      if (pId) q.push(`provider_id=${encodeURIComponent(pId)}`);
      if (pPhone) q.push(`phone=${encodeURIComponent(pPhone)}`);
      const url = q.length > 0 ? `/api/v1/equipment/provider/status?${q.join('&')}` : '/api/v1/equipment/provider/status';
      try {
        const res = await API.get(url);
        if (isMounted && res?.data && res.data.is_online !== undefined) {
          setProviderStatus(res.data.is_online ? 'online' : 'offline');
        } else if (isMounted) {
          setProviderStatus('unknown');
        }
      } catch (e) {
        if (isMounted) {
          // On network error or failure: NEVER default to online!
          setProviderStatus('unknown');
        }
      }
    };
    fetchStatus();
    return () => { isMounted = false; };
  }, [equipment?.providerId, equipment?.owner_id, equipment?.phone, equipment?.contactPhone]);

  // ── Land Status & Field Condition Options (Replacing static Target Crop) ──
  const FIELD_STATUS_OPTIONS = useMemo(() => [
    { value: 'Empty Field / Dry Fallow Land', label: t('equipment_hub.land_stage_fallow', '🌱 Empty Field / Dry Fallow Land (Ready for Ploughing)') },
    { value: 'Ploughed Soil / Rough Tilled', label: t('equipment_hub.land_stage_ploughed', '🚜 Ploughed Soil / Rough Tilled (Needs Rotavator/Harrow)') },
    { value: 'Seedbed Ready / Pre-Sowing', label: t('equipment_hub.land_stage_seedbed', '🌾 Seedbed Ready / Pre-Sowing (Bed / Furrows Ready)') },
    { value: 'Planted Field / Young Sprouts', label: t('equipment_hub.land_stage_sprouts', '🌿 Planted Field / Young Sprouts (Weeding / Interculture)') },
    { value: 'Standing Growing Crop Field', label: t('equipment_hub.land_stage_growing', '🌽 Standing / Growing Crop Field (Spraying / Fertilizer)') },
    { value: 'Flowering & Fruiting Stage Field', label: t('equipment_hub.land_stage_flowering', '🍅 Flowering & Fruiting Stage Field (Pest Control)') },
    { value: 'Mature / Ready for Harvest Field', label: t('equipment_hub.land_stage_mature', '🌾 Mature / Ready for Harvest Field (Harvesting)') },
    { value: 'Post-Harvest Stubble Field', label: t('equipment_hub.land_stage_stubble', '🪵 Post-Harvest Stubble Field (Mulcher / Clearing)') },
    { value: 'Paddy Wetland / Muddy Puddle', label: t('equipment_hub.land_stage_paddy', '💧 Paddy Wetland / Muddy Puddle (Cage Wheels Puddling)') },
    { value: 'Orchard / Tree Plantation Field', label: t('equipment_hub.land_stage_orchard', '🌳 Orchard / Tree Plantation (Chilli, Mango, Citrus)') },
  ], [t]);

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
          label: `★ ${imp} (${t('equipment_hub.provider_equipped_attachment', 'Provider Equipped Attachment')})`
        });
      });
    }

    // 2. Comprehensive operations categorized by machine category
    if (isDrone) {
      list.push(
        { value: 'Foliar Spraying (Nano Urea / Micronutrients)', label: t('equipment_hub.drone_op_foliar', 'Foliar Spraying (Nano Urea / Micronutrients)') },
        { value: 'Pesticide & Insecticide Ultra-Low Spraying', label: t('equipment_hub.drone_op_pest', 'Pesticide & Insecticide Ultra-Low Spraying') },
        { value: 'Fungicide Canopy Protection Spray', label: t('equipment_hub.drone_op_orchard', 'Fungicide Canopy Protection Spray') },
        { value: 'Granular Fertilizer / Seed Broadcasting', label: t('equipment_hub.drone_op_preharvest', 'Granular Fertilizer / Seed Broadcasting') },
        { value: 'Multi-Spectral Crop Health & Stress Survey', label: t('equipment_hub.drone_op_survey', 'Multi-Spectral Crop Health & Stress Survey') }
      );
    } else if (isHarvester) {
      list.push(
        { value: 'Paddy Combine Harvesting & Threshing', label: t('equipment_hub.harv_op_paddy', 'Paddy Combine Harvesting & Threshing') },
        { value: 'Maize / Corn Combine Harvesting', label: t('equipment_hub.harv_op_maize', 'Maize / Corn Combine Harvesting') },
        { value: 'Pulse / Groundnut Threshing', label: t('equipment_hub.harv_op_groundnut', 'Pulse / Groundnut Threshing') },
        { value: 'Straw Baling / Residue Collection', label: t('equipment_hub.harv_op_wheat', 'Straw Baling / Residue Collection') }
      );
    } else if (isPump) {
      list.push(
        { value: 'High-Volume Flood Irrigation Pumping', label: t('equipment_hub.irrig_op_flood', 'High-Volume Flood Irrigation Pumping') },
        { value: 'Portable Diesel Engine Field Irrigation', label: t('equipment_hub.irrig_op_diesel', 'Portable Diesel Engine Field Irrigation') },
        { value: 'Drip System Pressurized Fertigation', label: t('equipment_hub.irrig_op_drip', 'Drip System Pressurized Fertigation') },
        { value: 'Farm Pond Dewatering & Transfer', label: t('equipment_hub.irrig_op_pond', 'Farm Pond Dewatering & Transfer') }
      );
    } else {
      // Tractor & Primary/Secondary Tillage Machinery
      list.push(
        { value: 'Rotavator / Secondary Tillage', label: t('equipment_hub.trac_op_rotavator', '🚜 Rotavator / Secondary Tillage') },
        { value: 'Disc Plough / Deep Primary Ploughing', label: t('equipment_hub.trac_op_disc', '🚜 Disc Plough / Deep Primary Ploughing') },
        { value: 'Cultivator 9-Tyne Harrowing & Clod Crushing', label: t('equipment_hub.trac_op_cultivator', '🚜 Cultivator 9-Tyne Harrowing & Clod Crushing') },
        { value: 'Laser Land Leveling', label: t('equipment_hub.trac_op_laser', '🚜 Laser Land Leveling (Precision Grading)') },
        { value: 'Ridges & Furrows Formation', label: t('equipment_hub.trac_op_ridges', '🚜 Ridges & Furrows Formation') },
        { value: 'Automatic Seed Drill Sowing', label: t('equipment_hub.trac_op_seed_drill', '🚜 Automatic Seed Drill Sowing & Fertilization') },
        { value: 'Tractor Trolley / Heavy Haulage', label: t('equipment_hub.trac_op_trolley', '🚜 Tractor Trolley / Heavy Farm Haulage') },
        { value: 'Paddy Wetland Puddling with Cage Wheels', label: t('equipment_hub.trac_op_paddy_wetland', '🚜 Paddy Wetland Puddling with Cage Wheels') },
        { value: 'Subsoiler Hardpan Breaking', label: t('equipment_hub.trac_op_subsoiler', '🚜 Subsoiler Hardpan Breaking') },
        { value: 'Mulcher / Crop Stubble Shredding', label: t('equipment_hub.trac_op_mulcher', '🚜 Mulcher / Crop Stubble Shredding') },
        { value: 'Inter-row Weed Cultivation', label: t('equipment_hub.trac_op_inter_row', '🚜 Inter-row Weed Cultivation') }
      );
    }

    list.push({
      value: 'Other Custom Operation',
      label: t('equipment_hub.op_other', '✏️ Other Custom Operation (Type Note)...')
    });

    return list;
  }, [equipment, t]);

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

    const safeFarmerPhone = farmerPhone || user?.phone || user?.mobile || '';
    const safeProviderPhone = equipment.phone || equipment.contactPhone || '';

    // M-4: Canonical provider resolution. NEVER use equipment.id as providerId.
    const canonicalProviderId = (
      equipment?.providerId ||
      equipment?.owner_id ||
      equipment?.userId ||
      equipment?.provider_id ||
      ''
    );

    if (!canonicalProviderId || String(canonicalProviderId) === String(equipment.id)) {
      toast.error(
        t('equipment_hub.provider_unavailable', 'Provider Unavailable'),
        t('equipment_hub.provider_unavailable_msg', 'This machinery listing is missing a valid provider ID. Booking cannot proceed.')
      );
      return;
    }

    const newBooking = {
      id: bookingId,
      equipmentId: equipment.id,
      providerId: String(canonicalProviderId),
      title: equipment.title,
      equipmentTitle: equipment.title,
      teluguTitle: equipment.teluguTitle,
      category: equipment.category,
      providerName: equipment.providerName || equipment.ownerName || t('equipment_hub.agro_equipment_provider', 'Agro Equipment Provider'),
      providerPhone: safeProviderPhone,
      provider_phone: safeProviderPhone,
      phone: safeFarmerPhone,
      farmerPhone: safeFarmerPhone,
      contactPhone: safeFarmerPhone,
      farmerName: farmerName || user?.name || user?.full_name || t('equipment_hub.farmer', 'Farmer'),
      farmSector,
      fieldStatus,
      targetCrop: fieldStatus,
      crop: fieldStatus,
      approachRoad,
      location: serviceLocation,
      village: serviceLocation?.village || locationVillage || t('equipment_hub.field_location', 'Field Location'),
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
        title: t('equipment_hub.new_booking_received_title', { bookingId, defaultValue: `🚜 New Machinery Booking Received (#${bookingId})` }),
        message: t('equipment_hub.new_booking_received_msg', {
          farmerName: farmerName || t('equipment_hub.farmer', 'Farmer'),
          title: equipment.title,
          date: bookingDate,
          timeSlot: timeSlot,
          defaultValue: `${farmerName || 'Farmer'} requested booking for your ${equipment.title} on ${bookingDate} (${timeSlot}). Please review and accept.`
        }),
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
      const existing = getUserNotificationCache(user);
      setUserNotificationCache(user, [bookingNotif, ...existing.filter(n => n.id !== bookingNotif.id)]);
    } catch (e) {}

    // Dispatch global event for multi-tab provider sync if listening
    window.dispatchEvent(new CustomEvent('agrishield_provider_booking_received', { detail: bookingNotif }));
    window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: bookingNotif }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto"
      >
        {/* Header - Fixed top */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
              {t('equipment_hub.instant_slot_reservation', 'Instant Slot Reservation')}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {equipment.title}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3.5 pt-3">
          {/* ── Live Provider Online / Offline Status Announcement (Server-backed H-3) ── */}
          {providerStatus === 'online' ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
              <div className="relative flex items-center justify-center shrink-0">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black leading-tight">
                  {t('equipment_hub.provider_online', '🟢 Equipment Provider is Online Today')}
                </p>
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium leading-tight mt-0.5">
                  {t('equipment_hub.provider_online_desc', 'Your booking request will be dispatched instantly to the provider.')}
                </p>
              </div>
            </div>
          ) : providerStatus === 'offline' ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-black leading-tight">
                  {t('equipment_hub.provider_offline', '🔴 Equipment Provider is Offline Today')}
                </p>
                <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-medium leading-tight mt-0.5">
                  {t('equipment_hub.provider_offline_desc', 'Booking queued and reviewed once online.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-black leading-tight">
                  {t('equipment_hub.provider_queue', '⚪ Provider Status: In Queue')}
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium leading-tight mt-0.5">
                  {t('equipment_hub.provider_queue_desc', 'Booking request will be submitted to provider queue.')}
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Farmer & Field Details */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('equipment_hub.step1_farmer_info', '1. Farmer & Field Info')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="booking-farmer-name" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">{t('equipment_hub.farmer_name', 'Farmer Name')}</label>
                <input
                  id="booking-farmer-name"
                  type="text"
                  required
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="booking-farmer-phone" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">{t('equipment_hub.whatsapp_phone', 'WhatsApp Phone')}</label>
                <input
                  id="booking-farmer-phone"
                  type="tel"
                  required
                  value={farmerPhone}
                  onChange={(e) => setFarmerPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="booking-service-location" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">{t('equipment_hub.field_village', 'Field Village')}</label>
                <input
                  id="booking-service-location"
                  type="text"
                  disabled
                  value={formatLocationSummary(serviceLocation, t('equipment_hub.location_not_set', 'Location not set'))}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="booking-field-status" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">
                  {t('equipment_hub.land_stage_title', 'Field Condition / Land Stage')}
                </label>
                <select
                  id="booking-field-status"
                  value={fieldStatus}
                  onChange={(e) => setFieldStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
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
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>{t('equipment_hub.step2_date_time', '2. Date & Time Slot')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="booking-service-date" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">{t('equipment_hub.booking_date', 'Booking Date')}</label>
                <input
                  id="booking-service-date"
                  type="date"
                  required
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="booking-time-slot" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">{t('equipment_hub.time_slot', 'Time Slot')}</label>
                <select
                  id="booking-time-slot"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                >
                  <option value="Early Morning (6:00 AM - 10:00 AM)">🌅 Early Morning (6:00 AM - 10:00 AM)</option>
                  <option value="Afternoon (2:00 PM - 6:00 PM)">☀️ Afternoon (2:00 PM - 6:00 PM)</option>
                  <option value="Full Day (8:00 AM - 5:00 PM)">⏰ Full Day (8:00 AM - 5:00 PM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Work Quantity & Specific Operation */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('equipment_hub.step3_scope_options', '3. Work Scope & Options')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="booking-quantity" className="font-bold text-slate-700 dark:text-slate-200 block mb-1 cursor-pointer">
                  {unitMode === 'acres' ? t('equipment_hub.total_acres', 'Total Acres') : t('equipment_hub.operating_hours', 'Operating Hours')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="booking-quantity"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                  />
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUnitMode('acres')}
                      className={`px-3 py-2 font-black text-xs ${unitMode === 'acres' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                    >
                      Acres
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitMode('hours')}
                      className={`px-3 py-2 font-black text-xs ${unitMode === 'hours' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                    >
                      Hours
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  {t('equipment_hub.specific_operation', 'Specific Operation')}
                </label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
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
                    placeholder={t('equipment_hub.type_operation_note', 'Type specific operation note here...')}
                    value={customOperationNote}
                    onChange={(e) => setCustomOperationNote(e.target.value)}
                    className="w-full p-2 mt-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-600 font-bold text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>

            {/* Accessible Touch Checkboxes (>= 44px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 cursor-pointer font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-colors min-h-[44px]">
                <input
                  type="checkbox"
                  checked={includeOperator}
                  onChange={(e) => setIncludeOperator(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="text-xs leading-snug">{t('equipment_hub.driver_included', 'Include Driver / Pilot (Included)')}</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 cursor-pointer font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-colors min-h-[44px]">
                <input
                  type="checkbox"
                  checked={includeDiesel}
                  onChange={(e) => setIncludeDiesel(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="text-xs leading-snug">{t('equipment_hub.owner_provides_fuel', 'Machine Owner provides Fuel')}</span>
              </label>
            </div>
          </div>

          {/* Section 4: Live Cost Calculation Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-bold">
                {baseRate} × {quantity} {unitMode}
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">₹{rawSubtotal}</span>
            </div>

            {!includeDiesel && fuelDiscount > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-600">
                <span>{t('equipment_hub.farmer_fuel_discount', 'Farmer Diesel Supply Discount')}</span>
                <span className="font-bold">- ₹{fuelDiscount}</span>
              </div>
            )}

            <div className="border-t border-emerald-200/80 dark:border-emerald-800 pt-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                  {t('equipment_hub.total_cost_label', 'Total Estimated Cost:')}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {t('equipment_hub.pay_after_work', 'Pay to operator upon field work completion (Cash / UPI)')}
                </span>
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{totalCost}
              </span>
            </div>
          </div>

          {/* Sticky Modal Action Buttons - Always visible and clean on mobile */}
          <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('equipment_hub.cancel_booking_btn', 'Cancel')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{t('equipment_hub.confirm_booking', 'Confirm Rental Booking')}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

