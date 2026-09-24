import React, { useState, useEffect, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import {
  INDIA_STATES,
  getDistricts,
  getMandals,
  getVillages,
  getCoordinatesForLocation
} from '../data/indiaLocations';

// ═══════════════════════════════════════════════════════════════════
// INITIAL VERIFIED SEED EQUIPMENT DATA (Prakasam, Guntur & AP Hubs)
// ═══════════════════════════════════════════════════════════════════
const INITIAL_EQUIPMENT_CATALOG = [
  // ─── TRACTORS & HEAVY IMPLEMENTS ───
  {
    id: 'eq-tr-01',
    category: 'tractor',
    title: 'Mahindra 575 DI (45 HP) + 7ft Heavy Rotavator',
    teluguTitle: 'మహీంద్రా 575 DI (45 HP) + 7 అడుగుల రొటవేటర్',
    brand: 'Mahindra',
    model: '575 DI Sarpanch',
    hp: '45 HP',
    implements: ['7-ft Rotavator', 'MB Plough', 'Cultivator'],
    providerName: 'Sri Rama Rythu Seva CHC',
    providerType: 'RBK Custom Hiring Center',
    verified: true,
    rating: 4.9,
    bookingsCount: 38,
    phone: '+919440182736',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Mundlamuru',
    village: 'Mundlamuru',
    distanceKm: 2.8,
    ratePerHour: 1100,
    ratePerAcre: 1450,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 200,
    specs: 'Dual-clutch PTO, ideal for wet & dry secondary tillage. 1.2 acres/hour.'
  },
  {
    id: 'eq-tr-02',
    category: 'tractor',
    title: 'John Deere 5050 D (50 HP) + Laser Land Leveler',
    teluguTitle: 'జాన్ డీర్ 5050 D (50 HP) + లేజర్ ల్యాండ్ లెవెలర్',
    brand: 'John Deere',
    model: '5050 D GearPro',
    hp: '50 HP',
    implements: ['Laser Guided Scraper', 'Disc Harrow'],
    providerName: 'Venkateswara Agri Mechanization',
    providerType: 'Private Progressive Farmer',
    verified: true,
    rating: 4.85,
    bookingsCount: 26,
    phone: '+919848291044',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Addanki',
    village: 'Addanki',
    distanceKm: 7.5,
    ratePerHour: 1300,
    ratePerAcre: 1650,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 300,
    specs: 'High precision GPS transmitter, saves 25% irrigation water by perfect grade leveling.'
  },
  {
    id: 'eq-tr-03',
    category: 'tractor',
    title: 'Sonalika Tiger DI 55 (55 HP) + Seed cum Fertilizer Drill',
    teluguTitle: 'సోనాలికా టైగర్ 55 HP + విత్తన & ఎరువుల డ్రిల్',
    brand: 'Sonalika',
    model: 'Tiger DI 55 HDM',
    hp: '55 HP',
    implements: ['Automatic Seed-Fertilizer Drill', '9-Tyne Cultivator'],
    providerName: 'Pasupugallu Community Machinery Pool',
    providerType: 'Village Farmers Association',
    verified: true,
    rating: 4.95,
    bookingsCount: 45,
    phone: '+919701482911',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Mundlamuru',
    village: 'Pasupugallu',
    distanceKm: 0.6,
    ratePerHour: 1050,
    ratePerAcre: 1350,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 150,
    specs: 'Precise seed spacing for Bengal gram, Groundnut & Maize. Sows 2 acres in 1.5 hours.'
  },
  {
    id: 'eq-tr-04',
    category: 'tractor',
    title: 'Kubota MU4501 4WD + Reversible Hydraulic Plough',
    teluguTitle: 'కుబోటా MU4501 4WD + హైడ్రాలిక్ నాగలి',
    brand: 'Kubota',
    model: 'MU4501 4WD',
    hp: '45 HP',
    implements: ['2-Bottom Reversible MB Plough'],
    providerName: 'Darsi Agri Equipment Rentals',
    providerType: 'Private Service Provider',
    verified: true,
    rating: 4.75,
    bookingsCount: 19,
    phone: '+919989301284',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Podili',
    village: 'Podili',
    distanceKm: 14.0,
    ratePerHour: 1200,
    ratePerAcre: 1500,
    operatorIncluded: true,
    fuelIncluded: false,
    availableToday: false,
    minAdvance: 250,
    specs: 'Deep summer ploughing up to 12 inches to eradicate subterranean weed seeds and pupae.'
  },

  // ─── AGRICULTURAL SPRAYING DRONES ───
  {
    id: 'eq-dr-01',
    category: 'drone',
    title: 'DJI Agras T30 (30-Litre Smart Spraying Drone)',
    teluguTitle: 'DJI Agras T30 (30 లీటర్ల హై-స్పీడ్ డ్రోన్ స్ప్రేయర్)',
    brand: 'DJI Agriculture',
    model: 'Agras T30 Octocopter',
    hp: '30 Litre Tank',
    implements: ['16 Centrifugal Atomizer Nozzles', 'Obstacle Radar'],
    providerName: 'Prakasam Kisan Drone Squadron',
    providerType: 'DGCA Certified Drone Pilot Unit',
    verified: true,
    rating: 4.96,
    bookingsCount: 64,
    phone: '+919866192840',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Mundlamuru',
    village: 'Purimetla',
    distanceKm: 3.5,
    ratePerHour: 1600,
    ratePerAcre: 550,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 200,
    specs: 'Sprays 1 acre in 6 minutes! 90% water reduction. Zero chemical inhalation for farmers.'
  },
  {
    id: 'eq-dr-02',
    category: 'drone',
    title: 'Garuda Kisan Drone (16-Litre Nano-Urea & Micro-Nutrient)',
    teluguTitle: 'గరుడ కిసాన్ డ్రోన్ (16 లీటర్ల నానో-యూరియా స్ప్రేయర్)',
    brand: 'Garuda Aerospace',
    model: 'Kisan Drone 16L',
    hp: '16 Litre Tank',
    implements: ['Electrostatic Mist Nozzles', 'Terrain Sensor'],
    providerName: 'Addanki Rythu Drone Seva',
    providerType: 'FPO Drone Service Partner',
    verified: true,
    rating: 4.88,
    bookingsCount: 41,
    phone: '+919391048271',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Addanki',
    village: 'Addanki',
    distanceKm: 8.0,
    ratePerHour: 1400,
    ratePerAcre: 480,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 150,
    specs: 'Specialized for Chilli, Tomato & Cotton foliar spray. Penetrates dense crop under-canopy.'
  },
  {
    id: 'eq-dr-03',
    category: 'drone',
    title: 'IoTechWorld Agribot (10-Litre Ultra-Lightweight)',
    teluguTitle: 'అగ్రిబాట్ 10 లీటర్ల తేలికపాటి డ్రోన్',
    brand: 'IoTechWorld',
    model: 'Agribot 10L',
    hp: '10 Litre Tank',
    implements: ['4 Micron Sprayers', 'GPS Geo-Fence'],
    providerName: 'Ongole Smart Agri Drones',
    providerType: 'Certified Agri Aviators',
    verified: true,
    rating: 4.78,
    bookingsCount: 22,
    phone: '+919177284901',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Ongole',
    village: 'Ongole',
    distanceKm: 28.0,
    ratePerHour: 1200,
    ratePerAcre: 420,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: false,
    minAdvance: 100,
    specs: 'Fast deployment for small landholders. Rapid fungicide and pesticide intervention.'
  },

  // ─── IRRIGATION FACILITIES & WATER PUMPS ───
  {
    id: 'eq-ir-01',
    category: 'irrigation',
    title: 'Kirloskar 7.5 HP Mobile Diesel Water Pump + 150m Hose',
    teluguTitle: 'కిర్లోస్కర్ 7.5 HP డీజిల్ వాటర్ పంపు + 150 మీటర్ల పైప్',
    brand: 'Kirloskar',
    model: 'MegaFlow 7.5 HP',
    hp: '7.5 HP',
    implements: ['150m Heavy-Duty Delivery Hose', 'Foot-Valve Strainer'],
    providerName: 'Mundlamuru Jal Seva Unit',
    providerType: 'Custom Hiring Center',
    verified: true,
    rating: 4.9,
    bookingsCount: 52,
    phone: '+919490182749',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Mundlamuru',
    village: 'Mundlamuru',
    distanceKm: 3.1,
    ratePerHour: 320,
    ratePerAcre: 850,
    operatorIncluded: true,
    fuelIncluded: false,
    availableToday: true,
    minAdvance: 100,
    specs: 'Discharge 45,000 Litres/Hour. Floods 1 acre in 2.5 hours from canal, pond, or open well.'
  },
  {
    id: 'eq-ir-02',
    category: 'irrigation',
    title: 'Mobile Solar Pumping Trolley (5 HP Submersible + 3kW PV Cart)',
    teluguTitle: 'మొబైల్ సోలార్ పంపింగ్ ట్రాలీ (5 HP + 3kW సోలార్ కార్ట్)',
    brand: 'Tata Solar / Shakti',
    model: 'Helios 5HP Cart',
    hp: '5 HP Solar',
    implements: ['Solar PV Array on Wheels', 'VFD Pump Controller'],
    providerName: 'GreenSun Mobile Solar Irrigation',
    providerType: 'Clean Energy Agri Rental',
    verified: true,
    rating: 4.98,
    bookingsCount: 31,
    phone: '+919849201948',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Mundlamuru',
    village: 'Pasupugallu',
    distanceKm: 0.9,
    ratePerHour: 240,
    ratePerAcre: 650,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 100,
    specs: 'Zero fuel cost! Operates on sunlight. Perfect for fields without electric 3-phase grid.'
  },
  {
    id: 'eq-ir-03',
    category: 'irrigation',
    title: 'Portable High-Pressure Rain-Gun Sprinkler Rig (40m Radius)',
    teluguTitle: 'హై-ప్రెజర్ రెయిన్-గన్ స్ప్రింక్లర్ సెట్ (40 మీటర్ల వ్యాసార్థం)',
    brand: 'Jain Irrigation',
    model: 'Skipper Rain-Gun 40M',
    hp: '40m Jet Throw',
    implements: ['Tripod Stand', 'Quick-Connect Couplers', '100m Delivery Hose'],
    providerName: 'Addanki Micro-Irrigation Rentals',
    providerType: 'Authorized Equipment Dealer',
    verified: true,
    rating: 4.82,
    bookingsCount: 18,
    phone: '+919704291840',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Addanki',
    village: 'Addanki',
    distanceKm: 8.4,
    ratePerHour: 380,
    ratePerAcre: 950,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 200,
    specs: 'Simulates natural rainfall over 1.25 acres per setting. Ideal for Groundnut, Maize, & Grass.'
  },
  {
    id: 'eq-ir-04',
    category: 'irrigation',
    title: 'Borewell Flushing High-Pressure Air Compressor Rig (300 PSI)',
    teluguTitle: 'బోర్‌వెల్ ఫ్లషింగ్ హై-ప్రెజర్ కంప్రెసర్ రిగ్ (300 PSI)',
    brand: 'ELGi Compressors',
    model: 'AgriBore Flush 300',
    hp: '300 PSI / 450 CFM',
    implements: ['Flexible High-Pressure Air Hose', 'Bore Flusher Nozzle'],
    providerName: 'Sri Tirumala Borewell Servicing',
    providerType: 'Groundwater Specialist',
    verified: true,
    rating: 4.79,
    bookingsCount: 29,
    phone: '+919949102837',
    state: 'Andhra Pradesh',
    district: 'Prakasam',
    mandal: 'Podili',
    village: 'Podili',
    distanceKm: 15.0,
    ratePerHour: 650,
    ratePerAcre: 3200,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: false,
    minAdvance: 500,
    specs: 'Flushes silt, mud, and sand from silted agricultural borewells to restore full water yield.'
  },

  // ─── HARVESTING & POST-HARVEST ───
  {
    id: 'eq-hv-01',
    category: 'harvester',
    title: 'Claas Crop Tiger 30 Tracked Paddy & Multi-Crop Combine Harvester',
    teluguTitle: 'క్లాస్ క్రాప్ టైగర్ 30 వరి & ధాన్యపు కంబైన్ హార్వెస్టర్',
    brand: 'Claas',
    model: 'Crop Tiger 30 Terra Trac',
    hp: '76 HP',
    implements: ['Rubber Tracks for Wet Mud', 'Grain Tank & Straw Cutter'],
    providerName: 'Coastal Andhra Harvester Syndicate',
    providerType: 'Custom Hiring Network',
    verified: true,
    rating: 4.92,
    bookingsCount: 88,
    phone: '+919848192847',
    state: 'Andhra Pradesh',
    district: 'Bapatla',
    mandal: 'Bapatla',
    village: 'Bapatla',
    distanceKm: 34.0,
    ratePerHour: 2200,
    ratePerAcre: 2600,
    operatorIncluded: true,
    fuelIncluded: true,
    availableToday: true,
    minAdvance: 500,
    specs: 'Harvester + Thresher in 1 pass. 99% grain purity with zero field loss. 2.5 acres/hour.'
  }
];

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

  // Equipment Database state with LocalStorage sync
  const [equipmentList, setEquipmentList] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_custom_equipment_listings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed, ...INITIAL_EQUIPMENT_CATALOG];
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved custom equipment:', e);
    }
    return INITIAL_EQUIPMENT_CATALOG;
  });

  // User Bookings State with LocalStorage sync
  const [myBookings, setMyBookings] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_equipment_bookings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    // Seed initial demo booking so user sees how it looks
    return [
      {
        id: 'BK-78210',
        equipmentId: 'eq-dr-01',
        title: 'DJI Agras T30 (30L Drone Spray)',
        teluguTitle: 'DJI Agras T30 (30 లీటర్ల డ్రోన్ స్ప్రేయర్)',
        category: 'drone',
        providerName: 'Prakasam Kisan Drone Squadron',
        phone: '+919866192840',
        acres: 2.5,
        targetCrop: activeFarm?.crop_name || 'Chilli',
        operation: 'Nano-Urea + Insecticide Spray',
        bookingDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        timeSlot: 'Early Morning (6:00 AM - 10:00 AM)',
        totalCost: 1375,
        paymentMode: 'Pay on Completion (UPI / Cash)',
        status: 'confirmed', // 'pending' | 'confirmed' | 'in-progress' | 'completed'
        createdAt: new Date().toISOString(),
        syncedToKhata: false
      }
    ];
  });

  // Save bookings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(myBookings));
    } catch (e) {}
  }, [myBookings]);

  // Derived cascading dropdowns for Location Switcher Modal
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

      {/* ═══════════ MAIN NAVIGATION TABS ═══════════ */}
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
          onClick={() => setActiveTab('register')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === 'register'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isTe ? 'నా పరికరాన్ని రిజిస్టర్ చేయండి' : 'Register My Equipment'}</span>
          <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold ml-0.5">
            {isTe ? 'అద్దె సంపాదన' : 'Earn Rent'}
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

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700 transition-all flex flex-col justify-between"
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

                    {/* Provider Tag & Village */}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{item.providerName}</span>
                      </span>
                      <span>•</span>
                      <span>{item.village}, {item.mandal}</span>
                    </div>

                    {/* Key Specs & Highlights */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {item.specs}
                    </p>

                    {/* Implements Tags */}
                    {item.implements && item.implements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {item.implements.map((imp, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            ✓ {imp}
                          </span>
                        ))}
                      </div>
                    )}
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
                        {item.availableToday ? (
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
                        href={`tel:${item.phone}`}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={isTe ? 'ఫోన్ చేయండి' : 'Call Provider'}
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      <a
                        href={`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          isTe
                            ? `నమస్తే! నేను అగ్రిషీల్డ్ యాప్ ద్వారా మీ ${item.teluguTitle || item.title} బుకింగ్ కోసం సంప్రదిస్తున్నాను. లొకేషన్: ${locationVillage}, ${locationMandal}. వివరాలు తెలపగలరు.`
                            : `Hello! Inquiring to book your ${item.title} via AgriShield AI for my farm in ${locationVillage}, ${locationMandal}. Please share availability.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                        title={isTe ? 'వాట్సాప్ మెసేజ్' : 'WhatsApp Provider'}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleOpenBooking(item)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <Zap className="w-4 h-4 fill-white" />
                        <span>{isTe ? 'ఇప్పుడే బుక్ చేయండి' : 'Book This Slot'}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {displayedEquipment.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8">
              <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {isTe ? 'ఈ కేటగిరీలో పరికరాలు కనుగొనబడలేదు' : 'No equipment matches your filter'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {isTe ? 'దయచేసి శోధన పదాన్ని మార్చండి లేదా సమీప మండలాన్ని ఎంచుకోండి.' : 'Try clearing your search query or switching your service area location.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                {isTe ? 'ఫిల్టర్‌లు తొలగించండి' : 'Reset All Filters'}
              </button>
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
            {myBookings.map((b) => {
              const statusBadge = {
                pending: { label: isTe ? 'ధృవీకరణ వేచి ఉంది' : 'Pending Confirmation', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300' },
                confirmed: { label: isTe ? 'ధృవీకరించబడింది & షెడ్యూల్' : 'Confirmed & Scheduled', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' },
                'in-progress': { label: isTe ? 'పని జరుగుతోంది' : 'Work In Progress', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300' },
                completed: { label: isTe ? 'పూర్తయింది' : 'Completed', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300' }
              }[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-700' };

              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{b.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mt-1">
                        {isTe && b.teluguTitle ? b.teluguTitle : b.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {b.providerName} • {b.phone}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-xs text-slate-400 font-bold block">{isTe ? 'మొత్తం అంచనా ధర' : 'Estimated Cost'}</span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        ₹{b.totalCost}
                      </span>
                    </div>
                  </div>

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
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'విస్తీర్ణం / పంట' : 'Acres / Crop'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{b.acres} Acres ({b.targetCrop})</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'చెల్లింపు విధానం' : 'Payment'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate block">{b.paymentMode}</span>
                    </div>
                  </div>

                  {/* Action Buttons: Call, WhatsApp, Add to Farm Khata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${b.phone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{isTe ? 'కాల్ చేయండి' : 'Call Provider'}</span>
                      </a>
                      <a
                        href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Booking ID #${b.id}: Confirming ${b.title} scheduled for ${b.bookingDate} (${b.timeSlot}) for ${b.acres} Acres.`
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
            })}
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
            isTe={isTe}
            onClose={() => setIsBookModalOpen(false)}
            onConfirm={(newBooking) => {
              setMyBookings((prev) => [newBooking, ...prev]);
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
function BookEquipmentModal({ equipment, activeFarm, user, serviceLocation, isTe, onClose, onConfirm }) {
  const [farmerName, setFarmerName] = useState(user?.name || 'Farmer');
  const [farmerPhone, setFarmerPhone] = useState(user?.phone || '9440182736');
  const [farmSector, setFarmSector] = useState(activeFarm?.farm_name || 'My Farm Field 1');
  const [targetCrop, setTargetCrop] = useState(activeFarm?.crop_name || 'Chilli');
  const [approachRoad, setApproachRoad] = useState('Tractor Accessible Road');

  const [serviceDate, setServiceDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [timeSlot, setTimeSlot] = useState('Early Morning (6:00 AM - 10:00 AM)');

  // Quantity in Acres or Hours
  const [unitMode, setUnitMode] = useState('acres'); // 'acres' | 'hours'
  const [quantity, setQuantity] = useState(parseFloat(activeFarm?.farm_size) || 2.0);
  const [operationType, setOperationType] = useState(
    equipment.category === 'drone' ? 'Foliar Spraying (Nano-Urea / Pesticide)' : 'Rotavator / Secondary Tillage'
  );

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

    const newBooking = {
      id: bookingId,
      equipmentId: equipment.id,
      title: equipment.title,
      teluguTitle: equipment.teluguTitle,
      category: equipment.category,
      providerName: equipment.providerName,
      phone: equipment.phone,
      farmerName,
      farmerPhone,
      farmSector,
      targetCrop,
      approachRoad,
      location: serviceLocation,
      bookingDate: serviceDate,
      timeSlot,
      unitMode,
      acres: quantity,
      operation: operationType,
      includeOperator,
      includeDiesel,
      totalCost,
      paymentMode: paymentPreference,
      specialInstructions,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      syncedToKhata: false
    };

    onConfirm(newBooking);

    // Launch WhatsApp notification directly
    const waText = isTe
      ? `*కొత్త యంత్ర బుకింగ్ నిర్ధారణ (#${bookingId})* 🚜\n\nపరికరం: ${equipment.teluguTitle || equipment.title}\nరైతు: ${farmerName} (${farmerPhone})\nలొకేషన్: ${serviceLocation.village}, ${serviceLocation.mandal}\nతేదీ: ${serviceDate} (${timeSlot})\nవిస్తీర్ణం: ${quantity} ఎకరాలు (${targetCrop})\nఆపరేటర్: ${includeOperator ? 'అవును' : 'కాదు'}\nడీజిల్: ${includeDiesel ? 'యజమానిదే' : 'రైతుదే'}\nమొత్తం అంచనా: ₹${totalCost}\n\nదయచేసి స్లాట్‌ను నిర్ధారించండి.`
      : `*NEW MACHINERY BOOKING CONFIRMATION (#${bookingId})* 🚜\n\nEquipment: ${equipment.title}\nFarmer: ${farmerName} (${farmerPhone})\nLocation: ${serviceLocation.village}, ${serviceLocation.mandal}\nDate: ${serviceDate} (${timeSlot})\nArea: ${quantity} Acres (${targetCrop})\nOperator: ${includeOperator ? 'Yes' : 'Self'}\nDiesel: ${includeDiesel ? 'Included' : 'By Farmer'}\nEstimated Total: ₹${totalCost}\n\nPlease verify arrival time.`;

    const waUrl = `https://wa.me/${equipment.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, '_blank');
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

              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'పంట పేరు' : 'Target Crop'}</label>
                <input
                  type="text"
                  value={targetCrop}
                  onChange={(e) => setTargetCrop(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
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

              <div>
                <label className="font-bold text-slate-500 block mb-1">{isTe ? 'పని రకం' : 'Specific Operation'}</label>
                <input
                  type="text"
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
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
              <span>{isTe ? 'బుకింగ్ నిర్ధారించండి & వాట్సాప్ పంపండి' : 'Confirm & Send WhatsApp Voucher'}</span>
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
