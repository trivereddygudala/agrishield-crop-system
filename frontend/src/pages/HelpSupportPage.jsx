import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy,
  Phone,
  PhoneCall,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sprout,
  HelpCircle,
  FileText,
  X,
  ExternalLink,
  ChevronLeft,
  Headphones,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  MapPin,
  Bot,
  Truck,
  Calendar,
  DollarSign,
  Wrench,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Equipment Provider Specific Complaint & Issue Categories with Explicit Reasons ──
export const PROVIDER_CATEGORIES = [
  {
    value: 'machinery_listing',
    icon: '🚜',
    label_en: '🚜 Machinery Fleet & Listing Issues',
    label_te: '🚜 యంత్రాల జాబితా & ప్రదర్శన సమస్యలు',
    badge_en: 'Catalog & Specs',
    badge_te: 'కేటలాగ్ & రేట్లు',
    reason_en: 'Select this if your tractor, harvester, or spray drone is missing from the public catalog, incorrect hourly or per-acre rental rates are shown, machine specs/HP are wrong, or photos fail to upload.',
    reason_te: 'మీ ట్రాక్టర్, హార్వెస్టర్ లేదా డ్రోన్ అద్దె కేటలాగ్‌లో కనిపించకపోవడం, ఎకరా అద్దె ధరలు తప్పుగా చూపించడం లేదా ఫోటోలు అప్‌లోడ్ కాకపోవడం జరిగితే ఈ వర్గాన్ని ఎంచుకోండి.'
  },
  {
    value: 'booking_disputes',
    icon: '📅',
    label_en: '📅 Farmer Rental Bookings & Schedule Disputes',
    label_te: '📅 రైతు బుకింగ్ & షెడ్యూల్ వివాదాలు',
    badge_en: 'Farmer Booking',
    badge_te: 'బుకింగ్ వివాదం',
    reason_en: 'Select this if a farmer cancelled without advance notice, the farmer was absent at the field, two farmers booked conflicting time slots, or you encountered an issue accepting/rejecting an incoming booking.',
    reason_te: 'రైతు ముందుగా చెప్పకుండా బుకింగ్ రద్దు చేసినా, పొలానికి వెళ్ళినప్పుడు రైతు అందుబాటులో లేకపోయినా, లేదా బుకింగ్ సమయ వివాదాలు ఉంటే ఈ వర్గాన్ని ఎంచుకోండి.'
  },
  {
    value: 'payouts_settlements',
    icon: '💰',
    label_en: '💰 Rental Payouts, UPI Settlements & Invoicing',
    label_te: '💰 అద్దె చెల్లింపులు, UPI సెటిల్మెంట్లు & రసీదులు',
    badge_en: 'Money & Settlement',
    badge_te: 'చెల్లింపు & UPI',
    reason_en: 'Select this if completed rental earnings have not arrived in your bank account, your UPI settlement is delayed, there is a mismatch in calculated acreage fees, or you have questions about payment statements.',
    reason_te: 'పూర్తయిన పనుల అద్దె సొమ్ము మీ బ్యాంక్ లేదా UPI లో జమ కాకపోవడం, సెటిల్మెంట్ ఆలస్యం లేదా ఎకరాల మొత్తంలో తేడాలు ఉన్నప్పుడు ఈ వర్గాన్ని ఎంచుకోండి.'
  },
  {
    value: 'coverage_gps_dispatch',
    icon: '📍',
    label_en: '📍 Service Radius, Location & GPS Dispatch',
    label_te: '📍 సర్వీస్ పరిధి, లొకేషన్ & జీపీఎస్ రూట్ సమస్యలు',
    badge_en: 'Location & Map',
    badge_te: 'పరిధి & రూట్',
    reason_en: 'Select this if the system is showing incorrect village/mandal coverage for your agency, GPS navigation coordinates to the farmer field are inaccurate, or farmers outside your operational radius are booking.',
    reason_te: 'మీ గ్రామం/మండలం సర్వీస్ రేడియస్ సరిగ్గా లేకపోవడం, రైతు పొలానికి GPS రూట్ తప్పుగా చూపించడం లేదా పరిధి దాటిన బుకింగ్‌లు వచ్చినప్పుడు ఎంచుకోండి.'
  },
  {
    value: 'breakdown_operational_aid',
    icon: '⚙️',
    label_en: '⚙️ In-Field Breakdown & Operational Assistance',
    label_te: '⚙️ పొలంలో యంత్ర బ్రేక్‌డౌన్ & అత్యవసర సాయం',
    badge_en: 'SOS & Breakdown',
    badge_te: 'అత్యవసర బ్రేక్‌డౌన్',
    reason_en: 'Select this if a tractor engine overheats, hydraulic lift fails, or drone battery crashes in the field during an active booking and you need urgent platform assistance or replacement dispatch coordination.',
    reason_te: 'పని జరుగుతుండగా ట్రాక్టర్, డ్రోన్ లేదా ఇంప్లిమెంట్ ఆగిపోవడం, అత్యవసర సాంకేతిక సాయం లేదా ప్రత్యామ్నాయ యంత్ర డిస్పాచ్ అవసరమైనప్పుడు ఎంచుకోండి.'
  },
  {
    value: 'agency_profile_verification',
    icon: '🏛️',
    label_en: '🏛️ Agency Profile, Driver/Operator & SMAM Subsidy',
    label_te: '🏛️ ఏజెన్సీ ప్రొఫైల్, ఆపరేటర్ & సబ్సిడీ విచారణ',
    badge_en: 'Hub Verification',
    badge_te: 'ఏజెన్సీ & సబ్సిడీ',
    reason_en: 'Select this for changing your dispatch WhatsApp number, agency business name change, assigning driver/operator contact details, or guidance on Sub-Mission on Agricultural Mechanization (SMAM) subsidies.',
    reason_te: 'మీ డిస్పాచ్ ఫోన్ నంబర్ మార్పు, ఏజెన్సీ పేరు నవీకరణ, ఆపరేటర్ వివరాలు లేదా ప్రభుత్వ SMAM యంత్ర సబ్సిడీ ధృవీకరణ కోసం ఈ వర్గాన్ని ఎంచుకోండి.'
  },
  {
    value: 'general_provider',
    icon: '💬',
    label_en: '💬 General Equipment Provider Desk',
    label_te: '💬 సాధారణ ప్రొవైడర్ హెల్ప్‌డెస్క్ ప్రశ్నలు',
    badge_en: 'General Inquiry',
    badge_te: 'సాధారణ విచారణ',
    reason_en: 'Select this for general questions about provider portal tools, suggestions for new machinery features, fleet statistics reporting, or general inquiries.',
    reason_te: 'ప్రొవైడర్ పోర్టల్ గురించిన సాధారణ ప్రశ్నలు, కొత్త ఫీచర్ల సలహాలు లేదా సాధారణ సహాయం కోసం ఈ వర్గాన్ని ఎంచుకోండి.'
  }
];

// ── Farmer Specific Complaint & Issue Categories with Explicit Reasons ──
export const FARMER_CATEGORIES = [
  {
    value: 'hardware_iot',
    icon: '🛰️',
    label_en: '🛰️ Smart IoT Node / ESP32 Hardware',
    label_te: '🛰️ స్మార్ట్ ఐఓటీ నోడ్ / ESP32 సెన్సార్',
    badge_en: 'ESP32 & Sensors',
    badge_te: 'సెన్సార్లు & నోడ్',
    reason_en: 'Select this if your ESP32 solar node shows offline, soil moisture or leaf wetness sensor is fluctuating, or hardware battery telemetry is not reporting.',
    reason_te: 'ESP32 నోడ్ ఆఫ్‌లైన్‌లో ఉండటం, మట్టి తేమ లేదా ఆకు సెన్సార్ రీడింగ్‌లలో హెచ్చుతగ్గులు లేదా బ్యాటరీ సమాచారం రాకపోతే ఎంచుకోండి.'
  },
  {
    value: 'crop_disease',
    icon: '🩺',
    label_en: '🩺 Crop Disease Scan Review',
    label_te: '🩺 పంట వ్యాధి స్కాన్ పునఃపరిశీలన',
    badge_en: 'Disease & Scan',
    badge_te: 'వ్యాధి స్కాన్',
    reason_en: 'Select this if you suspect an incorrect AI diagnosis on a crop leaf scan and wish to have a senior agronomist manually inspect and provide a certified second opinion.',
    reason_te: 'ఆకు స్కాన్ ఫలితంపై సందేహం ఉండి, వ్యవసాయ నిపుణుడు స్వయంగా పరిశీలించి సరైన మందుల ప్రిస్క్రిప్షన్ ఇవ్వాలని కోరుకుంటే ఎంచుకోండి.'
  },
  {
    value: 'machinery_rental_farmer',
    icon: '🚜',
    label_en: '🚜 Farm Machinery & Equipment Booking',
    label_te: '🚜 వ్యవసాయ యంత్రాలు & అద్దె బుకింగ్ సమస్యలు',
    badge_en: 'Tractor & Drone',
    badge_te: 'యంత్రాలు & బుకింగ్',
    reason_en: 'Select this if the booked tractor or spray drone did not arrive on time, the provider cancelled, or you need help scheduling farm equipment.',
    reason_te: 'బుక్ చేసుకున్న ట్రాక్టర్ లేదా స్ప్రే డ్రోన్ సమయానికి రాకపోవడం, ప్రొవైడర్ స్పందించకపోవడం లేదా బుకింగ్ సంబంధిత సమస్యలకు ఎంచుకోండి.'
  },
  {
    value: 'weather_maps',
    icon: '🗺️',
    label_en: '🗺️ Field Area Calculator & Weather Maps',
    label_te: '🗺️ పొలం విస్తీర్ణ కాలిక్యులేటర్ & మ్యాప్స్',
    badge_en: 'GPS & Weather',
    badge_te: 'జీపీఎస్ & వాతావరణం',
    reason_en: 'Select this for walk-mode GPS boundary measuring inaccuracies, polygon boundary saving errors, or localized rain forecast discrepancies.',
    reason_te: 'పొలం సరిహద్దు కొలతలలో GPS లోపాలు, మ్యాప్ సేవ్ కాకపోవడం లేదా స్థానిక వర్ష సూచన సందేహాలకు ఎంచుకోండి.'
  },
  {
    value: 'billing_account',
    icon: '👤',
    label_en: '👤 Account, Language & App Setup',
    label_te: '👤 ఖాతా, భాష & యాప్ సెట్టింగ్స్',
    badge_en: 'Account & Setup',
    badge_te: 'ఖాతా & భాష',
    reason_en: 'Select this for password recovery, biometric fingerprint login issues, Telugu audio reader voice setup, or updating farm location.',
    reason_te: 'లాగిన్ లేదా పాస్‌వర్డ్ సమస్యలు, బయోమెట్రిక్ వేలిముద్ర సెటప్, తెలుగు ఆడియో స్పీచ్ రీడర్ లేదా చిరునామా మార్పులకు ఎంచుకోండి.'
  },
  {
    value: 'general',
    icon: '🌾',
    label_en: '🌾 General Agronomy Question',
    label_te: '🌾 సాధారణ వ్యవసాయ సలహా',
    badge_en: 'Agronomy Advisory',
    badge_te: 'వ్యవసాయ సలహా',
    reason_en: 'Select this for general questions regarding seasonal crop calendar, organic pest remedies, fertilizer application schedules, or government subsidy schemes.',
    reason_te: 'సీజనల్ పంటల సమాచారం, సేంద్రీయ పురుగు నివారణ, ఎరువుల సమయ పట్టిక లేదా సాధారణ వ్యవసాయ ప్రశ్నలకు ఎంచుకోండి.'
  }
];

export default function HelpSupportPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const navigate = useNavigate();
  const { user } = useAuth();

  // Role detection: Equipment Provider vs Farmer
  const isEquipmentProvider = user?.role === 'provider' || user?.role === 'equipment_provider' || user?.profile_type === 'provider' || user?.account_type === 'provider';
  const activeCategories = isEquipmentProvider ? PROVIDER_CATEGORIES : FARMER_CATEGORIES;

  // Active view tab: 'contact' | 'my-tickets' | 'faqs'
  const [activeSection, setActiveSection] = useState('contact');

  // Callback Modal State
  const [isCallbackOpen, setIsCallbackOpen] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState(user?.phone || user?.mobile || '');
  const [callbackLang, setCallbackLang] = useState(isTe ? 'te' : 'en');
  const [callbackIssue, setCallbackIssue] = useState('');
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);
  const [callbackSuccess, setCallbackSuccess] = useState('');

  // Ticket Form State
  const [ticketCategory, setTicketCategory] = useState(isEquipmentProvider ? 'machinery_listing' : 'hardware_iot');
  const [ticketPriority, setTicketPriority] = useState('medium');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketDeviceId, setTicketDeviceId] = useState('');
  const [ticketPhone, setTicketPhone] = useState(user?.phone || '');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [botTrap, setBotTrap] = useState('');

  // My Tickets State
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Support Dynamic Config from Admin
  const [supportConfig, setSupportConfig] = useState({
    whatsapp_number: '+91 98765 43210',
    support_phone: '1800-180-1551',
    support_hours: '24x7 Emergency Assistance'
  });

  useEffect(() => {
    const fetchSupportConfig = async () => {
      try {
        const res = await API.get('/api/support/config');
        if (res.data && res.data.whatsapp_number) {
          setSupportConfig(res.data);
        }
      } catch (e) {
        console.error("Failed to load dynamic support contacts, using defaults:", e);
      }
    };
    fetchSupportConfig();
  }, []);

  const fetchMyTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await API.get('/api/support/tickets/my');
      setMyTickets(res.data?.tickets || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      console.error("Failed to fetch tickets", err);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // Auto-fetch tickets when tab changes
  useEffect(() => {
    if (activeSection === 'my-tickets' || activeSection === 'my_tickets') {
      fetchMyTickets();
    }
  }, [activeSection, fetchMyTickets]);

  const handleCallEmergency = () => {
    window.location.href = `tel:${supportConfig.support_phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleWhatsApp = (cropContext = '') => {
    const cleanNum = supportConfig.whatsapp_number.replace(/[^0-9]/g, '');
    const defaultMsg = isTe
      ? `నమస్తే అగ్రిషీల్డ్ సపోర్ట్, నాకు పంట ఆరోగ్యం మరియు సాంకేతిక సహాయం కావాలి. (రైతు: ${user?.name || 'రైతు'})`
      : `Hello AgriShield Support, I need assistance regarding crop health or hardware sensor readings. (Farmer: ${user?.name || 'Farmer'})`;
    const message = cropContext ? `${defaultMsg} - సందర్భం: ${cropContext}` : defaultMsg;
    const waUrl = `https://wa.me/${cleanNum}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // 1-Tap WhatsApp Support Generator
  const handleWhatsAppSupport = () => {
    if (isEquipmentProvider) {
      const providerName = user?.name || user?.full_name || 'Equipment Provider';
      const providerPhone = user?.phone || user?.mobile || 'Not provided';
      const hubLocation = user?.farm_location?.village 
        ? `${user?.farm_location?.village}, ${user?.farm_location?.district || ''}` 
        : (user?.location || 'Machinery Hub');

      const text = isTe
        ? `🚜 *అగ్రిషీల్డ్ మెషినరీ ప్రొవైడర్ హెల్ప్‌డెస్క్ సంప్రదింపు*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *ప్రొవైడర్/ఏజెన్సీ:* ${providerName}\n` +
          `📞 *డిస్పాచ్ ఫోన్:* ${providerPhone}\n` +
          `📍 *బేస్ హబ్:* ${hubLocation}\n` +
          `📅 *తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
          `💬 *నా సమస్య వివరాలు:*\n` +
          `నమస్కారం అగ్రిషీల్డ్ ప్రొవైడర్ సపోర్ట్ టీమ్, నా మెషినరీ బుకింగ్స్ / అద్దె చెల్లింపులు / ఫ్లీట్ లిస్టింగ్ విషయంలో మీ సహాయం కావాలి.`
        : `🚜 *AgriShield Equipment Provider Support Request*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Provider/Hub Name:* ${providerName}\n` +
          `📞 *Dispatch Phone:* ${providerPhone}\n` +
          `📍 *Base Hub:* ${hubLocation}\n` +
          `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
          `💬 *Issue Summary:*\n` +
          `Hello AgriShield Provider Desk, I need assistance regarding machinery bookings, rental payouts, or fleet dispatch.`;

      const rawNumber = supportConfig.whatsapp_number || '';
      const cleanDigits = rawNumber.replace(/[^0-9]/g, '');
      const phoneWithCode = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
      const waUrl = phoneWithCode
        ? `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      window.open(waUrl, '_blank');
      return;
    }

    const farmerName = user?.name || user?.full_name || 'Farmer';
    const farmerPhone = user?.phone || 'Not provided';
    const location = user?.farm_location || user?.location || 'Field';

    const text = isTe
      ? `🌾 *అగ్రిషీల్డ్ రైతు మద్దతు హెల్ప్‌డెస్క్ సంప్రదింపు*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *రైతు పేరు:* ${farmerName}\n` +
        `📞 *ఫోన్ నంబర్:* ${farmerPhone}\n` +
        `📍 *ప్రాంతం:* ${location}\n` +
        `📅 *తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
        `💬 *నా సమస్య వివరాలు:*\n` +
        `నమస్కారం అగ్రిషీల్డ్ సపోర్ట్ టీమ్, నాకు వ్యవసాయం/సెన్సార్/యాప్ విషయంలో మీ సాంకేతిక సహాయం కావాలి.`
      : `🌾 *AgriShield Farmer Support Consultation Request*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Farmer Name:* ${farmerName}\n` +
        `📞 *Phone:* ${farmerPhone}\n` +
        `📍 *Location:* ${location}\n` +
        `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
        `💬 *Problem Summary:*\n` +
        `Hello AgriShield Support Team, I need technical/agronomic support regarding my farm setup.`;

    const rawNumber = supportConfig.whatsapp_number || '';
    const cleanDigits = rawNumber.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const waUrl = phoneWithCode
      ? `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  // Submit 15-Minute Callback Request
  const handleCallbackSubmit = async (e) => {
    e.preventDefault();
    if (!callbackPhone.trim()) {
      alert(isTe ? 'దయచేసి సరైన ఫోన్ నంబర్ నమోదు చేయండి.' : 'Please enter a valid phone number.');
      return;
    }

    setCallbackSubmitting(true);
    setCallbackSuccess('');
    try {
      const payload = {
        phone: callbackPhone.trim(),
        farmer_name: isEquipmentProvider ? (user?.name || 'Equipment Provider') : (user?.name || 'Farmer'),
        language: callbackLang,
        issue_summary: callbackIssue.trim() || (isEquipmentProvider ? 'Urgent 15-minute equipment provider dispatch/payout callback' : 'Urgent 15-minute farmer callback request'),
        preferred_time: 'Within 15 minutes'
      };
      if (botTrap) payload.bot_trap = botTrap;

      const res = await API.post('/api/support/callback-request', payload);

      setCallbackSuccess(res.data?.message || (isTe ? 'కాల్‌బ్యాక్ అభ్యర్థన విజయవంతంగా నమోదయింది!' : 'Callback requested! Our officer will call you in 15 minutes.'));
      setCallbackIssue('');
      setTimeout(() => {
        setIsCallbackOpen(false);
        setCallbackSuccess('');
      }, 3500);
    } catch (err) {
      alert(err.response?.data?.detail || (isTe ? 'అభ్యర్థన నమోదు విఫలమైంది.' : 'Failed to register callback request.'));
    } finally {
      setCallbackSubmitting(false);
    }
  };

  // Submit In-App Technical Ticket
  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDesc.trim()) {
      setTicketError(isTe ? 'దయచేసి సమస్య శీర్షిక మరియు వివరాలు నమోదు చేయండి.' : 'Please provide a subject and detailed description.');
      return;
    }

    setTicketSubmitting(true);
    setTicketSuccess('');
    setTicketError('');

    try {
      const payload = {
        category: ticketCategory,
        priority: ticketPriority,
        subject: ticketSubject.trim(),
        description: ticketDesc.trim(),
        device_id: ticketDeviceId.trim() || null,
        phone: ticketPhone.trim() || null,
        language: isTe ? 'te' : 'en'
      };
      if (botTrap) payload.bot_trap = botTrap;

      const res = await API.post('/api/support/tickets', payload);

      setTicketSuccess(res.data?.message || (isTe ? 'సమస్య టికెట్ నమోదయింది! మా బృందం త్వరలో సంప్రదిస్తుంది.' : 'Ticket submitted successfully!'));
      setTicketSubject('');
      setTicketDesc('');
      setTicketDeviceId('');
      // Refresh tickets if on list
      fetchMyTickets();
    } catch (err) {
      setTicketError(err.response?.data?.detail || (isTe ? 'టికెట్ సమర్పణ విఫలమైంది.' : 'Failed to submit support ticket.'));
    } finally {
      setTicketSubmitting(false);
    }
  };

  const FAQS = [
    {
      q: isTe ? 'నా ESP32 ఫీల్డ్ సెన్సార్ ఆఫ్‌లైన్‌లో ఎందుకు చూపిస్తోంది?' : 'Why does my ESP32 field sensor show offline?',
      a: isTe
        ? '1) సెన్సార్ బ్యాటరీ లేదా సోలార్ పవర్ సరిగ్గా ఉందో లేదో చూడండి. 2) నోడ్ వై-ఫై లేదా సిమ్ కనెక్టివిటీ రేంజ్ లో ఉందో ధృవీకరించండి. 3) పరికరంపై ఉన్న చిన్న రీసెట్ (RST) బటన్‌ను 3 సెకన్లు నొక్కి పట్టుకోండి.'
        : '1) Verify that the solar panel / 18650 battery has sufficient charge. 2) Ensure the ESP32 node is within 2.4GHz Wi-Fi or hotspot range. 3) Press the RST button on the node for 3 seconds to reboot.'
    },
    {
      q: isTe ? 'భూమి విస్తీర్ణ కొలతలలో 1 మీటర్ ఖచ్చితత్వం ఎలా పొందాలి?' : 'How do I achieve 1-meter pinpoint GPS field measuring accuracy?',
      a: isTe
        ? 'పొలం సరిహద్దు వెంట నడిచేటప్పుడు ఫోన్‌ను చేతిలో పైకి పట్టుకోండి. చెట్ల కింద కాకుండా బహిరంగ ఆకాశం కింద GPS సిగ్నల్ "±1.8m" లేదా పచ్చటి సూచిక కనిపించిన తర్వాత మాత్రమే వాక్ మోడ్ ప్రారంభించండి.'
        : 'Hold your phone upright with an unobstructed view of the open sky. Wait for the GPS accuracy indicator on the screen to turn green (±1.8m) before beginning your perimeter walk.'
    },
    {
      q: isTe ? 'రోగ నిర్ధారణ స్కాన్ ఫలితంపై నాకు సందేహం ఉంటే ఏమి చేయాలి?' : 'What if I suspect an incorrect disease diagnosis on my scan?',
      a: isTe
        ? 'క్రింద ఉన్న "టికెట్ సమర్పించు" ఫారమ్‌లో "పంట వ్యాధి సమీక్ష" వర్గాన్ని ఎంచుకోండి. మా సీనియర్ వ్యవసాయ శాస్త్రవేత్తలు మీ పంట ఆకు ఫోటోను నేరుగా పరిశీలించి 24 గంటల్లో నిపుణుల సలహా అందిస్తారు.'
        : 'Select "Crop Disease Diagnosis & Scan Review" in the ticket form below. An AgriShield agronomist will manually inspect your leaf scan and provide a certified second opinion.'
    },
    {
      q: isTe ? 'కాల్‌బ్యాక్ అభ్యర్థన చేసిన తర్వాత అధికారులు ఎప్పుడు కాల్ చేస్తారు?' : 'How soon will a support officer call me after a callback request?',
      a: isTe
        ? 'సాధారణ పని వేళల్లో (ఉదయం 8:00 నుండి రాత్రి 8:00 వరకు) మా వ్యవసాయ లేదా సాంకేతిక నిపుణుడు 15 నిమిషాల్లోపు మీ ఫోన్‌కు నేరుగా కాల్ చేస్తారు.'
        : 'During operational hours (8:00 AM – 8:00 PM IST), an agricultural or technical specialist will call your phone directly within 15 minutes.'
    }
  ];

  const PROVIDER_FAQS = [
    {
      q: isTe ? 'రైతు అద్దె చెల్లింపులు (Payouts) నా బ్యాంకు ఖాతాకు ఎప్పుడు జమ అవుతాయి?' : 'When will rental payouts be credited to my bank account?',
      a: isTe
        ? 'రైతు యంత్రం పని పూర్తయినట్లు ధృవీకరించిన తర్వాత లేదా ప్రొవైడర్ డ్యాష్‌బోర్డ్‌లో "Completed" గా మార్చిన 24 గంటలలోపు మీ ప్రొఫైల్ సెట్టింగ్‌లలో నమోదు చేసిన UPI ID లేదా బ్యాంక్ ఖాతాకు నేరుగా జమ చేయబడుతుంది.'
        : 'Once the farmer service is completed and marked "Completed" in your Provider Dashboard, rental proceeds are settled directly to your registered UPI ID or bank account within 24 hours.'
    },
    {
      q: isTe ? 'రైతు చివరి నిమిషంలో బుకింగ్ రద్దు చేస్తే ప్రొవైడర్‌కు పరిహారం లభిస్తుందా?' : 'Do I receive compensation if a farmer cancels a booking at the last minute?',
      a: isTe
        ? 'అవును. మీ యంత్రం డిస్పాచ్ అయిన తర్వాత రైతు రద్దు చేస్తే లేదా పొలంలో అందుబాటులో లేకపోతే, ఇంధన రవాణా రుసుము మరియు రద్దు పరిహారం ఆటోమేటిక్‌గా ప్రొవైడర్‌కు చెల్లించబడుతుంది.'
        : 'Yes. If a farmer cancels after equipment dispatch or fails to appear at the field, a transport/fuel compensation fee is credited to your provider account from the farmer booking deposit.'
    },
    {
      q: isTe ? 'యంత్రం రిపేర్‌లో ఉన్నప్పుడు లేదా బిజీగా ఉన్నప్పుడు బుకింగ్‌లను ఎలా నిలిపివేయాలి?' : 'How do I prevent farmers from booking while machinery is under maintenance or busy?',
      a: isTe
        ? '1) ప్రొవైడర్ డ్యాష్‌బోర్డ్ -> ఫ్లీట్ హబ్ లో సదరు యంత్రం వద్ద ఉన్న "అందుబాటులో ఉంది" స్విచ్‌ను ఆఫ్ చేయండి. 2) లేదా హెడర్‌లోని "నేటి లభ్యత (Today Status)" ని ఆఫ్‌లైన్ గా మార్చండి. దీంతో కేటలాగ్‌లో యంత్రం "Currently Booked / Maintenance" గా లాక్ అవుతుంది.'
        : '1) In Provider Dashboard -> Fleet Hub, toggle the machine availability switch to OFF ("Under Maintenance"). 2) Or switch your top "Today Status" to Offline. Farmers will see the machine locked as "Currently Booked / Maintenance".'
    },
    {
      q: isTe ? 'నా సర్వీస్ కవరేజ్ రేడియస్ (10km నుండి 50km) ఎలా పెంచుకోవాలి?' : 'How do I change or expand my service dispatch radius (e.g. from 10km to 50km)?',
      a: isTe
        ? 'సెట్టింగ్‌లు -> "మెషినరీ హబ్ సెట్టింగ్‌లు" లోకి వెళ్లి Service Coverage Radius లో 10km, 25km, 50km లేదా 100km ఎంచుకుని సేవ్ చేయండి. ఎంచుకున్న దూరం పరిధిలోని రైతులకే మీ యంత్రాలు కనిపిస్తాయి.'
        : 'Navigate to Settings -> "Machinery Hub Settings" and adjust your Service Coverage Radius (10km, 25km, 50km, or 100km). Only farmers within this distance will see your machinery in their local catalog.'
    },
    {
      q: isTe ? 'ప్రభుత్వ SMAM కస్టమ్ హైరింగ్ సెంటర్ 40% సబ్సిడీ వివరాలు ఎలా తెలుసుకోవాలి?' : 'How do I apply for the Government SMAM Custom Hiring Center 40% machinery subsidy?',
      a: isTe
        ? 'కిసాన్ హెల్ప్‌లైన్ (1800-180-1551) లేదా మా ప్రొవైడర్ AI కోపైలట్ ద్వారా సబ్-మిషన్ ఆన్ అగ్రికల్చరల్ మెకనైజేషన్ (SMAM) అర్హత నియమాలు, అవసరమైన భూమి దస్తావేజులు మరియు కొటేషన్ పత్రాల వివరాలను తనిఖీ చేయవచ్చు.'
        : 'Ask the Machinery AI Copilot or contact the Kisan Helpline (1800-180-1551) to inspect required documentation, dealer quotations, and eligibility guidelines for the SMAM 40% Custom Hiring Center subsidy.'
    }
  ];

  const activeFaqs = isEquipmentProvider ? PROVIDER_FAQS : FAQS;
  const selectedCategoryMeta = activeCategories.find(c => c.value === ticketCategory) || activeCategories[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
      {/* ═══════ 1. TOP NAVIGATION & HEADER ═══════ */}
      <div className="space-y-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(isEquipmentProvider ? '/provider/dashboard' : '/more')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4 stroke-[3]" />
            <span>{isEquipmentProvider ? (isTe ? '← ప్రొవైడర్ డ్యాష్‌బోర్డ్' : '← Provider Dashboard') : t('support_page.back_to_more', isTe ? '← ఇతర సేవలు (More)' : '← Back to More')}</span>
          </button>

          {/* Quick Access Pills for Equipment Providers */}
          {isEquipmentProvider && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/provider/dashboard?tab=fleet')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all cursor-pointer flex items-center gap-1"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{isTe ? 'యంత్రాల హబ్' : 'Fleet Hub'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/provider/dashboard?tab=orders')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isTe ? 'రైతు ఆర్డర్లు' : 'Farmer Orders'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isTe ? 'హబ్ సెట్టింగ్‌లు' : 'Hub Settings'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 border ${
              isEquipmentProvider 
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              {isEquipmentProvider ? <Truck className="w-7 h-7" /> : <Headphones className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isEquipmentProvider
                    ? (isTe ? 'అగ్రిషీల్డ్ మెషినరీ ప్రొవైడర్ సపోర్ట్ & హెల్ప్‌డెస్క్' : 'AgriShield Equipment Provider Support & Help Desk')
                    : t('support_page.title', isTe ? 'అగ్రిషీల్డ్ రైతు మద్దతు బృందం' : 'AgriShield Help & Support Team')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  24x7 Helpdesk
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isEquipmentProvider
                  ? (isTe 
                      ? 'యంత్రాల డిస్పాచ్, రైతు బుకింగ్ వివాదాలు, అద్దె చెల్లింపులు & ఆపరేషనల్ సమస్యలపై ప్రత్యేక సహాయం' 
                      : 'Dedicated 24x7 machinery fleet dispatch, farmer booking disputes, and rental payout settlement assistance')
                  : (isTe
                      ? 'హార్డ్‌వేర్, వ్యాధి నిర్ధారణ, వాతావరణం లేదా యాప్ సమస్యలపై సాంకేతిక & వ్యవసాయ నిపుణుల సహాయం'
                      : 'Direct technical, hardware, disease diagnosis & agronomic support for farmers')}
              </p>
            </div>
          </div>

          {/* Quick AI Copilot / Assistant Shortcut */}
          <button
            type="button"
            onClick={() => navigate(isEquipmentProvider ? '/provider/dashboard?tab=copilot' : '/assistant')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black text-white shadow-md active:scale-95 transition-all cursor-pointer self-start sm:self-auto ${
              isEquipmentProvider ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/25' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>{isEquipmentProvider ? (isTe ? 'మెషినరీ AI కోపైలట్' : 'Machinery AI Copilot') : t('support_page.ask_ai', isTe ? 'ఏఐ నిపుణుడిని అడగండి' : 'Ask AI Agronomist')}</span>
          </button>
        </div>
      </div>

      {/* ═══════ 2. EMERGENCY HELPLINES BANNER ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Helpline 1 */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-md flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-emerald-100">
              {isEquipmentProvider 
                ? (isTe ? 'ప్రొవైడర్ డిస్పాచ్ హెల్ప్‌లైన్' : 'Provider Dispatch 24x7') 
                : (isTe ? 'జాతీయ ఉచిత హెల్ప్‌లైన్' : 'National Toll-Free 24x7')}
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
              {isEquipmentProvider ? supportConfig.support_phone : '1800-180-1551'}
            </h3>
            <p className="text-xs text-emerald-100 font-medium">
              {isEquipmentProvider
                ? (isTe ? 'అగ్రిషీల్డ్ మెషినరీ ఆపరేషన్స్ & డిస్పాచ్ డెస్క్' : 'AgriShield Machinery & Fleet Operations Desk')
                : t('support_page.kisan_call_center', isTe ? 'కిసాన్ కాల్ సెంటర్ (భారత ప్రభుత్వం)' : 'Kisan Call Centre (Govt. of India)')}
            </p>
          </div>
          <a
            href={`tel:${(isEquipmentProvider ? supportConfig.support_phone : '18001801551').replace(/[^0-9+]/g, '')}`}
            className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-white/90 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 shrink-0 transition-all"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>{t('support_page.call_free', isTe ? 'కాల్ చేయండి' : 'Call Free')}</span>
          </a>
        </div>

        {/* Helpline 2 */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-md border border-slate-700 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              {isEquipmentProvider
                ? (isTe ? 'ప్రభుత్వ SMAM సబ్సిడీ డెస్క్' : 'Govt. SMAM Subsidy Desk')
                : (isTe ? 'ఆంధ్రప్రదేశ్ & తెలంగాణ' : 'AP & Telangana RBK')}
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1 text-emerald-400">
              {isEquipmentProvider ? '1800-180-1551' : '1907'}
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              {isEquipmentProvider
                ? (isTe ? 'కస్టమ్ హైరింగ్ సెంటర్ (CHC) సబ్సిడీ విచారణ' : 'Custom Hiring Center (CHC) Machinery Subsidy')
                : (isTe ? 'రైతు భరోసా కేంద్రం (ప్రత్యక్ష సహాయం)' : 'Rythu Bharosa Kendram Extension Line')}
            </p>
          </div>
          <a
            href={isEquipmentProvider ? "tel:18001801551" : "tel:1907"}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 shrink-0 transition-all"
          >
            <PhoneCall className="w-4 h-4" />
            <span>{isEquipmentProvider ? (isTe ? 'సబ్సిడీ హెల్ప్‌లైన్' : 'Dial Helpline') : (isTe ? '1907 కు కాల్' : 'Dial 1907')}</span>
          </a>
        </div>
      </div>

      {/* ═══════ 3. TAB SELECTOR: CONTACT CHANNELS | MY TICKETS | FAQS ═══════ */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveSection('contact')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'contact'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('support_page.contact_support', isTe ? 'మద్దతు మార్గాలు (Contact)' : 'Contact Support')}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('my-tickets')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'my-tickets'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('support_page.my_tickets', isTe ? 'నా ఫిర్యాదులు (My Tickets)' : 'My Support Tickets')}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('faqs')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'faqs'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('support_page.faq_title', isTe ? 'తరచుగా అడిగే ప్రశ్నలు (FAQ)' : 'Instant Help & FAQ')}
        </button>
      </div>

      {/* ═══════ SECTION A: CONTACT CHANNELS ═══════ */}
      {activeSection === 'contact' && (
        <div className="space-y-6">
          {/* Fast Support Cards (WhatsApp & 15-Min Callback) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. WhatsApp Instant Support Desk */}
            <div className="p-5 rounded-3xl human-card bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('support_page.whatsapp_advisory', isTe ? 'వాట్సాప్ ఇన్‌స్టంట్ హెల్ప్‌డెస్క్' : 'WhatsApp Instant Helpdesk')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isTe
                    ? 'మీ సమస్య వివరాలతో ఆటో-ఫిల్ అయిన వాట్సాప్ మెసేజ్ ద్వారా మా సపోర్ట్ ఆఫీసర్‌తో నేరుగా చాట్ చేయండి.'
                    : 'Chat directly with an AgriShield agronomist on WhatsApp with pre-filled farm diagnostics.'}
                </p>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  <span>📱 WA: {supportConfig.whatsapp_number}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWhatsAppSupport}
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t('support_page.chat_on_whatsapp', isTe ? 'వాట్సాప్‌లో చాట్ చేయండి' : 'Chat on WhatsApp Now')}</span>
              </button>
            </div>

            {/* 2. Request a 15-Minute Phone Callback */}
            <div className="p-5 rounded-3xl human-card bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-600 flex items-center justify-center">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('support_page.request_callback', isTe ? '15 నిమిషాల్లో కాల్‌బ్యాక్ అభ్యర్థించండి' : 'Request a 15-Minute Callback')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isTe
                    ? 'టైప్ చేయడం కంటే మాట్లాడటం ఇష్టపడే రైతులకు. మా అధికారి 15 నిమిషాల్లో మీ ఫోన్‌కు నేరుగా కాల్ చేస్తారు.'
                    : 'Preferred by field farmers. An agricultural technician will call your phone within 15 minutes.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCallbackOpen(true)}
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isTe ? 'నాకు కాల్ చేయండి' : 'Request Callback'}</span>
              </button>
            </div>
          </div>

          {/* In-App Support Ticket Submission Form */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              {isEquipmentProvider ? <Wrench className="w-5 h-5 text-indigo-600" /> : <FileText className="w-5 h-5 text-emerald-600" />}
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {isEquipmentProvider
                    ? (isTe ? 'మెషినరీ, బుకింగ్ లేదా అద్దె చెల్లింపు టికెట్ నమోదు' : 'Submit a Machinery, Booking or Payout Ticket')
                    : t('support_page.submit_ticket', isTe ? 'సాంకేతిక సమస్య లేదా సలహా టికెట్ నమోదు' : 'Submit a Technical or Agronomy Ticket')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isEquipmentProvider
                    ? (isTe ? 'ఫ్లీట్ లిస్టింగ్ సమస్యలు, రైతు బుకింగ్ వివాదాలు లేదా చెల్లింపులపై అధికారిక టికెట్ సమర్పించండి' : 'Report fleet listing issues, farmer booking disputes, or payment settlements')
                    : (isTe ? 'హార్డ్‌వేర్, సెన్సార్, పంట లేదా యాప్ సమస్యలపై వివరణాత్మక టికెట్ సమర్పించండి' : 'Report hardware faults, crop scan reviews, or account issues')}
                </p>
              </div>
            </div>

            {ticketSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{ticketSuccess}</span>
              </div>
            )}

            {ticketError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ticketError}</span>
              </div>
            )}

            <form onSubmit={handleTicketSubmit} className="space-y-4 text-xs">
              {/* Wall 4: Ghost Bot Trap */}
              <input
                type="text"
                name="bot_trap"
                value={botTrap}
                onChange={(e) => setBotTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }}
              />

              {/* 1. Quick-Select Category Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>{isEquipmentProvider ? (isTe ? 'ఫిర్యాదు వర్గం ఎంచుకోండి:' : 'Select Issue Category:') : (isTe ? 'సమస్య వర్గం:' : 'Select Issue Category:')}</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {activeCategories.length} {isTe ? 'వర్గాలు అందుబాటులో ఉన్నాయి' : 'Categories Available'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeCategories.map((cat) => {
                    const isSelected = ticketCategory === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setTicketCategory(cat.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                          isSelected
                            ? (isEquipmentProvider
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30'
                                : 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30')
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{isTe ? (cat.badge_te || cat.label_te) : (cat.badge_en || cat.label_en)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Dropdown & Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {t('support_page.category', isTe ? 'సమస్య వర్గం (Category):' : 'Issue Category:')}
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {activeCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {isTe ? cat.label_te : cat.label_en}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {isTe ? 'ప్రాధాన్యత (Priority Level):' : 'Priority Level:'}
                  </label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="low">{isTe ? '🟢 సాధారణం (Low - 48h)' : '🟢 Low (48h resolution)'}</option>
                    <option value="medium">{isTe ? '🟡 మధ్యస్థం (Medium - 24h)' : '🟡 Medium (24h resolution)'}</option>
                    <option value="high">{isTe ? '🟠 ఎక్కువ (High - 12h priority)' : '🟠 High (12h priority)'}</option>
                    <option value="urgent">{isTe ? '🔴 అత్యవసరం (Urgent field issue)' : '🔴 Urgent (Field emergency)'}</option>
                  </select>
                </div>
              </div>

              {/* 3. Interactive Reason Explainer Box */}
              {selectedCategoryMeta && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200/90 dark:border-emerald-800/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300 text-[11px] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{isTe ? 'ఈ వర్గాన్ని ఎందుకు ఎంచుకోవాలి? (Reason to Select):' : 'Why select this category? (Reason & Guidance):'}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    {isTe ? selectedCategoryMeta.reason_te : selectedCategoryMeta.reason_en}
                  </p>
                </div>
              )}

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">
                  {t('support_page.subject', isTe ? 'సమస్య శీర్షిక (Subject):' : 'Subject Summary:')}
                </label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder={
                    isEquipmentProvider
                      ? (isTe ? 'ఉదా: బుకింగ్ #BK-94812 రైతు పొలానికి రాలేదు' : 'e.g., Farmer absent for booking #BK-94812, or Rotavator payout delayed')
                      : (isTe ? 'ఉదా: ESP32 నోడ్ తేమ రీడింగ్ సరిగ్గా రావడం లేదు' : 'e.g., Soil moisture sensor fluctuating on ESP32 node')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Detailed Description */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">
                  {t('support_page.description', isTe ? 'సమస్య పూర్తి వివరణ (Description):' : 'Detailed Description:')}
                </label>
                <textarea
                  rows={4}
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder={
                    isEquipmentProvider
                      ? (isTe ? 'మీ యంత్రం, బుకింగ్ నంబర్, తేదీ/సమయం, రైతు వివరాలు మరియు మీకు కావాల్సిన పరిష్కారాన్ని వివరించండి...' : 'Describe the machinery, booking number, date/time, farmer details, and what resolution you require...')
                      : (isTe ? 'మీ పొలం పరిస్థితి, ఎప్పటి నుండి సమస్య ఉంది, మరియు ఎలాంటి సహాయం కావాలో వివరించండి...' : 'Describe what happened, any error messages, and what assistance you require...')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  required
                />
              </div>

              {/* Identifier (Machinery/Booking ID vs Hardware Node ID) & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {isEquipmentProvider
                      ? (isTe ? 'యంత్రం ID లేదా బుకింగ్ నంబర్ (#BK-XXXXX) (ఐచ్ఛికం):' : 'Machinery ID or Booking Reference (#BK-XXXXX) (Optional):')
                      : (isTe ? 'హార్డ్‌వేర్ పరికరం ID (ఐచ్ఛికం):' : 'Hardware Node ID (Optional):')}
                  </label>
                  <input
                    type="text"
                    value={ticketDeviceId}
                    onChange={(e) => setTicketDeviceId(e.target.value)}
                    placeholder={isEquipmentProvider ? 'e.g., TRAC-01 or BK-94812' : 'e.g., ESP32-NODE-ALPHA'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {t('support_page.phone', isTe ? 'సంప్రదించాల్సిన ఫోన్ నంబర్:' : 'Contact Phone Number:')}
                  </label>
                  <input
                    type="tel"
                    value={ticketPhone}
                    onChange={(e) => setTicketPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={ticketSubmitting}
                className={`px-6 py-3 rounded-xl text-xs font-black text-white flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer ${
                  isEquipmentProvider
                    ? 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'
                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {ticketSubmitting 
                    ? (isTe ? 'నమోదవుతోంది...' : 'Submitting Ticket...') 
                    : (isTe ? 'టికెట్ సమర్పించండి' : 'Submit Support Ticket')}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ SECTION B: MY TICKETS LIST ═══════ */}
      {activeSection === 'my-tickets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isTe ? 'నా ప్రస్తుత ఫిర్యాదులు & అభ్యర్థనలు' : 'My Support Tickets & Callback Status'}</span>
            </h3>
            <button
              type="button"
              onClick={fetchMyTickets}
              disabled={loadingTickets}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className={`w-3 h-3 ${loadingTickets ? 'animate-spin' : ''}`} />
              <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
            </button>
          </div>

          {loadingTickets ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {isTe ? 'టికెట్లు లోడ్ అవుతున్నాయి...' : 'Loading support tickets...'}
            </div>
          ) : myTickets.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {isTe ? 'ఎలాంటి పెండింగ్ సమస్యలు లేవు!' : 'No Open Support Tickets'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {isTe
                  ? 'మీకు ఏవైనా ప్రశ్నలు లేదా సమస్యలు ఉంటే పైనున్న "మద్దతు మార్గాలు" ట్యాబ్ ద్వారా కొత్త టికెట్ లేదా కాల్‌బ్యాక్ అభ్యర్థించండి.'
                  : 'You do not have any open support complaints. Submit a ticket or request a callback anytime you need assistance.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTickets.map((tkt) => {
                const matchedCat = [...PROVIDER_CATEGORIES, ...FARMER_CATEGORIES].find(c => c.value === tkt.category);
                return (
                  <div
                    key={tkt.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          #{tkt.ticket_number}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          tkt.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : tkt.status === 'in_progress'
                            ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                        }`}>
                          {tkt.status === 'resolved' ? (isTe ? 'పరిష్కరించబడింది' : 'Resolved') : (tkt.status === 'in_progress' ? (isTe ? 'పరిశీలనలో ఉంది' : 'In Progress') : (isTe ? 'ఓపెన్' : 'Open'))}
                        </span>
                        {matchedCat && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {matchedCat.icon} {isTe ? (matchedCat.badge_te || matchedCat.label_te) : (matchedCat.badge_en || matchedCat.label_en)}
                          </span>
                        )}
                        {tkt.is_callback_request && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-600 border border-sky-500/30">
                            15-Min Call
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(tkt.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {tkt.subject}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {tkt.description}
                      </p>
                    </div>

                    {tkt.device_id && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isEquipmentProvider ? <Truck className="w-3.5 h-3.5 text-indigo-600" /> : <Cpu className="w-3.5 h-3.5 text-cyan-600" />}
                        <span>Reference: <code>{tkt.device_id}</code></span>
                      </div>
                    )}

                    {/* Resolution Notes from Support Engineer */}
                    {tkt.resolution_notes && (
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                          {isTe ? 'సపోర్ట్ బృందం పరిష్కార వివరాలు (Support Resolution):' : 'Support Resolution Note:'}
                        </span>
                        <p className="font-medium leading-relaxed">{tkt.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ SECTION C: FAQS ACCORDION ═══════ */}
      {activeSection === 'faqs' && (
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isEquipmentProvider ? (isTe ? 'ప్రొవైడర్లకు తక్షణ సమాధానాలు & మార్గదర్శకాలు' : 'Provider Instant Solutions & Guidelines') : (isTe ? 'రైతులకు తక్షణ సమాధానాలు & పరిష్కారాలు' : 'Instant Self-Help Solutions & FAQs')}</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {activeFaqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? -1 : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-black text-slate-900 dark:text-white cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaqIndex === idx ? (
                    <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaqIndex === idx && (
                  <div className="p-4 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ MODAL: 15-MINUTE PHONE CALLBACK ═══════ */}
      <AnimatePresence>
        {isCallbackOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/15 text-sky-600">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black">
                      {isEquipmentProvider 
                        ? (isTe ? '15 నిమిషాల్లో ప్రొవైడర్ కాల్‌బ్యాక్ అభ్యర్థించండి' : 'Request a 15-Minute Operations Callback')
                        : t('support_page.request_callback', isTe ? '15 నిమిషాల్లో కాల్‌బ్యాక్ అభ్యర్థించండి' : 'Request a 15-Minute Callback')}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isEquipmentProvider
                        ? (isTe ? 'మా మెషినరీ ఆపరేషన్స్ మేనేజర్ మీతో నేరుగా మాట్లాడతారు' : 'Speak directly with our machinery operations manager')
                        : (isTe ? 'మా వ్యవసాయ అధికారి మీతో నేరుగా మాట్లాడతారు' : 'Speak directly with our agricultural specialist')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCallbackOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {callbackSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p>{callbackSuccess}</p>
                </div>
              ) : (
                <form onSubmit={handleCallbackSubmit} className="space-y-3.5 text-xs">
                  {/* Wall 4: Ghost Bot Trap */}
                  <input
                    type="text"
                    name="bot_trap"
                    value={botTrap}
                    onChange={(e) => setBotTrap(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }}
                  />
                  <div className="space-y-1.5">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">
                      {isTe ? 'మీ ఫోన్ నంబర్:' : 'Your Phone Number:'}
                    </label>
                    <input
                      type="tel"
                      value={callbackPhone}
                      onChange={(e) => setCallbackPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">
                      {isTe ? 'మీరు మాట్లాడాలనుకునే భాష:' : 'Preferred Language for Call:'}
                    </label>
                    <select
                      value={callbackLang}
                      onChange={(e) => setCallbackLang(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="te">తెలుగు (Telugu)</option>
                      <option value="en">English</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                      <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">
                      {isTe ? 'సమస్య క్లుప్తంగా (ఐచ్ఛికం):' : 'Brief Issue (Optional):'}
                    </label>
                    <input
                      type="text"
                      value={callbackIssue}
                      onChange={(e) => setCallbackIssue(e.target.value)}
                      placeholder={
                        isEquipmentProvider
                          ? (isTe ? 'ఉదా: ట్రాక్టర్ బుకింగ్ వివాదం లేదా అత్యవసర అద్దె చెల్లింపు' : 'e.g., Tractor booking dispute or urgent payout settlement')
                          : (isTe ? 'ఉదా: టమోటా పంట ఆకులపై మచ్చలు, పిచికారీ సలహా' : 'e.g., Tomato leaf blight, spray advice required')
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={callbackSubmitting}
                    className="w-full py-3 px-4 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer mt-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{callbackSubmitting ? (isTe ? 'నమోదవుతోంది...' : 'Submitting...') : (isTe ? 'కాల్‌బ్యాక్ నిర్ధారించండి' : 'Confirm Callback Request')}</span>
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
