import React, { useState, useEffect, useMemo } from 'react';
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
  Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/toast';
import { Button } from '../../components/ui/index';

export default function ProviderDashboardPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const { user } = useAuth();
  const toast = useToast();

  // Active Provider View Tab
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'orders' | 'earnings' | 'settings'

  // Availability Status
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('agrishield_provider_online_status');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleOnlineStatus = () => {
    const nextVal = !isOnline;
    setIsOnline(nextVal);
    localStorage.setItem('agrishield_provider_online_status', String(nextVal));
    toast.success(
      nextVal ? 'Provider Hub is Online' : 'Provider Hub is Paused',
      nextVal ? 'Farmers can now send rental booking requests.' : 'Incoming new rental orders temporarily paused.'
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
  }, [fleetList]);

  // ── Incoming Farmer Bookings State ──
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

  useEffect(() => {
    localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(bookingsList));
  }, [bookingsList]);

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

    setIsAddModalOpen(false);
    setNewTitle('');
    toast.success('Equipment Listed!', `${newMachine.title} has been added to your live rental catalog.`);
  };

  const handleToggleMachineAvailability = (id) => {
    setFleetList(prev => prev.map(m => m.id === id ? { ...m, available: !m.available } : m));
    toast.info('Status Updated', 'Machine availability has been updated.');
  };

  const handleDeleteMachine = (id) => {
    if (window.confirm('Are you sure you want to remove this equipment from your fleet?')) {
      setFleetList(prev => prev.filter(m => m.id !== id));
      toast.success('Removed', 'Machinery listing was deleted.');
    }
  };

  const handleUpdateBookingStatus = (bookingId, nextStatus) => {
    setBookingsList(prev => prev.map(b => b.id === bookingId ? { ...b, status: nextStatus } : b));
    toast.success('Order Updated', `Booking #${bookingId} marked as ${nextStatus}.`);
  };

  // Metrics
  const totalFleetCount = fleetList.length;
  const availableFleetCount = fleetList.filter(f => f.available).length;
  const pendingOrdersCount = bookingsList.filter(b => b.status === 'confirmed' || b.status === 'pending').length;
  const completedOrdersCount = bookingsList.filter(b => b.status === 'completed').length;
  const totalEarnings = bookingsList
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (Number(b.totalCost) || 2500), 0);

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              <span>{isOnline ? (isTe ? 'ఆన్‌లైన్ (ఆర్డర్లు స్వీకరిస్తోంది)' : 'Status: Online (Taking Orders)') : (isTe ? 'విరామం (ఆఫ్‌లైన్)' : 'Status: Paused')}</span>
            </button>

            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-4 py-2 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>{isTe ? 'కొత్త యంత్రం జోడించండి' : 'Add Machinery'}</span>
            </Button>
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

      {/* ── CLEAN TAB BAR NAVIGATION (Only Provider Focused) ── */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#070e17] border border-slate-200/90 dark:border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'fleet'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{isTe ? 'యంత్రాల జాబితా (Fleet)' : 'My Machinery Fleet'} ({fleetList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{isTe ? 'రైతు బుకింగ్ ఆర్డర్లు' : 'Farmer Booking Orders'}</span>
          {pendingOrdersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-amber-950 font-black">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('earnings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'earnings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{isTe ? 'ఆదాయం & లెడ్జర్' : 'Earnings & Ledger'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{isTe ? 'సేవా పరిధి & సెట్టింగ్స్' : 'Hub Coverage Settings'}</span>
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
              {bookingsList.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                        #{booking.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        booking.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : booking.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-300'
                          : 'bg-amber-50 text-amber-700 border border-amber-300'
                      }`}>
                        {booking.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {booking.equipmentTitle || 'Farm Machinery Rental'}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span>Farmer: <strong>{booking.farmerName || 'Local Farmer'}</strong></span>
                      <span>&bull;</span>
                      <span>Field: {booking.acreage || '2'} Acres ({booking.crop || 'Crop'})</span>
                    </p>

                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{booking.date || 'Today'} &bull; Slot: {booking.slot || 'Full Day'}</span>
                      <span>&bull;</span>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{booking.village || 'Field Location'}</span>
                    </p>
                  </div>

                  {/* Actions & Fare */}
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Rental Amount</p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        ₹{booking.totalCost || '2,500'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {booking.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Completed</span>
                        </button>
                      )}

                      {booking.contactPhone && (
                        <a
                          href={`tel:${booking.contactPhone}`}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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

      {/* ── TAB 4: HUB COVERAGE SETTINGS ── */}
      {activeTab === 'settings' && (
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#070e17] p-6 space-y-5">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            {isTe ? 'బేస్ హబ్ & సేవా పరిధి కాన్ఫిగరేషన్' : 'Hub Location & Operating Coverage'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">Base Station Village</label>
              <input
                type="text"
                disabled
                value={user?.farm_location?.village || 'Pasupugallu'}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">District & State</label>
              <input
                type="text"
                disabled
                value={`${user?.farm_location?.district || 'Prakasam'}, Andhra Pradesh`}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-200">CHC Govt Subsidy Schemes Integration</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Your registered machinery is eligible for SMAM (Sub-Mission on Agricultural Mechanization) custom hiring subsidies. Farmers booking through AgriShield receive direct DBT billing slips.
            </p>
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
