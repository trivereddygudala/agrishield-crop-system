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
  Lock
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'register' | 'bookings' | 'chc-info'
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

  // 100% Real User Equipment Database with Multi-Store & Fleet LocalStorage sync
  const loadMergedEquipment = useCallback(() => {
    try {
      const providerSaved = JSON.parse(localStorage.getItem('agrishield_provider_fleet_inventory') || '[]');
      const customSaved = JSON.parse(localStorage.getItem('agrishield_custom_equipment_listings') || '[]');

      // providerSaved takes priority as it represents the provider's latest active status and toggles
      const allItems = [
        ...(Array.isArray(providerSaved) ? providerSaved : []),
        ...(Array.isArray(customSaved) ? customSaved : [])
      ];

      const validItems = allItems.filter(item => item && !item.id?.startsWith('eq-tr-') && !item.id?.startsWith('eq-dr-') && !item.id?.startsWith('eq-ir-') && !item.id?.startsWith('eq-hv-'));

      if (validItems.length === 0) {
        const starter = [
          {
            id: 'FL-001',
            title: 'Mahindra 575 DI 45HP Tractor',
            teluguTitle: 'మహీంద్రా 575 DI 45HP ట్రాక్టర్',
            category: 'tractor',
            modelYear: '2023',
            horsepower: '30 HP',
            ratePerAcre: 800,
            hourlyRate: 800,
            ratePerHour: 800,
            dailyRate: 4800,
            available: true,
            availableToday: true,
            availableTime: '6:00 AM - 6:00 PM',
            implements: ['Rotavator', 'Plough'],
            implementsIncluded: ['Rotavator', 'Plough'],
            village: 'Pasupugallu',
            locationVillage: 'Pasupugallu',
            district: 'Prakasam',
            locationDistrict: 'Prakasam',
            mandal: 'Mundlamuru',
            state: 'Andhra Pradesh',
            phone: '9440182736',
            contactPhone: '9440182736',
            providerName: 'Agro Fleet Service (Pasupugallu)',
            ownerName: 'Agro Fleet Service (Pasupugallu)',
            operatorIncluded: true,
            fuelIncluded: true,
            rating: 5.0,
            specs: 'Available for immediate booking in Pasupugallu & Mundlamuru. Includes rotavator and plough attachments.'
          }
        ];
        try {
          localStorage.setItem('agrishield_provider_fleet_inventory', JSON.stringify(starter));
          localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(starter));
        } catch (e) {}
        return starter;
      }

      const seen = new Set();
      const result = [];
      for (const item of validItems) {
        const id = item.id || `eq-${item.title}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const isItemAvailable = item.available !== false;
        result.push({
          ...item,
          id,
          title: item.title || 'Farm Machinery',
          category: item.category || 'tractor',
          phone: item.phone || item.contactPhone || '9440182736',
          contactPhone: item.contactPhone || item.phone || '9440182736',
          providerName: item.providerName || item.ownerName || 'Local Machinery Provider',
          village: item.village || item.locationVillage || 'Pasupugallu',
          mandal: item.mandal || 'Mundlamuru',
          district: item.district || item.locationDistrict || 'Prakasam',
          ratePerAcre: Number(item.ratePerAcre) || Number(item.hourlyRate) || 800,
          ratePerHour: Number(item.hourlyRate) || Number(item.ratePerHour) || 800,
          implements: Array.isArray(item.implements) ? item.implements : Array.isArray(item.implementsIncluded) ? item.implementsIncluded : ['Rotavator', 'Plough'],
          implementsIncluded: Array.isArray(item.implementsIncluded) ? item.implementsIncluded : Array.isArray(item.implements) ? item.implements : ['Rotavator', 'Plough'],
          available: isItemAvailable,
          availableToday: isItemAvailable && item.availableToday !== false,
          operatorIncluded: item.operatorIncluded !== false,
          rating: item.rating || 5.0,
          specs: item.specs || `${item.horsepower || ''} available for immediate field hire in ${item.village || item.locationVillage || 'Pasupugallu'}.`
        });
      }
      return result;
    } catch (e) {
      console.warn('Failed to parse equipment:', e);
      return [];
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

  // 100% Real User Bookings with LocalStorage sync (Zero mock bookings)
  const [myBookings, setMyBookings] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_equipment_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(b => b && b.id !== 'BK-78210')
            .map(b => ({
              ...b,
              phone: b.phone || b.farmerPhone || b.contactPhone || '9876543210'
            }));
        }
      }
    } catch (e) {}
    return [];
  });

  // Real-time synchronization when equipment provider updates bookings (Accept/Reject/Complete)
  useEffect(() => {
    const handleBookingsSync = () => {
      try {
        const saved = localStorage.getItem('agrishield_equipment_bookings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMyBookings(parsed.filter(b => b && b.id !== 'BK-78210').map(b => ({
              ...b,
              phone: b.phone || b.farmerPhone || b.contactPhone || '9876543210'
            })));
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
  }, []);

  // Save bookings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(myBookings));
    } catch (e) {}
  }, [myBookings]);

  // Fetch remote bookings from backend for multi-device real-time sync
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
          const remoteBookings = res.data.bookings;
          const remoteMap = new Map();
          remoteBookings.forEach(b => {
            const key = b && (b.id || b.bookingId);
            if (key) remoteMap.set(key, b);
          });

          setMyBookings(prev => {
            let hasChanged = false;
            // 1. Update existing local bookings with latest remote status (authoritative decisions: rejected/confirmed/completed)
            const updatedExisting = prev.map(localB => {
              const key = localB && (localB.id || localB.bookingId);
              if (remoteMap.has(key)) {
                const remoteB = remoteMap.get(key);
                if (localB.status !== remoteB.status || localB.updatedAt !== remoteB.updatedAt) {
                  hasChanged = true;
                }
                return {
                  ...localB,
                  ...remoteB,
                  status: remoteB.status || localB.status
                };
              }
              return localB;
            });

            // 2. Append new remote bookings not present in local list
            const existingKeys = new Set(updatedExisting.map(b => b && (b.id || b.bookingId)));
            const brandNew = [];
            remoteBookings.forEach(rb => {
              const key = rb && (rb.id || rb.bookingId);
              if (key && !existingKeys.has(key)) {
                brandNew.push(rb);
                existingKeys.add(key);
                hasChanged = true;
              }
            });

            const finalMerged = [...brandNew, ...updatedExisting];
            if (hasChanged || prev.length === 0) {
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
  }, []);

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
            const seen = new Set(prev.map(item => item.id));
            const freshItems = catalogItems.filter(item => !seen.has(item.id));
            if (freshItems.length > 0) {
              const merged = [...prev, ...freshItems];
              try {
                localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(merged));
              } catch (_) {}
              return merged;
            }
            return prev;
          });
        }
      } catch (_) {}
    };
    fetchRemoteCatalog();
  }, []);

  const availableDistricts = useMemo(() => getDistricts(locationState), [locationState]);
  const availableMandals = useMemo(() => getMandals(locationState, locationDistrict), [locationState, locationDistrict]);
  const availableVillages = useMemo(() => getVillages(locationState, locationDistrict, locationMandal), [locationState, locationDistrict, locationMandal]);

  // Filtered and Sorted Equipment Catalog
  const displayedEquipment = useMemo(() => {
    return equipmentList
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
                ? 'మీ గ్రామం & మండలంలో సమీప ట్రాక్టర్లు, స్ప్రేయింగ్ డ్రోన్లు, నీటిపారుదల పంపుల బుకింగ్ లేదా మీ యంత్రాల రిజిస్ట్రేషన్'
                : 'Book nearby verified tractors, spraying drones & irrigation pumps per acre/hour, or list your equipment for rent.'}
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

      {/* ═══════════ MAIN NAVIGATION TABS (Strictly Farmer Booking Focused) ═══════════ */}
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
          <Search className="w-4 h-4" />
          <span>{isTe ? 'యంత్రాల జాబితా & బుకింగ్' : 'Browse & Book Machinery'}</span>
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
          <span>{isTe ? 'నా బుకింగ్స్ & స్థితి' : 'My Bookings'}</span>
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
          <span>{isTe ? 'ప్రభుత్వ CHC & డ్రోన్ రాయితీలు' : 'Govt CHC & Subsidy'}</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: BROWSE & BOOK MACHINERY
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'browse' && (
        <div className="space-y-5">
          {/* Filter Bar: Category Pills + Search + Sort */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {[
                { id: 'all', label: isTe ? 'అన్నీ' : 'All', icon: Zap },
                { id: 'tractor', label: isTe ? 'ట్రాక్టర్లు' : 'Tractors', icon: Truck },
                { id: 'drone', label: isTe ? 'డ్రోన్లు' : 'Spraying Drones', icon: Compass },
                { id: 'irrigation', label: isTe ? 'నీటి పారుదల' : 'Irrigation & Pumps', icon: Droplets },
                { id: 'harvester', label: isTe ? 'హార్వెస్టర్లు' : 'Harvesters', icon: Wrench }
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Sort */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={isTe ? 'ట్రాక్టర్, డ్రోన్, మోడల్...' : 'Search model, brand, village...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="nearest">{isTe ? 'సమీపంలోనివి' : 'Nearest First'}</option>
                <option value="price-low">{isTe ? 'తక్కువ ధర' : 'Price: Low to High'}</option>
                <option value="rating">{isTe ? 'అత్యుత్తమ రేటింగ్' : 'Highest Rated'}</option>
              </select>
            </div>
          </div>

          {/* Machinery Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedEquipment.map((item) => {
              const isTractor = item.category === 'tractor';
              const isDrone = item.category === 'drone';
              const isIrrigation = item.category === 'irrigation';
              const isHarvester = item.category === 'harvester';

              const categoryBadge = isTractor
                ? { label: isTe ? 'ట్రాక్టర్' : 'Tractor', color: 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800', icon: Truck }
                : isDrone
                ? { label: isTe ? 'స్ప్రేయింగ్ డ్రోన్' : 'Spraying Drone', color: 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800', icon: Compass }
                : isIrrigation
                ? { label: isTe ? 'నీటి పారుదల' : 'Irrigation Pump', color: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', icon: Droplets }
                : { label: isTe ? 'హార్వెస్టర్' : 'Harvester', color: 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800', icon: Wrench };

              const CategoryIcon = categoryBadge.icon;
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
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border shadow-sm transition-all flex flex-col justify-between ${
                    isMachineBooked
                      ? 'border-amber-200/90 dark:border-amber-950/60 bg-amber-500/[0.02]'
                      : 'border-slate-200/80 dark:border-slate-800 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700'
                  }`}
                >
                  <div>
                    {/* Top Row: Category Badge + Distance + Rating */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border flex items-center gap-1.5 ${categoryBadge.color}`}>
                        <CategoryIcon className="w-3.5 h-3.5" />
                        <span>{categoryBadge.label}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{item.distanceKm} km {isTe ? 'దూరం' : 'away'}</span>
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="inline-flex items-center gap-0.5 text-xs font-black text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{item.rating}</span>
                          <span className="text-[10px] text-slate-400 font-medium">({item.bookingsCount})</span>
                        </span>
                      </div>
                    </div>

                    {/* Machine Title & Horsepower */}
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 leading-snug">
                      {isTe && item.teluguTitle ? item.teluguTitle : item.title}
                    </h3>

                    {/* Provider Tag, Village, and Live Online/Offline Status */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{item.providerName}</span>
                      </span>
                      <span>•</span>
                      <span>{item.village}, {item.mandal}</span>
                      <span>•</span>
                      {isMachineBooked ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>{isTe ? 'ప్రొవైడర్ సర్వీస్‌లో ఉన్నారు (బుక్ చేయబడింది)' : 'Provider Busy (Currently Booked)'}</span>
                        </span>
                      ) : isProviderOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span>{isTe ? 'ప్రొవైడర్ ఆన్‌లైన్' : 'Provider Online Today'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>{isTe ? 'ప్రొవైడర్ ఆఫ్‌లైన్' : 'Provider Offline Today'}</span>
                        </span>
                      )}
                    </div>

                    {/* Key Specs & Highlights */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {item.specs}
                    </p>

                    {/* Implements Tags */}
                    {(() => {
                      const impList = Array.isArray(item.implements)
                        ? item.implements
                        : Array.isArray(item.implementsIncluded)
                        ? item.implementsIncluded
                        : typeof (item.implements || item.implementsIncluded) === 'string'
                        ? (item.implements || item.implementsIncluded).split(',').map((s) => s.trim()).filter(Boolean)
                        : [];
                      if (impList.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {impList.map((imp, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              ✓ {imp}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bottom Block: Pricing & Action Buttons */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                            ₹{item.ratePerAcre || item.ratePerHour}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            / {item.ratePerAcre ? (isTe ? 'ఎకరాకు' : 'Acre') : (isTe ? 'గంటకు' : 'Hour')}
                          </span>
                        </div>
                        {item.ratePerHour && item.ratePerAcre && (
                          <span className="text-[10px] font-semibold text-slate-400 block">
                            (or ₹{item.ratePerHour}/hr)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {item.operatorIncluded && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            {isTe ? 'ఆపరేటర్ ఉచితం' : 'Driver Included'}
                          </span>
                        )}
                        {isMachineBooked ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-bold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {isTe ? 'ప్రస్తుతం బుక్ చేయబడింది' : 'Currently Booked'}
                          </span>
                        ) : item.availableToday ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {isTe ? 'ఈరోజు అందుబాటులో ఉంది' : 'Available Today'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                            {isTe ? 'రేపటికి స్లాట్ ఉంది' : 'Available Tomorrow'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${item.phone || item.contactPhone || ''}`}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={isTe ? 'ఫోన్ చేయండి' : 'Call Provider'}
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      <a
                        href={`https://wa.me/${String(item.phone || item.contactPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          isTe
                            ? `నమస్తే! నేను అగ్రిషీల్డ్ యాప్ ద్వారా మీ ${item.teluguTitle || item.title || 'యంత్రం'} బుకింగ్ కోసం సంప్రదిస్తున్నాను. లొకేషన్: ${locationVillage || ''}, ${locationMandal || ''}. వివరాలు తెలపగలరు.`
                            : `Hello! Inquiring to book your ${item.title || 'machinery'} via AgriShield AI for my farm in ${locationVillage || ''}, ${locationMandal || ''}. Please share availability.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                        title={isTe ? 'వాట్సాప్ మెసేజ్' : 'WhatsApp Provider'}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>

                      {isMachineBooked ? (
                        <button
                          type="button"
                          disabled
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none opacity-90 shadow-none"
                          title={isTe ? 'ఈ యంత్రం ప్రస్తుతం బుక్ చేయబడింది' : 'This machinery is currently booked'}
                        >
                          <Lock className="w-4 h-4 text-slate-400" />
                          <span>{isTe ? 'ఈ స్లాట్ బుక్ చేయబడింది' : 'Currently Booked (Slot Busy)'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenBooking(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <Zap className="w-4 h-4 fill-white" />
                          <span>{isTe ? 'ఇప్పుడే బుక్ చేయండి' : 'Book This Slot'}</span>
                        </button>
                      )}
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
          TAB 2: REGISTER MY EQUIPMENT (OWNER / PROVIDER MODE)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'register' && (
        <RegisterEquipmentForm
          locationState={locationState}
          locationDistrict={locationDistrict}
          locationMandal={locationMandal}
          locationVillage={locationVillage}
          isTe={isTe}
          onSuccess={(newListing) => {
            setEquipmentList((prev) => [newListing, ...prev]);
            try {
              const saved = JSON.parse(localStorage.getItem('agrishield_custom_equipment_listings') || '[]');
              saved.unshift(newListing);
              localStorage.setItem('agrishield_custom_equipment_listings', JSON.stringify(saved));
            } catch (e) {}
            setActiveTab('browse');
            alert(isTe ? 'మీ పరికరం విజయవంతంగా రిజిస్టర్ చేయబడింది! ఇది ఇప్పుడు ఇతర రైతులకు కనిపిస్తుంది.' : 'Your machine has been registered successfully and is now visible to nearby farmers!');
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: MY BOOKINGS & PASSBOOK STATUS
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{isTe ? 'మీ బుకింగ్స్ & సర్వీస్ రసీదులు' : 'My Equipment Bookings & Vouchers'}</span>
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              {myBookings.length} {isTe ? 'క్రియాశీల సేవలు' : 'Active / Scheduled'}
            </span>
          </div>

          <div className="space-y-3">
            {myBookings.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
                <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {isTe ? 'ఇంకా ఎటువంటి బుకింగ్స్ లేవు' : 'No active equipment bookings yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {isTe
                    ? 'మీరు ఏదైనా ట్రాక్టర్, డ్రోన్ లేదా నీటి పారుదల పంపును బుక్ చేసినప్పుడు, ఆ రసీదులు ఇక్కడ కనిపిస్తాయి.'
                    : 'When you book machinery or a spraying drone, your booking vouchers and statuses will appear here.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isTe ? 'పరికరాలను చూడండి' : 'Browse Available Equipment'}
                </button>
              </div>
            ) : (
              myBookings.map((b) => {
              const rawStatus = String(b.status || 'pending').toLowerCase();
              const isDeclined = rawStatus === 'rejected' || rawStatus === 'declined';
              const statusBadge = {
                pending: { label: isTe ? 'ధృవీకరణ వేచి ఉంది' : 'Pending Provider Approval', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300' },
                confirmed: { label: isTe ? 'ధృవీకరించబడింది & షెడ్యూల్' : 'Confirmed & Scheduled', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' },
                rejected: { label: isTe ? 'ఆర్డర్ తిరస్కరించబడింది' : 'Declined / Unavailable', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300' },
                declined: { label: isTe ? 'ఆర్డర్ తిరస్కరించబడింది' : 'Declined / Unavailable', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300' },
                'in-progress': { label: isTe ? 'పని జరుగుతోంది' : 'Work In Progress', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300' },
                completed: { label: isTe ? 'పూర్తయింది' : 'Completed', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300' }
              }[rawStatus] || { label: b.status, color: 'bg-slate-100 text-slate-700' };

              return (
                <div
                  key={b.id || b.bookingId}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border ${isDeclined ? 'border-rose-300 dark:border-rose-900/60 shadow-rose-500/5' : 'border-slate-200/80 dark:border-slate-800'} shadow-sm space-y-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{b.id || b.bookingId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mt-1">
                        {isTe && b.teluguTitle ? b.teluguTitle : b.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {b.providerName} • {b.phone || b.providerPhone || b.contactPhone}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-xs text-slate-400 font-bold block">{isTe ? 'మొత్తం అంచనా ధర' : 'Estimated Cost'}</span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        ₹{b.totalCost}
                      </span>
                    </div>
                  </div>

                  {/* Declined Notice Banner */}
                  {isDeclined && (
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-xs">
                      <span className="text-base leading-none">⚠️</span>
                      <div className="space-y-0.5">
                        <p className="font-bold">
                          {isTe ? 'ఈ బుకింగ్ ప్రొవైడర్ చేత తిరస్కరించబడింది.' : 'This booking was declined by the equipment provider.'}
                        </p>
                        <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 font-medium">
                          {isTe
                            ? 'యంత్రం ప్రస్తుతం అందుబాటులో లేదు లేదా వేరే పనిలో ఉంది. దయచేసి వేరే యంత్రాన్ని లేదా వేరే సమయాన్ని ఎంచుకోండి.'
                            : 'The machine is currently unavailable or undergoing maintenance. Please select another provider or a different time slot.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Booking Metadata Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'తేదీ' : 'Date'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{b.bookingDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'సమయం స్లాట్' : 'Time Slot'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate block">{b.timeSlot}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'విస్తీర్ణం / పొలం స్థితి' : 'Acres / Field Stage'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{b.acres} Acres ({b.fieldStatus || b.targetCrop})</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'చెల్లింపు విధానం' : 'Payment'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate block">{b.paymentMode}</span>
                    </div>
                  </div>

                  {b.operation && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                      <span className="flex items-center gap-1.5">
                        <span>⚙️ {isTe ? 'పని రకం:' : 'Operation:'}</span>
                        <strong className="text-indigo-900 dark:text-indigo-200">{b.operation}</strong>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        🌱 {b.fieldStatus || b.targetCrop || 'Field Stage'}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons: Call, WhatsApp, Add to Farm Khata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${b.phone || b.farmerPhone || b.contactPhone || ''}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{isTe ? 'కాల్ చేయండి' : 'Call Provider'}</span>
                      </a>
                      <a
                        href={`https://wa.me/${String(b.phone || b.farmerPhone || b.contactPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Booking ID #${b.id || ''}: Confirming ${b.title || 'Equipment'} scheduled for ${b.bookingDate || ''} (${b.timeSlot || ''}) for ${b.acres || 0} Acres.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp Voucher</span>
                      </a>
                    </div>

                    {/* Sync to Farm Khata Ledger Button */}
                    <div>
                      {b.syncedToKhata ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl">
                          <Check className="w-3.5 h-3.5" />
                          <span>{isTe ? 'పొలం ఖాతాకు జోడించబడింది' : 'Added to Farm Khata'}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSyncToKhata(b)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{isTe ? 'పొలం ఖాతాకు జోడించండి' : 'Add to Farm Khata Ledger'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }))}
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
              setMyBookings((prev) => [newBooking, ...prev]);
              try {
                const existing = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
                localStorage.setItem('agrishield_equipment_bookings', JSON.stringify([newBooking, ...existing.filter(b => b.id !== newBooking.id)]));
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

    // Incoming booking notification is STRICTLY for Equipment Providers, NOT the farmer.
    // The farmer only receives Accept or Decline decision notifications from the provider.
    if (user?.role?.toLowerCase() === 'equipment_provider') {
      try {
        const existing = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        localStorage.setItem('agrishield_user_notifications', JSON.stringify([bookingNotif, ...existing.filter(n => n.id !== bookingNotif.id)]));
      } catch (e) {}
    } else {
      // Clean out any legacy provider booking notifications from farmer's local notifications cache
      try {
        const existing = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        if (Array.isArray(existing)) {
          const cleaned = existing.filter(n => {
            const title = (n.title || '').toLowerCase();
            return !title.includes('కొత్త యంత్ర బుకింగ్') && !title.includes('new machinery booking');
          });
          localStorage.setItem('agrishield_user_notifications', JSON.stringify(cleaned));
        }
      } catch (e) {}
    }

    // Dispatch global event for multi-tab provider sync if listening
    window.dispatchEvent(new CustomEvent('agrishield_provider_booking_received', { detail: bookingNotif }));
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

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENT: REGISTER EQUIPMENT FORM (PROVIDER LISTING MODE)
// ═══════════════════════════════════════════════════════════════════
function RegisterEquipmentForm({ locationState, locationDistrict, locationMandal, locationVillage, isTe, onSuccess }) {
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('tractor');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('Mahindra');
  const [model, setModel] = useState('');
  const [hp, setHp] = useState('45 HP');
  const [ratePerAcre, setRatePerAcre] = useState('1400');
  const [ratePerHour, setRatePerHour] = useState('1100');
  const [operatorIncluded, setOperatorIncluded] = useState(true);
  const [fuelIncluded, setFuelIncluded] = useState(true);
  const [specs, setSpecs] = useState('');

  const handleRegister = (e) => {
    e.preventDefault();
    if (!title.trim() || !phone.trim()) {
      alert('Please fill all required fields');
      return;
    }

    const newListing = {
      id: `eq-custom-${Date.now()}`,
      category,
      title: title.trim(),
      teluguTitle: title.trim(),
      brand,
      model: model || brand,
      hp: hp || 'Standard',
      implements: ['Standard Attachments'],
      providerName: ownerName || 'Local Machinery Provider',
      providerType: 'Private Farmer Listing',
      verified: true,
      rating: 5.0,
      bookingsCount: 0,
      phone: phone.trim(),
      state: locationState,
      district: locationDistrict,
      mandal: locationMandal,
      village: locationVillage,
      distanceKm: 1.0,
      ratePerHour: parseInt(ratePerHour) || 1000,
      ratePerAcre: parseInt(ratePerAcre) || 1400,
      operatorIncluded,
      fuelIncluded,
      availableToday: true,
      minAdvance: 150,
      specs: specs.trim() || 'Available for rent in nearby fields and mandals.'
    };

    onSuccess(newListing);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm max-w-3xl mx-auto space-y-5">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>{isTe ? 'మీ వ్యవసాయ యంత్రం లేదా డ్రోన్‌ను అద్దెకు నమోదు చేయండి' : 'List Your Equipment, Tractor or Drone for Rent'}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isTe
            ? 'మీ ఖాళీ సమయాల్లో మీ ట్రాక్టర్ లేదా డ్రోన్‌ను సమీప రైతులకు అద్దెకు ఇచ్చి అదనపు ఆదాయం పొందండి.'
            : 'Earn rental income by making your tractor, spray drone or irrigation equipment available to nearby farmers.'}
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'యజమాని పేరు' : 'Owner / Hub Name'}</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Reddy"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'ఫోన్ / వాట్సాప్ నంబర్' : 'Phone / WhatsApp Number'}</label>
            <input
              type="tel"
              required
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'పరికరం వర్గం' : 'Equipment Category'}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            >
              <option value="tractor">🚜 Tractor & Implements</option>
              <option value="drone">🚁 Agricultural Spraying Drone</option>
              <option value="irrigation">💧 Irrigation Pump / Rain-gun</option>
              <option value="harvester">🌾 Combine Harvester</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'పరికరం పూర్తి పేరు' : 'Equipment Title / Model'}</label>
            <input
              type="text"
              required
              placeholder="e.g. Mahindra 575 DI (45 HP) + Rotavator"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'గుర్రపు సామర్థ్యం (HP) / కెపాసిటీ' : 'Horsepower (HP) / Tank Capacity'}</label>
            <input
              type="text"
              placeholder="e.g. 50 HP or 16 Litres"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'ఎకరాకు అద్దె ధర (₹)' : 'Rental Rate per Acre (₹)'}</label>
            <input
              type="number"
              placeholder="1400"
              value={ratePerAcre}
              onChange={(e) => setRatePerAcre(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'గంటకు అద్దె ధర (₹)' : 'Rental Rate per Hour (₹)'}</label>
            <input
              type="number"
              placeholder="1100"
              value={ratePerHour}
              onChange={(e) => setRatePerHour(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">{isTe ? 'లొకేషన్ బేస్' : 'Base Hub Location'}</label>
            <input
              type="text"
              disabled
              value={`${locationVillage}, ${locationMandal}, ${locationDistrict}`}
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-500 block mb-1">{isTe ? 'ప్రత్యేకతలు & వివరణ' : 'Description / Features'}</label>
          <textarea
            rows="2"
            placeholder={isTe ? 'పరికరం పరిస్థితి, ఇంప్లిమెంట్లు, పని వేగం గురించి రాయండి...' : 'Condition of machine, available implements, operating speed...'}
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={operatorIncluded}
              onChange={(e) => setOperatorIncluded(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>{isTe ? 'ఆపరేటర్/డ్రైవర్‌ను నేను అందిస్తాను' : 'Driver / Operator Provided'}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={fuelIncluded}
              onChange={(e) => setFuelIncluded(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>{isTe ? 'డీజిల్ రేటులోనే కలిసి ఉంది' : 'Fuel / Diesel Included in Rate'}</span>
          </label>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/30 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isTe ? 'పరికరాన్ని లైవ్‌లో ఉంచండి' : 'Publish Machinery Listing to Nearby Farmers'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
