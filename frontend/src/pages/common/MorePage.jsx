
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useHardwareMode } from '../../hooks/useHardwareMode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Bot,
  Cpu,
  HardDrive,
  Radio,
  User,
  Settings,
  ShieldCheck,
  Sprout,
  BarChart2,
  FileText,
  ChevronRight,
  LogOut,
  Info,
  X,
  Leaf,
  TrendingUp,
  Globe,
  Ruler,
  Headphones,
  Truck,
  Calendar,
  FlaskConical,
  Landmark,
  BookOpen,
  MessageSquare,
  IndianRupee
} from 'lucide-react';
import LanguageSelectModal from '../../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../../data/languages';
import LogoutOverlay from '../../components/animations/LogoutOverlay';

const SectionHeader = ({ title, first = false }) => (
  <p className={`text-[10.5px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 mb-2.5 ${first ? 'mt-0' : 'mt-6'}`}>
    {title}
  </p>
);

const MenuCard = ({ icon: Icon, label, description, path, iconColor, iconBg, accent, badge, onClick }) => (
  <button
    type="button"
    onClick={() => onClick ? onClick(path) : null}
    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border-l-4 ${accent || 'border-l-emerald-500'} bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.98] active:shadow-none transition-all duration-150 text-left group cursor-pointer`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg || 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800'}`}>
      <Icon className={`w-5 h-5 ${iconColor || 'text-emerald-600 dark:text-emerald-400'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{label}</p>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug mt-1 line-clamp-2 sm:line-clamp-1">{description}</p>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
  </button>
);

const MorePage = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hardwareMode, setHardwareMode } = useHardwareMode();
  const isAdmin = user?.role === 'admin';
  const isEquipmentProvider = user?.role === 'provider' || user?.role === 'equipment_provider' || user?.profile_type === 'provider' || user?.account_type === 'provider';
  const [aboutOpen, setAboutOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);

  const currentLangObj = getLanguageByCode(i18n.language);

  const FARMING_TOOLS = [
    {
      icon: BookOpen,
      label: isTe ? 'డిజిటల్ ఫార్మ్ ఖాతా & లెడ్జర్' : 'Digital Farm Khata & Ledger',
      description: isTe
        ? 'పంట రాబడి, ఎరువుల ఖర్చులు, వ్యాపారుల బకాయిలు & లాభాల గణన'
        : 'Track crop revenue, fertilizer expenses, buyer credit reminders & profit',
      path: '/farm?tab=farm-khata',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500',
      badge: isTe ? 'ఖాతా' : '₹ Khata'
    },
    {
      icon: FlaskConical,
      label: isTe ? 'ఎరువులు & నేల NPK లెక్కింపు' : 'Fertilizer & Soil NPK Calculator',
      description: isTe
        ? 'యూరియా, డీఏపీ, పొటాష్ బస్తాల లెక్క & సబ్సిడీ ధరల వివరాలు'
        : 'Exact Urea, DAP & MOP bags per acre with subsidized retail cost breakdown',
      path: '/farm?tab=soil-npk',
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500',
      badge: 'NPK Bags'
    },
    {
      icon: Landmark,
      label: isTe ? 'పీఎం-కిసాన్ & ప్రభుత్వ రాయితీలు' : 'PM-Kisan & Government Schemes',
      description: isTe
        ? 'పీఎం-కిసాన్ ₹6,000 స్థితి, రైతు భరోసా, విత్తన రాయితీ & సోలార్ పంపులు'
        : 'PM-Kisan ₹6,000 status, Rythu Bharosa, seed subsidies & solar pump DBT',
      path: '/farm?tab=government-schemes',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',
      accent: 'border-l-indigo-500',
      badge: 'DBT Direct'
    },
    {
      icon: MessageSquare,
      label: isTe ? 'వాట్సాప్ AI పంట వైద్యుడు' : 'WhatsApp AI Crop Doctor',
      description: isTe
        ? 'వాట్సాప్‌లో ఆకు ఫోటో పంపి క్షణాల్లో మందుల ప్రిస్క్రిప్షన్ పొందండి'
        : 'Send leaf photos on WhatsApp for instant AI diagnosis and prescription',
      path: '/farm?tab=whatsapp-diagnosis',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500',
      badge: 'WhatsApp'
    },
    {
      icon: Truck,
      label: isTe ? 'ట్రాక్టర్, డ్రోన్ & యంత్రాల అద్దె' : t('more.machinery_rental', 'Farm Machinery, Drone & Pump Rental'),
      description: isTe
        ? 'సమీపంలోని ట్రాక్టర్లు, స్ప్రేయింగ్ డ్రోన్లు, పంపులను బుక్ చేయండి లేదా మీ యంత్రాన్ని అద్దెకు ఇవ్వండి'
        : t('more.machinery_rental_desc', 'Book nearby tractors, spraying drones & irrigation pumps or list your equipment'),
      path: '/equipment-booking',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500',
      badge: isTe ? 'అద్దె సేవలు' : t('more.live_rentals', 'Live Rentals')
    },
    {
      icon: Ruler,
      label: isTe ? 'పొలం విస్తీర్ణ కాలిక్యులేటర్ (GPS)' : t('more.field_calculator', 'Field Area Calculator'),
      description: isTe
        ? 'GPS నడక & మ్యాప్ పిన్ ద్వారా ఎకరాలు, సెంట్లు & గుంటల ఖచ్చితమైన లెక్కింపు'
        : t('more.field_calculator_desc', 'GPS perimeter walk & map pin measuring for acres, cents & gunthas'),
      path: '/field-calculator',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800',
      accent: 'border-l-cyan-500',
      badge: isTe ? '1మీ GPS' : t('more.1m_gps', '1m GPS')
    },
    {
      icon: TrendingUp,
      label: isTe ? 'మార్కెట్ ధరలు & మార్కెట్ యార్డ్ (మండి)' : t('more.tools.mandi.label', 'Mandi & Market Prices'),
      description: isTe
        ? 'నేటి పంట మార్కెట్ రేట్లు, ధరల హెచ్చుతగ్గులు & తాజా ట్రెండ్స్'
        : t('more.tools.mandi.desc', 'Today’s market rates, commodity arrivals & trends'),
      path: '/market',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500',
      badge: isTe ? 'మార్కెట్ రేట్లు' : 'Mandi Rates'
    },
    {
      icon: Bot,
      label: isTe ? 'అగ్రిషీల్డ్ AI చాట్ సహాయకుడు' : t('more.tools.assistant.label', 'AgriShield Chat Assistant'),
      description: isTe
        ? 'తెలుగు, హిందీ, ఆంగ్లంలో వాయిస్ & టెక్స్ట్ పంట సలహాలు'
        : t('more.tools.assistant.desc', 'Voice & text consultation in Hindi, Telugu, Tamil'),
      path: '/assistant',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800',
      accent: 'border-l-blue-500',
      badge: isTe ? 'AI చాట్' : 'AI Assistant'
    },
    {
      icon: FileText,
      label: isTe ? 'పంట నివేదికలు & పీడీఎఫ్ డాక్యుమెంట్లు' : t('more.tools.reports.label', 'Audit Reports & Dossiers'),
      description: isTe
        ? 'వ్యాధి నిర్ధారణ రికార్డులు & సెన్సార్ టెలిమెట్రీ పీడీఎఫ్ డౌన్‌లోడ్'
        : t('more.tools.reports.desc', 'Download PDF disease logs & telemetry reports'),
      path: '/reports',
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800',
      accent: 'border-l-purple-500',
      badge: isTe ? 'పీడీఎఫ్' : 'PDF'
    },
  ];

  const HARDWARE_TOOLS = [
    {
      icon: Cpu,
      label: isTe ? 'సెన్సార్లు & పరికరాలు' : t('more.tools.devices.label', 'Sensors & Devices'),
      description: isTe
        ? 'ESP32 నోడ్స్, బ్యాటరీ శాతం & లైవ్ కెమెరా స్ట్రీమ్'
        : t('more.tools.devices.desc', 'View paired ESP32 nodes, battery & live stream'),
      path: '/devices',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800',
      accent: 'border-l-cyan-500',
      badge: isTe ? 'లైవ్ IoT' : 'IoT Live'
    },
    {
      icon: Radio,
      label: isTe ? 'నోడ్ కంట్రోల్ ప్యానెల్' : t('more.tools.node_control.label', 'Node Control Panel'),
      description: isTe
        ? 'వైఫై కాన్ఫిగరేషన్, సెన్సార్ కాలిబ్రేషన్ & డీప్ స్లీప్ సెట్టింగులు'
        : t('more.tools.node_control.desc', 'Configure Wi-Fi, sensor calibration & deep sleep'),
      path: '/node-control',
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800',
      accent: 'border-l-sky-500'
    },
    {
      icon: HardDrive,
      label: isTe ? 'మైక్రో SD బ్లాక్‌బాక్స్ స్టోరేజ్' : t('more.tools.sdcard.label', 'MicroSD Storage'),
      description: isTe
        ? 'ఆఫ్‌లైన్ సెన్సార్ రికార్డులను బ్రౌజ్ చేయండి & డౌన్‌లోడ్ చేసుకోండి'
        : t('more.tools.sdcard.desc', 'Browse and download offline blackbox sensor logs'),
      path: '/sdcard',
      iconColor: 'text-slate-600 dark:text-slate-300',
      iconBg: 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700',
      accent: 'border-l-slate-400'
    },
  ];

  const ACCOUNT_TOOLS = [
    {
      icon: Headphones,
      label: isEquipmentProvider 
        ? (isTe ? 'ప్రొవైడర్ సహాయ కేంద్రం' : t('more.provider_support', 'Provider Support & Help Desk'))
        : (isTe ? 'రైతు సహాయ కేంద్రం (24x7)' : t('more.farmer_support', 'Help & Support Team')),
      description: isEquipmentProvider
        ? (isTe ? '24x7 యంత్రాల బుకింగ్, వివాదాల పరిష్కారం & చెల్లింపుల సహాయం' : t('more.provider_support_desc', '24x7 machinery dispatch, booking disputes & rental payouts desk'))
        : (isTe ? '24x7 వాట్సాప్ సహాయం, 15 నిమిషాల ఫోన్ కాల్‌బ్యాక్ & సాంకేతిక టిక్కెట్లు' : t('more.farmer_support_desc', '24x7 WhatsApp desk, 15-min phone callback & tech tickets')),
      path: '/support',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',
      accent: 'border-l-indigo-500',
      badge: '24x7'
    },
    {
      icon: Globe,
      label: isTe ? 'భాషల మార్పు (Languages)' : t('more.tools.languages.label', 'Languages'),
      description: isTe
        ? 'యాప్ భాషను తెలుగు, హిందీ, ఆంగ్లంలోకి 1-ట్యాప్‌తో మార్చండి'
        : t('more.tools.languages.desc', 'Change app language directly with 1-tap instant switch'),
      path: '/languages',
      onClick: () => setLanguageModalOpen(true),
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500',
      badge: currentLangObj?.nativeName || 'English'
    },
    {
      icon: User,
      label: isTe ? 'నా ప్రొఫైల్' : t('more.tools.profile.label', 'My Profile'),
      description: isTe
        ? 'రైతు పేరు, ఫోన్ నంబర్ & పొలం చిరునామా'
        : t('more.tools.profile.desc', 'Name, phone number, and farm location'),
      path: '/profile',
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800',
      accent: 'border-l-rose-500'
    },
    {
      icon: Settings,
      label: isTe ? 'సిస్టమ్ సెట్టింగులు' : t('more.tools.settings.label', 'System Settings'),
      description: isTe
        ? 'థీమ్ (డార్క్/లైట్), ఫీల్డ్ కాంట్రాస్ట్ & హార్డ్‌వేర్ మోడ్ మార్పిడి'
        : t('more.tools.settings.desc', 'Theme, display accessibility, and Hardware Mode switch'),
      path: '/settings',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500',
    },
  ];

  const PROVIDER_HUB_TOOLS = [
    {
      icon: Truck,
      label: isTe ? 'యంత్రాల ఫ్లీట్ హబ్' : t('more.machinery_fleet', 'Machinery Fleet Hub'),
      description: isTe
        ? 'మీ ట్రాక్టర్లు, స్ప్రే డ్రోన్లు మరియు వ్యవసాయ యంత్రాలను నిర్వహించండి'
        : t('more.machinery_fleet_desc', 'Manage your listed tractors, spray drones & attachments'),
      path: '/provider/dashboard?tab=fleet',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500',
      badge: isTe ? 'యాక్టివ్ ఫ్లీట్' : t('more.active_fleet', 'Active Fleet')
    },
    {
      icon: Calendar,
      label: isTe ? 'రైతుల బుకింగ్ ఆర్డర్లు' : t('more.booking_orders', 'Farmer Booking Orders'),
      description: isTe
        ? 'రైతుల నుండి వచ్చిన బుకింగ్ అభ్యర్థనలను అంగీకరించండి & షెడ్యూల్ చేయండి'
        : t('more.booking_orders_desc', 'Accept, schedule, and complete incoming farm service requests'),
      path: '/provider/dashboard?tab=orders',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',
      accent: 'border-l-indigo-500',
      badge: isTe ? 'ఆర్డర్లు' : t('more.orders_badge', 'Orders')
    },
    {
      icon: TrendingUp,
      label: isTe ? 'ఆదాయం & చెల్లింపుల లెడ్జర్' : t('more.earnings_ledger', 'Earnings & Payout Ledger'),
      description: isTe
        ? 'రోజువారీ అద్దె రాబడి, పూర్తయిన పనుల సంపాదన & UPI చెల్లింపులు'
        : t('more.earnings_ledger_desc', 'Daily & acreage rental revenue, completed job earnings, UPI payouts'),
      path: '/provider/dashboard?tab=earnings',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500',
      badge: isTe ? 'ఆదాయం' : 'Revenue'
    },
    {
      icon: Bot,
      label: isTe ? 'AI మెషినరీ & ఫ్లీట్ కోపైలట్' : t('more.machinery_copilot', 'AI Machinery & Fleet Copilot'),
      description: isTe
        ? 'ట్రాక్టర్ సర్వీస్, డ్రోన్ బ్యాటరీ నియమాలు & ఎకరా డీజిల్ లెక్కల సహాయం'
        : t('more.machinery_copilot_desc', 'AI chatbot for tractor maintenance, drone battery SOPs, per-acre diesel & rental pricing'),
      path: '/provider/dashboard?tab=copilot',
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800',
      accent: 'border-l-purple-500',
      badge: isTe ? 'AI కోపైలట్' : t('more.ai_assistant', 'AI Assistant')
    },
    {
      icon: Ruler,
      label: isTe ? 'పొలం విస్తీర్ణ కాలిక్యులేటర్ (GPS)' : t('more.field_calculator', 'Field Area Calculator'),
      description: isTe
        ? 'ఖచ్చితమైన ఎకరా బిల్లింగ్ కోసం GPS ద్వారా రైతు పొలాలను కొలవండి'
        : t('more.field_calculator_desc2', 'Measure farmer fields accurately with GPS for exact acre billing'),
      path: '/field-calculator',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800',
      accent: 'border-l-cyan-500',
      badge: isTe ? '1మీ GPS' : '1m GPS'
    },
  ];

  const PROVIDER_ACCOUNT_TOOLS = [
    {
      icon: Bell,
      label: isTe ? 'బుకింగ్ నోటిఫికేషన్ల ఇన్బాక్స్' : t('more.notifications_inbox', 'Booking Notifications Inbox'),
      description: isTe
        ? 'కొత్త ట్రాక్టర్/డ్రోన్ బుకింగ్‌లు & రైతు అభ్యర్థనల అలర్ట్‌లు'
        : t('more.notifications_inbox_desc', 'Real-time alerts for new tractor/drone bookings and farmer requests'),
      path: '/notifications',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500'
    },
    {
      icon: User,
      label: isTe ? 'ఎక్విప్‌మెంట్ ప్రొవైడర్ ప్రొఫైల్' : t('more.provider_profile', 'Equipment Provider Profile'),
      description: isTe
        ? 'హబ్ పేరు, సర్వీస్ పరిధి, ఆపరేటర్ల సంఖ్య & UPI చెల్లింపు ID'
        : t('more.provider_profile_desc', 'Hub name, dispatch radius, operator count & payment UPI ID'),
      path: '/profile',
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800',
      accent: 'border-l-rose-500'
    },
    {
      icon: Settings,
      label: isTe ? 'సిస్టమ్ & డిస్ప్లే సెట్టింగులు' : t('more.system_settings', 'System & Display Settings'),
      description: isTe
        ? 'థీమ్, ఫీల్డ్ హై-కాంట్రాస్ట్ మోడ్, బయోమెట్రిక్స్ & యాక్సెసిబిలిటీ'
        : t('more.system_settings_desc', 'Theme, Field High-Contrast mode, biometrics & accessibility'),
      path: '/settings',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500'
    },
    {
      icon: Headphones,
      label: isTe ? 'ప్రొవైడర్ సపోర్ట్ & హెల్ప్‌డెస్క్' : t('more.provider_helpdesk', 'Provider Support & Helpdesk'),
      description: isTe
        ? '24x7 వాట్సాప్ సహాయం, మెషినరీ డిస్పాచ్ సహాయం & కాల్‌బ్యాక్'
        : t('more.provider_helpdesk_desc', '24x7 WhatsApp support, machinery dispatch assist & phone callback'),
      path: '/support',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',
      accent: 'border-l-indigo-500',
      badge: '24x7'
    },
    {
      icon: Globe,
      label: isTe ? 'భాషల మార్పు (Languages)' : t('more.tools.languages.label', 'Languages'),
      description: isTe
        ? 'యాప్ భాషను తెలుగు, హిందీ, ఆంగ్లంలోకి 1-ట్యాప్‌తో మార్చండి'
        : t('more.tools.languages.desc', 'Change app language directly with 1-tap instant switch'),
      path: '/languages',
      onClick: () => setLanguageModalOpen(true),
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500',
      badge: currentLangObj?.nativeName || 'English'
    },
  ];

  const handleLogout = () => {
    // Show beautiful goodbye animation, then actually logout
    setShowLogoutOverlay(true);
  };

  const handleLogoutDone = async () => {
    setShowLogoutOverlay(false);
    await logout?.();
    window.location.href = '/login';
  };

  const ADMIN_COMMAND_TOOLS = [
    {
      icon: ShieldCheck,
      label: 'Admin Control Center',
      description: 'Manage users, system status, hardware & audit logs',
      path: '/admin',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500'
    },
    {
      icon: Radio,
      label: 'Global Broadcasts',
      description: 'Dispatch real-time emergency advisories to all farmers',
      path: '/admin?tab=broadcast',
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800',
      accent: 'border-l-rose-500'
    },
    {
      icon: FileText,
      label: 'Security Audit Logs',
      description: 'Review admin auth, diagnostic & access timestamps',
      path: '/admin?tab=logs',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',
      accent: 'border-l-indigo-500'
    },
  ];

  const ADMIN_SYSTEM_TOOLS = [
    {
      icon: Globe,
      label: t('more.tools.languages.label', 'Languages'),
      description: t('more.tools.languages.desc', 'Change app language directly with 1-tap instant switch'),
      path: '/languages',
      onClick: () => setLanguageModalOpen(true),
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500',
      badge: currentLangObj?.nativeName || 'English'
    },
    {
      icon: Bell,
      label: 'Notifications Box',
      description: 'Review high-priority system alerts and broadcasts',
      path: '/notifications',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500'
    },
    {
      icon: User,
      label: 'Admin Profile & Security',
      description: 'Admin username, email credentials & password reset',
      path: '/profile',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500'
    },
    {
      icon: Settings,
      label: 'System Settings',
      description: 'Theme toggle, display accessibility & mode switches',
      path: '/settings',
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500'
    },
    {
      icon: Bot,
      label: 'AgriShield System Copilot',
      description: 'AI-assisted system diagnostics and query engine',
      path: '/assistant',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800',
      accent: 'border-l-blue-500'
    },
  ];

  return (
    <>
      {/* Logout goodbye animation overlay */}
      {showLogoutOverlay && (
        <LogoutOverlay
          userName={user?.name || 'Farmer'}
          onDone={handleLogoutDone}
        />
      )}

      <div className="max-w-lg mx-auto w-full pb-28 animate-fade-in px-1 sm:px-0">
        {/* ─── CLEAN HEADER ─── */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isAdmin 
                ? 'Settings & System Hub' 
                : isEquipmentProvider 
                  ? (isTe ? 'ఎక్విప్‌మెంట్ ప్రొవైడర్ హబ్ & సెట్టింగులు' : t('more.provider_hub_settings', 'Equipment Provider Hub & More')) 
                  : (isTe ? 'ఇతర సేవలు & సెట్టింగులు' : t('more.tools_settings', 'More Tools & Settings'))}
            </h1>
            {isEquipmentProvider && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isTe ? 'వ్యవసాయ యంత్రాల అద్దె ఫ్లీట్, బుకింగ్‌లు & హబ్ సెట్టింగులు' : t('more.hub_settings_subtitle', 'Machinery rental fleet, bookings & hub settings')}
              </p>
            )}
          </div>
        </div>

        {/* ─── VISUAL SOFTWARE VS HARDWARE MODE SELECTOR ─── */}
        {!isAdmin && !isEquipmentProvider && (
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {isTe ? 'ఆపరేటింగ్ మోడ్ ఎంపిక' : t('more.operating_mode', 'Operating Mode')}
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${hardwareMode
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                }`}>
                {hardwareMode 
                  ? (isTe ? "📡 స్మార్ట్ IoT యాక్టివ్" : "📡 Smart IoT Active") 
                  : (isTe ? "🌱 సాఫ్ట్‌వేర్ AI యాక్టివ్" : "🌱 Software AI Active")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* Mode 1: Software AI Mode */}
              <button
                type="button"
                onClick={() => setHardwareMode(false)}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${!hardwareMode
                    ? 'bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-white dark:to-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 opacity-65 hover:opacity-90'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-xl shadow-xs">
                    🌱
                  </div>
                  {!hardwareMode && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                      ✓
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {isTe ? 'సాఫ్ట్‌వేర్ AI మోడ్' : t('more.software_ai_mode', 'Software AI Mode')}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                    {isTe ? 'కెమెరా స్కాన్, వాతావరణం, శాటిలైట్ మ్యాప్ & మార్కెట్ ధరలు' : t('more.software_ai_desc', 'Camera scan, weather, satellite map & mandi rates')}
                  </p>
                </div>
              </button>

              {/* Mode 2: Smart IoT Hardware Mode */}
              <button
                type="button"
                onClick={() => setHardwareMode(true)}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${hardwareMode
                    ? 'bg-gradient-to-br from-cyan-500/15 via-sky-500/5 to-white dark:to-slate-900 border-cyan-500 ring-2 ring-cyan-500/30 shadow-md shadow-cyan-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 opacity-65 hover:opacity-90'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800 flex items-center justify-center text-xl shadow-xs">
                    📡
                  </div>
                  {hardwareMode && (
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                      ✓
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {isTe ? 'స్మార్ట్ IoT హార్డ్‌వేర్' : t('more.smart_iot_hardware', 'Smart IoT Hardware')}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                    {isTe ? 'ESP32 నోడ్స్, లైవ్ టెలిమెట్రీ & SD బ్లాక్‌బాక్స్ లాగ్స్' : t('more.smart_iot_desc', 'ESP32 nodes, live telemetry & SD blackbox logs')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {isAdmin ? (
          <>
            <SectionHeader title={isTe ? '🛡️ అడ్మిన్ కమాండ్ సెంటర్' : '🛡️ Admin Command Center'} first />
            <div className="flex flex-col gap-2.5">
              {ADMIN_COMMAND_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={navigate} />)}
            </div>

            <SectionHeader title={isTe ? '⚙️ సిస్టమ్ & ప్రాధాన్యతలు' : '⚙️ System & Preferences'} />
            <div className="flex flex-col gap-2.5">
              {ADMIN_SYSTEM_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
            </div>
          </>
        ) : isEquipmentProvider ? (
          <>
            <SectionHeader title={isTe ? '🚜 మెషినరీ ఫ్లీట్ & బుకింగ్‌లు' : t('more.machinery_fleet_bookings', '🚜 Machinery Fleet & Bookings')} first />
            <div className="flex flex-col gap-2.5">
              {PROVIDER_HUB_TOOLS.map((item) => <MenuCard key={item.path + item.label} {...item} onClick={item.onClick || navigate} />)}
            </div>

            <SectionHeader title={isTe ? '👤 ప్రొవైడర్ ప్రొఫైల్ & హబ్ సెట్టింగులు' : t('more.provider_profile_settings', '👤 Provider Profile & Hub Settings')} />
            <div className="flex flex-col gap-2.5">
              {PROVIDER_ACCOUNT_TOOLS.map((item) => <MenuCard key={item.path + item.label} {...item} onClick={item.onClick || navigate} />)}
            </div>
          </>
        ) : (
          <>
            <SectionHeader title={isTe ? '🌾 వ్యవసాయ సాధనాలు & సేవలు' : t('more.sections.farming', '🌾 Farming Tools')} first />
            <div className="flex flex-col gap-2.5">
              {FARMING_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
            </div>

            {hardwareMode && (
              <>
                <SectionHeader title={isTe ? '🔧 IoT హార్డ్‌వేర్ & పరికరాలు' : t('more.sections.hardware', '🔧 Hardware & Devices')} />
                <div className="flex flex-col gap-2.5">
                  {HARDWARE_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
                </div>
              </>
            )}

            <SectionHeader title={isTe ? '👤 ఖాతా & సిస్టమ్ ప్రాధాన్యతలు' : t('more.sections.account', '👤 Account & Preferences')} />
            <div className="flex flex-col gap-2.5">
              {ACCOUNT_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
            </div>
          </>
        )}

        {/* ── About Us ── */}
        <SectionHeader title={isTe ? 'ℹ️ అగ్రిషీల్డ్ AI గురించి' : t('more.about_title', 'ℹ️ About AgriShield AI')} />
        <div className="flex flex-col gap-2.5">
          <MenuCard
            icon={Info}
            label={isTe ? 'అగ్రిషీల్డ్ AI గురించి' : t('more.about_btn', 'About AgriShield')}
            description={isTe ? 'సిస్టమ్, సాంకేతికతలు మరియు అభివృద్ధి వివరాలు తెలుసుకోండి' : t('more.about_desc', 'Learn about the system, technologies, and developers')}
            onClick={() => setAboutOpen(true)}
            iconColor="text-sky-600 dark:text-sky-400"
            iconBg="bg-sky-100 dark:bg-sky-900/50"
            accent="border-l-sky-500"
          />
        </div>

        {/* ── Log Out ── */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-900/50 border-l-4 border-l-rose-500 text-rose-600 dark:text-rose-400 text-sm font-bold shadow-xs hover:bg-rose-50/50 dark:hover:bg-rose-950/20 active:scale-[0.98] active:shadow-none transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {isTe ? 'అగ్రిషీల్డ్ నుండి లాగ్ అవుట్ అవ్వండి' : t('more.sign_out', 'Sign Out of AgriShield')}
        </button>

        {/* App version footer */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-6">
          AgriShield AI Platform · v1.0.0
        </p>

        {/* ── About Modal ── */}
        <AnimatePresence>
          {aboutOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/85 backdrop-blur-xs">
              <div className="fixed inset-0" onClick={() => setAboutOpen(false)} />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative overflow-hidden z-10"
              >
                {/* Radial glow background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                {/* Close Icon */}
                <button
                  onClick={() => setAboutOpen(false)}
                  className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Modal Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm shadow-emerald-600/10">
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-50 tracking-tight">AgriShield AI</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Precision Agriculture Platform</p>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    {isTe 
                      ? 'అగ్రిషీల్డ్ అనేది గ్రామీణ రైతుల కోసం రూపొందించబడిన ఆధునిక పంట వ్యాధి నిర్ధారణ మరియు రియల్-టైమ్ టెలిమెట్రీ మ్యాపింగ్ వేదిక.' 
                      : t('more.about_desc', 'AgriShield is an intelligent crop disease detection and real-time telemetry mapping engine built to empower rural farmers.')}
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 space-y-2">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
                      {isTe ? 'కీలక సాంకేతికతలు' : 'Core Technologies'}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                      <li><strong className="text-slate-700 dark:text-slate-300">{isTe ? 'AI నిర్ధారణ:' : 'AI Diagnostics:'}</strong> {isTe ? '98.4%+ క్లినికల్ ఖచ్చితత్వంతో క్లౌడ్ & ఎడ్జ్ న్యూరల్ మోడల్స్.' : 'Neural Networks with 98.4%+ crop pathology accuracy.'}</li>
                      <li><strong className="text-slate-700 dark:text-slate-300">{isTe ? 'IoT హార్డ్‌వేర్ మోడ్:' : 'Hardware Mode:'}</strong> {isTe ? 'ఐచ్ఛిక ESP32 మైక్రో-టెలిమెట్రీ సెన్సార్ నెట్‌వర్క్.' : 'Optional ESP32 IoT micro-telemetry sensor network.'}</li>
                      <li><strong className="text-slate-700 dark:text-slate-300">{isTe ? 'వాతావరణం & సలహాలు:' : 'Weather & Advisory:'}</strong> {isTe ? 'రియల్-టైమ్ వ్యవసాయ వాతావరణ అంచనాలు & స్మార్ట్ డ్రిప్ ఇరిగేషన్.' : 'Live agro-meteorological forecasting & smart drip irrigation.'}</li>
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
                      {isTe ? 'డిజిటల్ వ్యవసాయ సాధికారత' : 'Smart Agriculture Digital Empowerment'}
                    </p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {isTe ? 'భారతదేశవ్యాప్తంగా రైతుల కోసం బహుభాషా మద్దతుతో అభివృద్ధి చేయబడింది.' : 'Developed for farmers across India with multilingual support.'}
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{isTe ? 'వెర్షన్ 1.0.0 (రిలీజ్ బిల్డ్)' : 'Version 1.0.0 (Release Build)'}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">© 2026 AgriShield</span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* ── Language Selection Modal ── */}
        <LanguageSelectModal
          isOpen={languageModalOpen}
          onClose={() => setLanguageModalOpen(false)}
        />
      </div>
    </>
  );
};

export default MorePage;
