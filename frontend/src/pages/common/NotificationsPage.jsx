import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell, Search, Trash2, CheckCheck, Filter, RefreshCw,
  AlertTriangle, CloudRain, Droplets, BatteryWarning,
  WifiOff, Activity, ChevronDown, ChevronLeft, ChevronRight, X, BellOff, Download, Clock, Check,
  Settings, Volume2, VolumeX, ShieldAlert, Sparkles, SlidersHorizontal, MessageSquare, Truck, Phone,
  CheckCircle2, Sprout, ArrowRight, User, Plus, Send, ExternalLink, Headphones, Wrench
} from 'lucide-react';
import { Card, Button, Input, Select, Badge, Dialog, EmptyState, Skeleton, Switch } from '../../components/ui/index';
import API from '../../services/api';
import axios from 'axios';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import { timeAgo, formatDateTime, parseServerDate } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { translateNotification } from '../../utils/notificationTranslator';
import GoogleMessageReader from '../../components/common/GoogleMessageReader';
import { getDeletedNotificationIds, saveDeletedNotificationId } from '../../utils/equipmentDeduplication';
import { recordCrossDeviceDeletion } from '../../services/crossDeviceSync';

// ── Dynamic Crop Extraction & Localization Helper ──
function extractCropInfo(item, isTe = false) {
  if (!item) {
    return {
      cropKey: 'crop',
      cropName: isTe ? 'పంట' : 'Crop',
      cropEmoji: '🌿',
      diseaseName: null,
      threadTitle: isTe ? '🌿 పంట రక్షణ సలహా' : '🌿 Crop Health Advisory',
      categoryLabel: isTe ? 'పంట సలహా' : 'Crop Advisory'
    };
  }

  const rawText = `${item.crop_name || ''} ${item.crop || ''} ${item.crop_type || ''} ${item.title || ''} ${item.title_te || ''} ${item.message || ''} ${item.message_te || ''}`.toLowerCase();

  const CROPS = [
    { key: 'chilli', en: 'Chilli', te: 'మిరప', emoji: '🌶️', regex: /(chilli|chili|pepper|మిరప|mirapa)/i },
    { key: 'maize', en: 'Maize', te: 'మొక్కజొన్న', emoji: '🌽', regex: /(maize|corn|మొక్కజొన్న|mokkajonna)/i },
    { key: 'tomato', en: 'Tomato', te: 'టమాటా', emoji: '🍅', regex: /(tomato|టమాటా|టమాట|tamata)/i },
    { key: 'paddy', en: 'Paddy', te: 'వరి', emoji: '🌾', regex: /(paddy|rice|వరి|vari)/i },
    { key: 'cotton', en: 'Cotton', te: 'పత్తి', emoji: '🧶', regex: /(cotton|పత్తి|patti)/i },
    { key: 'groundnut', en: 'Groundnut', te: 'వేరుశనగ', emoji: '🥜', regex: /(groundnut|peanut|వేరుశనగ|verusanaga)/i },
    { key: 'sugarcane', en: 'Sugarcane', te: 'చెరకు', emoji: '🎋', regex: /(sugarcane|చెరకు|cheraku)/i },
    { key: 'banana', en: 'Banana', te: 'అరటి', emoji: '🍌', regex: /(banana|అరటి|arati)/i },
    { key: 'mango', en: 'Mango', te: 'మామిడి', emoji: '🥭', regex: /(mango|మామిడి|mamidi)/i },
    { key: 'onion', en: 'Onion', te: 'ఉల్లి', emoji: '🧅', regex: /(onion|ఉల్లి|ulli)/i },
    { key: 'potato', en: 'Potato', te: 'బంగాళాదుంప', emoji: '🥔', regex: /(potato|బంగాళాదుంప|bangaladumpa)/i },
    { key: 'soybean', en: 'Soybean', te: 'సోయాబీన్', emoji: '🫘', regex: /(soybean|soya|సోయా)/i },
    { key: 'wheat', en: 'Wheat', te: 'గోధుమ', emoji: '🌾', regex: /(wheat|గోధుమ|godhuma)/i },
    { key: 'grape', en: 'Grape', te: 'ద్రాక్ష', emoji: '🍇', regex: /(grape|ద్రాక్ష|draksha)/i },
    { key: 'citrus', en: 'Citrus', te: 'నిమ్మ', emoji: '🍋', regex: /(citrus|lemon|lime|నిమ్మ|nimma)/i },
  ];

  const matchedCrop = CROPS.find(c => c.regex.test(rawText));

  const DISEASES = [
    { key: 'early_blight', en: 'Early Blight', te: 'ఎర్లీ బ్లైట్', regex: /(early blight|ఎర్లీ బ్లైట్)/i },
    { key: 'late_blight', en: 'Late Blight', te: 'లేట్ బ్లైట్', regex: /(late blight|లేట్ బ్లైట్)/i },
    { key: 'leaf_spot', en: 'Leaf Spot', te: 'ఆకు మచ్చతెగులు', regex: /(leaf spot|cercospora|ఆకు మచ్చ|మచ్చతెగులు)/i },
    { key: 'powdery_mildew', en: 'Powdery Mildew', te: 'బూడిద తెగులు', regex: /(powdery mildew|బూడిద తెగులు)/i },
    { key: 'rust', en: 'Rust', te: 'తుప్పు తెగులు', regex: /(rust|తుప్పు)/i },
    { key: 'wilt', en: 'Wilt', te: 'ఎండు తెగులు', regex: /(wilt|fusarium|ఎండు తెగులు)/i },
    { key: 'bacterial_blight', en: 'Bacterial Blight', te: 'బాక్టీరియల్ బ్లైట్', regex: /(bacterial blight|బాక్టీరియల్ బ్లైట్)/i },
    { key: 'blast', en: 'Blast', te: 'అగ్గి తెగులు', regex: /(blast|magnaporthe|అగ్గి తెగులు)/i },
    { key: 'spodoptera', en: 'Caterpillar', te: 'లద్దెపురుగు', regex: /(spodoptera|caterpillar|cutworm|లద్దెపురుగు)/i }
  ];

  const matchedDisease = DISEASES.find(d => d.regex.test(rawText));

  if (matchedCrop) {
    const cropName = isTe ? matchedCrop.te : matchedCrop.en;
    let title = '';
    if (matchedDisease) {
      const diseaseName = isTe ? matchedDisease.te : matchedDisease.en;
      title = `${matchedCrop.emoji} ${cropName} • ${diseaseName}`;
    } else {
      title = isTe ? `${matchedCrop.emoji} ${cropName} పంట సలహా` : `${matchedCrop.emoji} ${cropName} Crop Advisory`;
    }
    return {
      cropKey: matchedCrop.key,
      cropName,
      cropEmoji: matchedCrop.emoji,
      diseaseName: matchedDisease ? (isTe ? matchedDisease.te : matchedDisease.en) : null,
      threadTitle: title,
      categoryLabel: isTe ? `${cropName} సలహా` : `${cropName} Alert`
    };
  }

  return {
    cropKey: 'crop',
    cropName: isTe ? 'పంట' : 'Crop',
    cropEmoji: '🌿',
    diseaseName: matchedDisease ? (isTe ? matchedDisease.te : matchedDisease.en) : null,
    threadTitle: isTe ? '🌿 పంట రక్షణ సలహా' : '🌿 Crop Health Advisory',
    categoryLabel: isTe ? 'పంట సలహా' : 'Crop Advisory'
  };
}

// ── Google Messages High-Contrast Color Coding ──
// Emerald for Provider, Amber for Crop Alert, Blue for Weather, Orange for Support
const THREAD_THEMES = {
  provider: {
    avatarBg: 'bg-emerald-500 text-white ring-2 ring-emerald-200 dark:ring-emerald-900 shadow-sm',
    badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotBg: 'bg-emerald-500',
    Icon: Truck,
    defaultSender: 'Ramesh Farm Machinery Service',
    defaultSenderTe: 'రమేష్ ఫార్మ్ సర్వీసెస్'
  },
  disease: {
    avatarBg: 'bg-amber-500 text-white ring-2 ring-amber-200 dark:ring-amber-900 shadow-sm',
    badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dotBg: 'bg-amber-500',
    Icon: AlertTriangle,
    defaultSender: 'Crop Health Advisory',
    defaultSenderTe: 'పంట రక్షణ సలహా'
  },
  weather: {
    avatarBg: 'bg-blue-600 text-white ring-2 ring-blue-200 dark:ring-blue-900 shadow-sm',
    badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dotBg: 'bg-blue-600',
    Icon: CloudRain,
    defaultSender: 'AgriShield Weather Station',
    defaultSenderTe: 'అగ్రిషీల్డ్ వాతావరణం'
  },
  support: {
    avatarBg: 'bg-orange-500 text-white ring-2 ring-orange-200 dark:ring-orange-900 shadow-sm',
    badgeBg: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    dotBg: 'bg-orange-500',
    Icon: ShieldAlert,
    defaultSender: 'AgriShield Kisan Helpdesk',
    defaultSenderTe: 'అగ్రిషీల్డ్ కిసాన్ హెల్ప్‌డెస్క్'
  }
};

const PRIORITY_BADGES = {
  Critical: { bg: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800', dot: 'bg-rose-500' },
  High:     { bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', dot: 'bg-amber-500' },
  Medium:   { bg: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800', dot: 'bg-sky-500' },
  Low:      { bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', dot: 'bg-slate-400' },
};

/**
 * Format timestamp in Google Messages native style:
 * "Just now", "10 min", "15 min", "1 hr", "Yesterday", "Oct 12"
 */
function formatGoogleMessagesTime(dateInput) {
  if (!dateInput) return '';
  const d = parseServerDate(dateInput) || new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return `${diffHours} hr`;
  }
  if (diffDays === 1 || (diffHours < 48 && d.getDate() === now.getDate() - 1)) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentLang = i18n.language || user?.preferred_language || localStorage.getItem('i18nextLng') || 'te';
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isEquipmentProvider = user?.role?.toLowerCase() === 'equipment_provider';
  const isTe = i18n?.language === 'te' || currentLang.startsWith('te');

  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = React.useRef(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Selected Notification Dialog (Google Message Reader / 2-way View)
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchParams] = useSearchParams();

  // Auto-open requested notification or booking chat from URL query parameter
  useEffect(() => {
    const targetBookingId = searchParams.get('bookingId') || searchParams.get('booking_id');
    const targetNotifId = searchParams.get('id') || searchParams.get('notification_id');
    if ((targetBookingId || targetNotifId) && notifications.length > 0) {
      const match = notifications.find(n =>
        (targetBookingId && (n.booking_id === targetBookingId || n.bookingId === targetBookingId || n.id === targetBookingId || `BK-${n.id}` === targetBookingId)) ||
        (targetNotifId && (n.notification_id === targetNotifId || n.id === targetNotifId))
      );
      if (match) {
        setSelectedMessage(match);
      }
    }
  }, [searchParams, notifications]);

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertSettings, setAlertSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_alert_settings');
      return saved ? JSON.parse(saved) : {
        disease: true,
        weather: true,
        battery: true,
        irrigation: true,
        sound: true
      };
    } catch {
      return { disease: true, weather: true, battery: true, irrigation: true, sound: true };
    }
  });

  const handleSaveAlertSettings = (newSettings) => {
    setAlertSettings(newSettings);
    localStorage.setItem('agrishield_alert_settings', JSON.stringify(newSettings));
    setToastMsg(t('notifications_page.settings_saved', 'Notification preferences updated!'));
  };

  const getReadIds = useCallback(() => {
    try {
      const raw = localStorage.getItem('agrishield_read_notification_ids');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }, []);

  const saveReadIds = useCallback((idsSet) => {
    try {
      localStorage.setItem('agrishield_read_notification_ids', JSON.stringify(Array.from(idsSet)));
    } catch (_) {}
  }, []);

  // Fetch and hydrate notifications with strict role-based isolation & unified conversation grouping
  const fetchNotifications = useCallback(async (isSilent = false) => {
    // Only show full-screen skeleton on the very first mount when the list is completely empty
    if (!isSilent && !hasLoadedOnceRef.current && notifications.length === 0) {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (priority !== 'All') params.set('priority', priority);

      const readIds = getReadIds();
      const deletedNotifIds = getDeletedNotificationIds();

      let serverNotifs = [];
      try {
        const res = await API.get(`/api/v1/notifications?${params}`);
        serverNotifs = (res.data.notifications || [])
          .filter(sn => {
            const sId = sn.notification_id || sn.id || sn._id;
            return !deletedNotifIds.has(sId) && !deletedNotifIds.has(String(sId));
          })
          .map(sn => {
            const sId = sn.notification_id || sn.id || sn._id;
            return (readIds.has(sId) || readIds.has(String(sId))) ? { ...sn, read: true } : sn;
          });

        // Strict role filtering for server notifications:
        // Equipment providers MUST NEVER receive crop diseases, soil moisture, or weather alerts!
        if (isEquipmentProvider) {
          serverNotifs = serverNotifs.filter(sn => {
            const cat = (sn.category || '').toLowerCase();
            const title = (sn.title || '').toLowerCase();
            const msg = (sn.message || '').toLowerCase();
            const isAgronomic = cat === 'soil' || cat === 'disease' || cat === 'weather' || cat === 'crop' || cat === 'irrigation' ||
              title.includes('soil moisture') || title.includes('irrigation') || title.includes('crop health') || title.includes('నేల తేమ') ||
              msg.includes('soil moisture') || msg.includes('recommended irrigation') || msg.includes('తేమ');
            return !isAgronomic;
          });
        }
      } catch (err) {
        console.warn("Could not fetch remote notifications, falling back to local:", err);
      }

      // Load local notifications with strict role-based isolation:
      // Farmers must NEVER receive "New Machinery Booking Received" or incoming requests.
      // Equipment providers must NEVER receive soil moisture drops, pest advisories, or weather forecasts.
      let localNotifs = [];
      try {
        const savedUserNotifs = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        if (Array.isArray(savedUserNotifs)) {
          if (!isEquipmentProvider) {
            // Display only farmer-directed notifications without wiping out provider notifications in shared storage
            localNotifs = savedUserNotifs.filter(n => {
              if (n.target_role === 'equipment_provider' || n.role === 'equipment_provider') return false;
              const title = (n.title || '').toLowerCase();
              const msg = (n.message || '').toLowerCase();
              const isIncomingOrder = title.includes('కొత్త యంత్ర బుకింగ్') ||
                                     title.includes('new machinery booking') ||
                                     title.includes('booking request') ||
                                     msg.includes('booked your') ||
                                     msg.includes('బుక్ చేసుకున్నారు');
              return !isIncomingOrder;
            });
          } else {
            // Clean up any rogue soil moisture or agronomic alerts that were previously saved in provider storage
            const cleaned = savedUserNotifs.filter(n => {
              const cat = (n.category || '').toLowerCase();
              const title = (n.title || '').toLowerCase();
              const msg = (n.message || '').toLowerCase();
              const isAgronomic = cat === 'soil' || cat === 'disease' || cat === 'weather' || cat === 'crop' || cat === 'irrigation' ||
                title.includes('soil moisture') || title.includes('irrigation') || title.includes('crop health') || title.includes('నేల తేమ') ||
                msg.includes('soil moisture') || msg.includes('recommended irrigation') || msg.includes('తేమ');
              return !isAgronomic;
            });
            if (cleaned.length !== savedUserNotifs.length) {
              try { localStorage.setItem('agrishield_user_notifications', JSON.stringify(cleaned)); } catch (_) {}
            }

            // Display notifications intended for equipment providers (strictly exclude farmer soil, disease, and weather alerts)
            localNotifs = cleaned.filter(n => {
              if (n.target_role === 'farmer' && (n.type === 'booking_status' || n.category === 'booking_status')) return false;
              return true;
            });
          }

          // Purge any notification that was deleted by the user
          localNotifs = localNotifs.filter(n => {
            const nId = n.notification_id || n.id;
            const bId = n.booking_id;
            if (deletedNotifIds.has(nId) || deletedNotifIds.has(String(nId))) return false;
            if (bId && (deletedNotifIds.has(`notif-${bId}`) || deletedNotifIds.has(bId) || deletedNotifIds.has(`farmer-notif-${bId}-confirmed`))) return false;
            return true;
          });

          localNotifs = localNotifs.map(ln => {
            const lId = ln.notification_id || ln.id || ln.booking_id;
            const isRead = readIds.has(lId) || (ln.booking_id && (readIds.has(`booking-${ln.booking_id}`) || readIds.has(ln.booking_id)));
            return isRead ? { ...ln, read: true } : ln;
          });
        }
      } catch (e) {}

      // If equipment provider, synthesize notifications from recorded machinery bookings (With Blacklist Protection)
      if (isEquipmentProvider) {
        try {
          let bookings = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]')
            .filter(b => b && !String(b.id || '').startsWith('BK-TEST-') && !String(b.bookingId || '').startsWith('BK-TEST-'));
          try {
            let bRes = await API.get('/api/v1/equipment/bookings');
            if (!bRes.data || typeof bRes.data !== 'object' || !Array.isArray(bRes.data.bookings)) {
              try { bRes = await API.get('/api/equipment/bookings'); } catch (_) {}
            }
            if (!bRes.data || typeof bRes.data !== 'object' || !Array.isArray(bRes.data.bookings)) {
              try { bRes = await axios.get('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings', { timeout: 15000 }); } catch (_) {}
            }
            if (bRes.data?.bookings && Array.isArray(bRes.data.bookings)) {
              const bMap = new Map();
              bRes.data.bookings
                .filter(b => b && !String(b.id || '').startsWith('BK-TEST-') && !String(b.bookingId || '').startsWith('BK-TEST-'))
                .forEach(b => { if (b && b.id) bMap.set(b.id, b); });
              bookings.forEach(b => { if (b && b.id && !bMap.has(b.id)) bMap.set(b.id, b); });
              bookings = Array.from(bMap.values());
            }
          } catch (e) {}

          if (Array.isArray(bookings)) {
            bookings.forEach((b) => {
              const bId = b.id || `BK-${Math.floor(10000 + Math.random() * 90000)}`;
              const notifKey = `notif-${bId}`;
              // Permanent Blacklist check: never resurrect if deleted by provider
              if (deletedNotifIds.has(notifKey) || deletedNotifIds.has(bId) || deletedNotifIds.has(`BK-${bId}`)) {
                return;
              }
              const alreadyExists = localNotifs.some(n => n.booking_id === bId || n.id === `notif-${bId}` || n.notification_id === `notif-${bId}`);
              const isAlreadyRead = readIds.has(`notif-${bId}`) || readIds.has(bId) || readIds.has(`booking-${bId}`) || b.status === 'completed';
              if (!alreadyExists) {
                localNotifs.push({
                  notification_id: `notif-${bId}`,
                  id: `notif-${bId}`,
                  type: 'booking',
                  category: 'booking',
                  priority: 'High',
                  title: isTe ? `🚜 కొత్త యంత్ర బుకింగ్ వచ్చింది (#${bId})` : `🚜 New Machinery Booking Received (#${bId})`,
                  title_te: `🚜 కొత్త యంత్ర బుకింగ్ వచ్చింది (#${bId})`,
                  message: isTe
                    ? `${b.farmerName || 'రైతు'} గారు మీ ${b.equipmentTitle || b.title || 'యంత్రం'} బుక్ చేసుకున్నారు (${b.acres || b.acreage || '2'} ఎకరాలు, ${b.village || 'పొలం'}). మొత్తం: ₹${b.totalCost || '800'}. ఫోన్: ${b.farmerPhone || b.phone || b.contactPhone || '9440182736'}.`
                    : `Farmer ${b.farmerName || 'Farmer'} booked your ${b.equipmentTitle || b.title || 'Machinery'} (${b.acres || b.acreage || '2'} Acres, ${b.village || 'Field'}). Total: ₹${b.totalCost || '800'}. Phone: ${b.farmerPhone || b.phone || b.contactPhone || '9440182736'}.`,
                  message_te: `${b.farmerName || 'రైతు'} గారు మీ ${b.equipmentTitle || b.title || 'యంత్రం'} బుక్ చేసుకున్నారు (${b.acres || b.acreage || '2'} ఎకరాలు, ${b.village || 'పొలం'}). మొత్తం: ₹${b.totalCost || '800'}. ఫోన్: ${b.farmerPhone || b.phone || b.contactPhone || '9440182736'}.`,
                  booking_id: bId,
                  farmerName: b.farmerName || 'Local Farmer',
                  farmerPhone: b.farmerPhone || b.phone || b.contactPhone || '9440182736',
                  phone: b.farmerPhone || b.phone || b.contactPhone || '9440182736',
                  equipmentTitle: b.equipmentTitle || b.title || 'Farm Machinery',
                  totalCost: b.totalCost || '800',
                  created_at: b.createdAt || new Date().toISOString(),
                  timestamp: b.createdAt || new Date().toISOString(),
                  read: isAlreadyRead
                });
              }
            });
          }
        } catch (e) {}
      }

      // If farmer, synthesize notifications ONLY for provider Accept or Decline status decisions (With Blacklist Protection)
      if (!isEquipmentProvider) {
        try {
          let bRes = await API.get('/api/v1/equipment/bookings');
          if (!bRes.data || typeof bRes.data !== 'object' || !Array.isArray(bRes.data.bookings)) {
            try { bRes = await API.get('/api/equipment/bookings'); } catch (_) {}
          }
          if (bRes.data?.bookings && Array.isArray(bRes.data.bookings)) {
            bRes.data.bookings.forEach((b) => {
              if (b && (b.status === 'rejected' || b.status === 'declined' || b.status === 'confirmed')) {
                const bId = b.id || b.bookingId;
                const notifKey = `farmer-notif-${bId}-${b.status}`;
                // Permanent Blacklist check: never resurrect if deleted by farmer
                if (deletedNotifIds.has(notifKey) || deletedNotifIds.has(`farmer-notif-${bId}`) || deletedNotifIds.has(bId) || deletedNotifIds.has(`BK-${bId}`)) {
                  return;
                }
                const alreadyExists = localNotifs.some(n => n.id === notifKey || n.notification_id === notifKey);
                const isAlreadyRead = readIds.has(notifKey) ||
                                     readIds.has(bId) ||
                                     readIds.has(`booking-${bId}`) ||
                                     readIds.has(`farmer-notif-${bId}-confirmed`) ||
                                     readIds.has(`farmer-notif-${bId}-rejected`) ||
                                     readIds.has(`farmer-notif-${bId}-declined`);
                if (!alreadyExists) {
                  const isRejected = b.status === 'rejected' || b.status === 'declined';
                  const providerPhoneNum = b.providerPhone || b.provider_phone || '9876543210';
                  const providerDisplayName = b.providerName || b.provider_name || 'Ramesh Farm Services';
                  localNotifs.unshift({
                    notification_id: notifKey,
                    id: notifKey,
                    type: 'booking',
                    category: 'booking',
                    priority: isRejected ? 'High' : 'Normal',
                    isFarmerDecision: true,
                    providerPhone: providerPhoneNum,
                    providerName: providerDisplayName,
                    farmerPhone: b.farmerPhone || b.phone,
                    farmerName: b.farmerName,
                    equipmentTitle: b.equipmentTitle || b.title || 'Machinery',
                    title: isRejected
                      ? (isTe ? `❌ యంత్రం బుకింగ్ తిరస్కరించబడింది (#${bId})` : `❌ Machinery Booking Declined (#${bId})`)
                      : (isTe ? `✅ యంత్రం బుకింగ్ ఆమోదించబడింది (#${bId})` : `✅ Machinery Booking Confirmed (#${bId})`),
                    title_te: isRejected
                      ? `❌ యంత్రం బుకింగ్ తిరస్కరించబడింది (#${bId})`
                      : `✅ యంత్రం బుకింగ్ ఆమోదించబడింది (#${bId})`,
                    message: isRejected
                      ? (isTe
                        ? `ప్రొవైడర్ ${providerDisplayName} మీ ${b.equipmentTitle || b.title || 'యంత్రం'} బుకింగ్‌ను తిరస్కరించారు (${b.date || b.bookingDate || 'Today'}). దయచేసి వేరే యంత్రాన్ని ఎంచుకోండి.`
                        : `Provider ${providerDisplayName} declined your booking for ${b.equipmentTitle || b.title || 'Machinery'} (${b.date || b.bookingDate || 'Today'}). Please choose an alternative machinery slot.`)
                      : (isTe
                        ? `ప్రొవైడర్ ${providerDisplayName} మీ ${b.equipmentTitle || b.title || 'యంత్రం'} బుకింగ్‌ను ఆమోదించారు! పని సమయం: ${b.slot || 'Early Morning'}.`
                        : `Provider ${providerDisplayName} confirmed your booking for ${b.equipmentTitle || b.title || 'Machinery'}! Service slot: ${b.slot || 'Early Morning'}.`),
                    message_te: isRejected
                      ? `ప్రొవైడర్ ${providerDisplayName} మీ ${b.equipmentTitle || b.title || 'యంత్రం'} బుకింగ్‌ను తిరస్కరించారు.`
                      : `ప్రొవైడర్ ${providerDisplayName} మీ ${b.equipmentTitle || b.title || 'యంత్రం'} బుకింగ్‌ను ఆమోదించారు!`,
                    booking_id: bId,
                    created_at: b.updatedAt || b.createdAt || new Date().toISOString(),
                    timestamp: b.updatedAt || b.createdAt || new Date().toISOString(),
                    read: isAlreadyRead,
                    action_url: '/equipment-booking'
                  });
                }
              }
            });
          }
        } catch (e) {}
      }

      // Persist read states back to storage without purging the other role's notifications
      try {
        const rawExisting = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        if (Array.isArray(rawExisting)) {
          const updatedRaw = rawExisting.map(n => {
            const nId = n.notification_id || n.id || n.booking_id;
            if (readIds.has(nId) || (n.booking_id && (readIds.has(`booking-${n.booking_id}`) || readIds.has(n.booking_id)))) {
              return { ...n, read: true };
            }
            return n;
          });
          localNotifs.forEach(ln => {
            const lnId = ln.notification_id || ln.id || ln.booking_id;
            if (!updatedRaw.some(n => (n.notification_id || n.id || n.booking_id) === lnId)) {
              updatedRaw.push(ln);
            }
          });
          localStorage.setItem('agrishield_user_notifications', JSON.stringify(updatedRaw));
        }
      } catch (_) {}

      // Merge local and server without duplicates
      const rawMerged = [...localNotifs];
      serverNotifs.forEach((sn) => {
        const snId = sn.notification_id || sn.id || sn._id;
        if (!rawMerged.some(m => (m.notification_id || m.id || m._id) === snId)) {
          rawMerged.push(sn);
        }
      });

      // ── CONVERSATION THREAD GROUPING (Issue 1) ──
      // Group multiple individual chat notifications for the same booking/conversation into ONE unified card
      const threadGroups = new Map();
      const standaloneNotifs = [];

      rawMerged.forEach(item => {
        const rawBId = item.booking_id || item.bookingId || item.id;
        const cleanBId = String(rawBId || '')
          .trim()
          .replace(/^notif-(?:stat-)?/, '')
          .replace(/^farmer-notif-/, '')
          .replace(/^notif-order-/, '')
          .replace(/^notif-chat-/, '')
          .replace(/^notif-/, '')
          .replace(/-(?:confirmed|rejected|declined|completed).*$/, '');

        const canonicalBId = cleanBId ? (cleanBId.startsWith('BK-') ? cleanBId : `BK-${cleanBId}`) : null;
        const isBookingOrChat = item.category === 'booking' ||
                               item.type === 'booking' ||
                               item.type === 'booking_chat' ||
                               item.type === 'booking_status' ||
                               Boolean(item.isFarmerDecision) ||
                               (item.id && (String(item.id).startsWith('notif-chat-') || String(item.id).startsWith('notif-stat-') || String(item.id).startsWith('farmer-notif-')));
        
        if (canonicalBId && isBookingOrChat) {
          const groupKey = `booking_thread_${canonicalBId}`;
          if (!threadGroups.has(groupKey)) {
            threadGroups.set(groupKey, []);
          }
          threadGroups.get(groupKey).push({ ...item, canonicalBookingId: canonicalBId });
        } else {
          standaloneNotifs.push(item);
        }
      });

      const consolidatedThreads = [];
      threadGroups.forEach((items, groupKey) => {
        // Sort items inside this thread by timestamp descending (newest first)
        items.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));
        const latest = items[0];
        const unreadItems = items.filter(it => !it.read);
        const unreadCount = unreadItems.length;
        const allIds = Array.from(new Set(items.flatMap(it => [it.notification_id, it.id, it._id]).filter(Boolean)));
        const threadBId = latest.canonicalBookingId || latest.booking_id || groupKey.replace('booking_thread_', '');

        consolidatedThreads.push({
          ...latest,
          id: latest.id || `thread-${threadBId}`,
          notification_id: latest.notification_id || `thread-${threadBId}`,
          booking_id: threadBId,
          bookingId: threadBId,
          isThread: true,
          threadCount: items.length,
          threadUnreadCount: unreadCount,
          threadItemIds: allIds,
          threadItems: items,
          read: unreadCount === 0,
          // Show newest message
          message: latest.message,
          title: latest.title,
          timestamp: latest.created_at || latest.timestamp
        });
      });

      const finalMerged = [...consolidatedThreads, ...standaloneNotifs];
      finalMerged.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));

      setNotifications(finalMerged);
      setTotal(finalMerged.length);
    } catch {
      setToastMsg(t('notifications_page.toast.load_failed', 'Failed to load notifications.'));
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [t, isEquipmentProvider, isTe, getReadIds, priority]);

  useEffect(() => {
    // Initial fetch
    fetchNotifications(false);

    // Silent background revalidations (Stale-While-Revalidate pattern: zero skeleton blinking)
    let revalidateTimer;
    const debouncedSilentFetch = () => {
      clearTimeout(revalidateTimer);
      revalidateTimer = setTimeout(() => {
        fetchNotifications(true);
      }, 300);
    };

    const handleRevalidateNotifs = () => {
      if (document.visibilityState === 'visible') debouncedSilentFetch();
    };

    window.addEventListener('agrishield_notifications_updated', debouncedSilentFetch);
    window.addEventListener('storage', debouncedSilentFetch);
    window.addEventListener('focus', debouncedSilentFetch);
    document.addEventListener('visibilitychange', handleRevalidateNotifs);

    return () => {
      clearTimeout(revalidateTimer);
      window.removeEventListener('agrishield_notifications_updated', debouncedSilentFetch);
      window.removeEventListener('storage', debouncedSilentFetch);
      window.removeEventListener('focus', debouncedSilentFetch);
      document.removeEventListener('visibilitychange', handleRevalidateNotifs);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleNewNotif = (e) => {
      if (e.detail) {
        setNotifications(prev => [e.detail, ...prev.filter(n => (n.id || n.notification_id) !== (e.detail.id || e.detail.notification_id))]);
        setTotal(t => t + 1);
        playNotificationChime();
      }
    };
    window.addEventListener('agrishield_new_notification', handleNewNotif);
    window.addEventListener('newBookingNotification', handleNewNotif);
    return () => {
      window.removeEventListener('agrishield_new_notification', handleNewNotif);
      window.removeEventListener('newBookingNotification', handleNewNotif);
    };
  }, []);

  const { latestAlert } = useWebSocket();
  useEffect(() => {
    if (latestAlert) {
      setNotifications(prev => {
        const exists = prev.some(n => (n.notification_id && n.notification_id === latestAlert.notification_id) || (n.id && n.id === latestAlert.id) || (n._id && n._id === latestAlert._id));
        if (exists) return prev;
        return [latestAlert, ...prev];
      });
      setTotal(prev => prev + 1);
    }
  }, [latestAlert]);

  const handleMarkRead = async (id, e, threadItemIds = null) => {
    if (e) e.stopPropagation();
    try {
      const idsToMark = Array.isArray(threadItemIds) && threadItemIds.length > 0 ? threadItemIds : [id];
      const readIds = getReadIds();
      idsToMark.forEach(itemId => {
        API.put(`/api/v1/notifications/${itemId}/read`).catch(() => {});
        readIds.add(itemId);
        readIds.add(String(itemId));
      });
      saveReadIds(readIds);

      setNotifications(prev => prev.map(n => {
        const match = idsToMark.includes(n.notification_id) || idsToMark.includes(n.id) || (n.booking_id && idsToMark.includes(n.booking_id));
        return match ? { ...n, read: true } : n;
      }));

      try {
        const stored = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        if (Array.isArray(stored)) {
          localStorage.setItem('agrishield_user_notifications', JSON.stringify(stored.map(n => {
            const match = idsToMark.includes(n.notification_id) || idsToMark.includes(n.id) || (n.booking_id && idsToMark.includes(n.booking_id));
            return match ? { ...n, read: true } : n;
          })));
        }
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('agrishield_notification_read', { detail: { id } }));
      setToastMsg(isTe ? 'చదివినట్లు గుర్తించబడింది' : t('notifications_page.toast.marked_read', 'Marked as read.'));
    } catch {
      setToastMsg(isTe ? 'గుర్తించడంలో విఫలమైంది' : t('notifications_page.toast.mark_read_failed', 'Failed to mark as read.'));
    }
  };

  const handleDelete = async (id, e, threadItemIds = null) => {
    if (e) e.stopPropagation();
    try {
      const idsToDelete = Array.isArray(threadItemIds) && threadItemIds.length > 0 ? threadItemIds : [id];
      idsToDelete.forEach(itemId => {
        // 1. Permanently blacklist this notification ID so background fetch & synthesis never resurrect it
        saveDeletedNotificationId(itemId);
        recordCrossDeviceDeletion('notification', itemId, 'User deleted notification');
        API.delete(`/api/v1/notifications/${itemId}`).catch(() => {});
      });

      setNotifications(prev => prev.filter(n => !idsToDelete.includes(n.notification_id) && !idsToDelete.includes(n.id) && !idsToDelete.includes(n.booking_id)));
      setTotal(t => Math.max(0, t - idsToDelete.length));
      try {
        const stored = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        if (Array.isArray(stored)) {
          localStorage.setItem('agrishield_user_notifications', JSON.stringify(stored.filter(n => !idsToDelete.includes(n.notification_id) && !idsToDelete.includes(n.id) && !idsToDelete.includes(n.booking_id))));
        }
      } catch (e) {}
      if (selectedMessage && (idsToDelete.includes(selectedMessage.notification_id) || idsToDelete.includes(selectedMessage.id) || idsToDelete.includes(selectedMessage.booking_id))) {
        setSelectedMessage(null);
      }
      setToastMsg(isTe ? 'సందేశం తొలగించబడింది.' : t('notifications_page.toast.deleted', 'Notification deleted.'));
    } catch {
      setToastMsg(t('notifications_page.toast.delete_failed', 'Failed to delete notification.'));
    }
  };

  const handleReadAll = async () => {
    try {
      await API.post('/api/v1/notifications/read-all').catch(() => {});
      await API.post('/api/notifications/read-all').catch(() => {});

      const readIds = getReadIds();
      notifications.forEach(n => {
        if (n.id) readIds.add(n.id);
        if (n.notification_id) readIds.add(n.notification_id);
        if (n.booking_id) {
          readIds.add(n.booking_id);
          readIds.add(`booking-${n.booking_id}`);
          readIds.add(`farmer-notif-${n.booking_id}-confirmed`);
          readIds.add(`farmer-notif-${n.booking_id}-rejected`);
          readIds.add(`farmer-notif-${n.booking_id}-declined`);
          readIds.add(`notif-${n.booking_id}`);
        }
      });
      saveReadIds(readIds);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      try {
        const stored = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        const updated = stored.map(n => ({ ...n, read: true }));
        localStorage.setItem('agrishield_user_notifications', JSON.stringify(updated));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('agrishield_notifications_all_read'));
      setToastMsg(isTe ? 'అన్ని సందేశాలు చదివినట్లు గుర్తించబడ్డాయి.' : t('notifications_page.toast.all_read', 'All messages marked as read.'));
    } catch {
      setToastMsg(isTe ? 'విఫలమైంది.' : t('notifications_page.toast.all_read_failed', 'Failed to mark all as read.'));
    }
  };

  const playNotificationChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.debug('Audio chime skipped:', e);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(isTe ? 'అన్ని సందేశాలు మరియు నోటిఫికేషన్‌లను ఖాళీ చేయాలా?' : t('notifications_page.confirm_clear', 'Clear all messages and notifications?'))) return;
    try {
      // 1. Permanently blacklist all current notification IDs so background synthesis never resurrects them
      notifications.forEach(n => {
        const nId = n.notification_id || n.id || n.booking_id;
        if (nId) saveDeletedNotificationId(nId);
      });

      await API.delete('/api/v1/notifications/clear').catch(() => {});
      await API.delete('/api/notifications/clear').catch(() => {});
      setNotifications([]);
      setTotal(0);
      setSelectedMessage(null);
      try {
        localStorage.removeItem('agrishield_user_notifications');
      } catch (e) {}
      setToastMsg(isTe ? 'ఇన్‌బాక్స్ క్లియర్ చేయబడింది.' : t('notifications_page.toast.inbox_cleared', 'Inbox cleared.'));
    } catch {
      setToastMsg(t('notifications_page.toast.clear_failed', 'Failed to clear notifications.'));
    }
  };

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Dynamic filter for category & search
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // 1. Search Query
      if (search) {
        const q = search.toLowerCase();
        const { title: dt, message: dm } = translateNotification(n.title, n.message, currentLang);
        const matchesSearch = (n.title || '').toLowerCase().includes(q) ||
          (n.message || '').toLowerCase().includes(q) ||
          (n.title_te || '').toLowerCase().includes(q) ||
          (n.message_te || '').toLowerCase().includes(q) ||
          (n.farmerName || '').toLowerCase().includes(q) ||
          (n.providerName || '').toLowerCase().includes(q) ||
          (dt || '').toLowerCase().includes(q) ||
          (dm || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Unread filter
      if (unreadOnly && n.read) return false;

      // 3. Category grouping
      if (category === 'All') return true;

      const cat = (n.category || '').toLowerCase();
      const isBooking = n.type === 'booking' || cat === 'booking' || n.isFarmerDecision === true || (n.id || '').startsWith('farmer-notif-') || (n.id || '').startsWith('notif-BK-');

      if (category === 'provider') return isBooking;
      if (category === 'crop_alerts') return cat === 'disease' || (!isBooking && cat !== 'weather');
      if (category === 'weather') return cat === 'weather';
      if (category === 'support') return cat === 'system' || cat === 'battery' || cat === 'device' || cat === 'recommendation';

      return cat === category.toLowerCase();
    });
  }, [notifications, search, unreadOnly, category, currentLang]);

  // Google Messages Category Filter Chips
  const FILTER_PILLS = useMemo(() => {
    if (isEquipmentProvider) {
      return [
        { id: 'All', label: isTe ? 'అన్నీ' : 'All' },
        { id: 'unread', label: isTe ? `చదవనివి (${unreadCount})` : `Unread (${unreadCount})`, isUnreadPill: true },
        { id: 'provider', label: isTe ? '🚜 బుకింగ్‌లు & ఆర్డర్‌లు' : '🚜 Bookings & Orders' },
        { id: 'support', label: isTe ? '🛡️ సహాయం & సిస్టమ్' : '🛡️ Support' }
      ];
    }
    return [
      { id: 'All', label: isTe ? 'అన్నీ' : 'All' },
      { id: 'unread', label: isTe ? `చదవనివి (${unreadCount})` : `Unread (${unreadCount})`, isUnreadPill: true },
      { id: 'provider', label: isTe ? '🚜 యంత్రాలు & ప్రొవైడర్లు' : '🚜 Providers & Orders' },
      { id: 'crop_alerts', label: isTe ? '🌿 పంట హెచ్చరికలు' : '🌿 Crop Alerts' },
      { id: 'weather', label: isTe ? '🌦️ వాతావరణం' : '🌦️ Weather' },
      { id: 'support', label: isTe ? '🛡️ సహాయం & సిస్టమ్' : '🛡️ Support' }
    ];
  }, [isTe, unreadCount, isEquipmentProvider]);

  // Helper to determine sender metadata and high-contrast color avatar
  const getThreadMeta = useCallback((item) => {
    const isBooking = item.type === 'booking' || item.category === 'booking' || item.isFarmerDecision === true || (item.id || '').startsWith('farmer-notif-') || (item.id || '').startsWith('notif-BK-') || Boolean(item.booking_id);
    const isDisease = item.category === 'disease';
    const isWeather = item.category === 'weather';

    if (isBooking) {
      const pName = item.providerName || (isEquipmentProvider ? (item.farmerName || 'Farmer') : (isTe ? 'రమేష్ ఫార్మ్ సర్వీసెస్ (పసుపుగల్లు)' : 'Ramesh Farm Services (Pasupugallu)'));
      return {
        type: 'provider',
        senderTitle: pName,
        verified: true,
        avatarBg: THREAD_THEMES.provider.avatarBg,
        badgeBg: THREAD_THEMES.provider.badgeBg,
        Icon: THREAD_THEMES.provider.Icon,
        categoryLabel: isTe ? 'యంత్ర ప్రొవైడర్' : 'Machinery Provider'
      };
    }
    if (isDisease) {
      const cropInfo = extractCropInfo(item, isTe);
      return {
        type: 'disease',
        senderTitle: cropInfo.threadTitle,
        verified: true,
        avatarBg: THREAD_THEMES.disease.avatarBg,
        badgeBg: THREAD_THEMES.disease.badgeBg,
        Icon: THREAD_THEMES.disease.Icon,
        categoryLabel: cropInfo.categoryLabel,
        cropInfo
      };
    }
    if (isWeather) {
      return {
        type: 'weather',
        senderTitle: isTe ? 'అగ్రిషీల్డ్ వాతావరణ నెట్‌వర్క్' : 'AgriShield Weather Station',
        verified: true,
        avatarBg: THREAD_THEMES.weather.avatarBg,
        badgeBg: THREAD_THEMES.weather.badgeBg,
        Icon: THREAD_THEMES.weather.Icon,
        categoryLabel: isTe ? 'వాతావరణం' : 'Weather Advisory'
      };
    }
    return {
      type: 'support',
      senderTitle: isTe ? 'అగ్రిషీల్డ్ కిసాన్ హెల్ప్‌డెస్క్' : 'AgriShield Kisan Helpdesk',
      verified: true,
      avatarBg: THREAD_THEMES.support.avatarBg,
      badgeBg: THREAD_THEMES.support.badgeBg,
      Icon: THREAD_THEMES.support.Icon,
      categoryLabel: isTe ? 'సహాయ విభాగం' : 'Support & System'
    };
  }, [isEquipmentProvider, isTe]);

  // User Profile Initial
  const userInitial = useMemo(() => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return '🌱';
  }, [user]);

  // Loading skeleton - ONLY on initial mount when cache is empty (zero screen flicker during revalidation)
  if (loading && notifications.length === 0 && !hasLoadedOnceRef.current) {
    return (
      <div className="min-h-screen bg-[#f1f3f9] dark:bg-[#111318] p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-14 w-full rounded-full bg-slate-200/80 dark:bg-slate-800" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800" />
          <Skeleton className="h-9 w-28 rounded-full bg-slate-200/80 dark:bg-slate-800" />
          <Skeleton className="h-9 w-32 rounded-full bg-slate-200/80 dark:bg-slate-800" />
        </div>
        <div className="bg-white dark:bg-[#1a1f26] rounded-3xl p-2 space-y-3 border border-slate-200/80 dark:border-slate-800">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-12 h-12 rounded-full shrink-0 bg-slate-200/80 dark:bg-slate-800" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3 bg-slate-200/80 dark:bg-slate-800" />
                <Skeleton className="h-3 w-4/5 bg-slate-200/80 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── FULL SCREEN GOOGLE MESSAGE 2-WAY READER VIEW ───
  if (selectedMessage) {
    const { title: transTitle, message: transBody } = translateNotification(
      selectedMessage.title,
      selectedMessage.message,
      currentLang
    );
    return (
      <div className="fixed inset-0 z-[9999] bg-[#f1f3f9] dark:bg-[#0d1117] flex flex-col w-full h-full overflow-hidden animate-fade-in">
        <GoogleMessageReader
          message={selectedMessage}
          translatedTitle={transTitle}
          translatedBody={transBody}
          lang={currentLang}
          onBack={() => setSelectedMessage(null)}
          onDelete={(id) => handleDelete(id, null, selectedMessage.threadItemIds)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f3f9] dark:bg-[#111318] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-32 pt-2 px-3 sm:px-6 max-w-3xl mx-auto space-y-3.5 animate-fade-in relative">

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-18 right-4 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 border border-white/10 animate-slide-up">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ─── 1. TOP APP BAR / UTILITY CONTROLS ─── */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isTe ? 'సందేశాలు & హెచ్చరికలు' : 'Messages'}
          </h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white shadow-xs">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center gap-1.5">

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              className="p-2 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all shadow-xs cursor-pointer"
              title="Mark All Read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}

          {/* Notification Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
            title="Alert Channel Settings"
          >
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Clear Inbox */}
          {notifications.length > 0 && (
            <button
              onClick={handleClear}
              className="p-2 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 transition-all shadow-xs cursor-pointer"
              title="Clear All Messages"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. GOOGLE MESSAGES ROUNDED PILL SEARCH BAR WITH LEAF EMBLEM & AVATAR ─── */}
      <div className="relative w-full rounded-full bg-white dark:bg-[#1a1f26] border border-slate-200/90 dark:border-slate-800 shadow-sm px-3.5 py-2.5 flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500/60">
        {/* Leaf Emblem */}
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300/60 dark:border-emerald-700/60 flex items-center justify-center shrink-0 shadow-xs">
          <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>

        {/* Search Input */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isTe ? "సందేశాలు & పంట హెచ్చరికలు శోధించండి..." : "Search messages & alerts..."}
          className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
        />

        {/* Clear Search Input */}
        {search && (
          <button
            onClick={() => setSearch('')}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Profile Avatar Pill */}
        <div
          onClick={() => setSettingsOpen(true)}
          className="relative shrink-0 cursor-pointer group"
          title={user?.name || "User Profile"}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-black text-xs flex items-center justify-center shadow-xs ring-2 ring-emerald-400/30 group-hover:scale-105 transition-transform">
            {userInitial}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1a1f26]" />
        </div>
      </div>

      {/* ─── 3. MATERIAL YOU HORIZONTAL CATEGORY FILTER CHIPS ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 hide-scrollbar">
        {FILTER_PILLS.map((pill) => {
          const isActive = pill.isUnreadPill ? unreadOnly : (!unreadOnly && category === pill.id);
          return (
            <button
              key={pill.id}
              onClick={() => {
                if (pill.isUnreadPill) {
                  setUnreadOnly(!unreadOnly);
                } else {
                  setUnreadOnly(false);
                  setCategory(pill.id);
                }
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm scale-102'
                  : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 dark:bg-[#1a1f26] dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
              }`}
            >
              <span>{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── 4. THREAD ROWS (NATIVE GOOGLE MESSAGES LIGHT-MEDIUM STYLE) ─── */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={isEquipmentProvider ? (isTe ? 'బుకింగ్ సందేశాలు లేవు' : 'No Booking Messages') : t('notifications_page.empty_title', 'No Messages')}
          description={isEquipmentProvider
            ? (isTe ? 'మీ ఇన్‌బాక్స్ స్పష్టంగా ఉంది! రైతులు మీ ట్రాక్టర్లు లేదా డ్రోన్లు బుక్ చేసుకున్నప్పుడు తక్షణ అలర్ట్‌లు ఇక్కడ కనిపిస్తాయి.' : 'Your inbox is clear. Whenever farmers book your tractors or spray drones, instant alerts and booking details will stream here.')
            : (isTe ? 'మీ ఇన్‌బాక్స్ స్పష్టంగా ఉంది! అన్ని పొలం తెగులు హెచ్చరికలు మరియు సమాచారం ఇక్కడ స్ట్రీమ్ అవుతాయి.' : "Your inbox is completely clear! All field disease warnings and machinery updates will stream here.")}
        />
      ) : (
        <div className="bg-white dark:bg-[#1a1f26] rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          <AnimatePresence>
            {filteredNotifications.map((item) => {
              const meta = getThreadMeta(item);
              const AvatarIcon = meta.Icon;
              const isUnread = !item.read;
              const { title: displayTitle, message: displayMessage } = translateNotification(
                item.title,
                item.message,
                currentLang
              );
              const timeString = formatGoogleMessagesTime(item.lifecycle?.created_at || item.created_at || item.timestamp);
              const priorityInfo = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.Low;

              return (
                <motion.div
                  key={item.notification_id || item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  onClick={() => {
                    setSelectedMessage(item);
                    if (isUnread) handleMarkRead(item.notification_id || item.id);
                  }}
                  className={`flex items-start gap-3.5 p-3.5 sm:p-4 cursor-pointer transition-colors relative group select-none ${
                    isUnread
                      ? 'bg-[#eef4ff] dark:bg-blue-950/25 hover:bg-[#e6f0ff] dark:hover:bg-blue-950/40'
                      : 'hover:bg-slate-50/90 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Left Circular Avatar with High-Contrast Color Coding */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${meta.avatarBg}`}>
                      <AvatarIcon className="w-6 h-6 text-white drop-shadow-xs" />
                    </div>
                    {/* Pulsing Dot on unread avatar */}
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-[#1a1f26] animate-pulse" />
                    )}
                  </div>

                  {/* Message Content / Snippet */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Top Row: Sender Title + Verified Badge + Timestamp */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center min-w-0">
                        <h3 className={`text-sm sm:text-base font-bold truncate tracking-tight ${
                          isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {meta.senderTitle}
                        </h3>
                        {/* Verified Green Checkmark (✓) */}
                        <span className="inline-flex items-center ml-1 text-emerald-600 dark:text-emerald-400 shrink-0" title="Verified AgriShield Entity">
                          <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white dark:text-slate-900" />
                        </span>
                      </div>

                      {/* Relative Timestamp */}
                      <span className={`text-xs font-semibold shrink-0 ${
                        isUnread ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {timeString}
                      </span>
                    </div>

                    {/* Truncated Message Preview Snippet */}
                    <p className={`text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 leading-relaxed ${
                      isUnread
                        ? 'text-slate-900 dark:text-slate-100 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 font-normal'
                    }`}>
                      {displayMessage || displayTitle}
                    </p>

                    {/* Category & Status Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${priorityInfo.bg}`}>
                        {item.priority || 'Normal'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeBg}`}>
                        {meta.categoryLabel}
                      </span>
                    </div>

                    {/* Quick Action Buttons: Open Chat, Call, WhatsApp, Order Links */}
                    {(item.category === 'booking' || item.type === 'booking' || item.type === 'booking_chat' || item.isThread) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Dedicated Open Chat Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMessage(item);
                            if (isUnread) handleMarkRead(item.notification_id || item.id, e, item.threadItemIds);
                          }}
                          className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{isTe ? 'చాట్ తెరవండి' : 'Open Chat'}</span>
                        </button>

                        {isEquipmentProvider ? (
                          <>
                            <a
                              href={`tel:${String(item.farmerPhone || item.phone || '9440182736').replace(/[^0-9]/g, '')}`}
                              className="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{isTe ? 'రైతుకు కాల్' : 'Call Farmer'}</span>
                            </a>
                            <a
                              href={`https://wa.me/${String(item.farmerPhone || item.phone || '9440182736').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${item.farmerName || 'Farmer'}, regarding your machinery booking on AgriShield...`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                            <Link
                              to="/provider/dashboard?tab=orders"
                              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors"
                            >
                              {isTe ? 'ఆర్డర్లలో చూడండి' : 'View Orders'}
                            </Link>
                          </>
                        ) : (
                          <>
                            <a
                              href={`tel:${String(item.providerPhone || '9876543210').replace(/[^0-9]/g, '')}`}
                              className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{isTe ? 'ప్రొవైడర్‌కు కాల్' : 'Call Provider'}</span>
                            </a>
                            <a
                              href={`https://wa.me/${String(item.providerPhone || '9876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${item.providerName || 'Provider'}, regarding my equipment booking #${item.booking_id || ''}...`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                            <Link
                              to="/equipment-booking"
                              className="px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-colors"
                            >
                              {isTe ? 'బుకింగ్ చూడండి' : 'View Voucher'}
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Unread Pill Badge & Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                    {/* Google Messages Signature Blue Unread Pill Badge showing thread unread count */}
                    {isUnread && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-black shadow-xs min-w-[20px] text-center">
                        {item.threadUnreadCount || item.threadCount || 1}
                      </span>
                    )}

                    {/* Quick Row Actions on hover */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkRead(item.notification_id || item.id, e, item.threadItemIds)}
                          className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-600 transition-colors"
                          title="Mark Read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(item.notification_id || item.id, e, item.threadItemIds)}
                        className="p-1.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete Message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}



      {/* ─── 7. NOTIFICATION SETTINGS MODAL ─── */}
      <Dialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={isTe ? "🔔 నోటిఫికేషన్ ఛానెల్‌ల అమరికలు" : "🔔 Notification Settings & Channels"}
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isTe ? "ఈ పరికరంలో మీరు స్వీకరించే హెచ్చరికలను అనుకూలీకరించండి:" : "Customize alerts and push warnings received on this device."}
          </p>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center justify-between pt-2">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🚨 {isTe ? 'తెగులు & పురుగుల హెచ్చరికలు' : 'Disease & Pest Outbreak Alerts'}</p>
                <p className="text-[11px] text-slate-500">{isTe ? 'పొలంలో తెగుళ్లు వ్యాపించినప్పుడు తక్షణ హెచ్చరిక.' : 'Warnings when neighboring farms detect fungal infections.'}</p>
              </div>
              <Switch
                checked={alertSettings.disease}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, disease: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🌧️ {isTe ? 'వర్షం & స్ప్రే సూచనలు' : 'Severe Rain & Spray Windows'}</p>
                <p className="text-[11px] text-slate-500">{isTe ? 'వర్షానికి ముందు మందుల పిచికారీ నివారణ సూచన.' : 'Advisories before high wind or rainfall to avoid chemical wastage.'}</p>
              </div>
              <Switch
                checked={alertSettings.weather}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, weather: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">💧 {isTe ? 'నేల తేమ & నీటి పారుదల' : 'Soil Moisture & Irrigation Prompts'}</p>
                <p className="text-[11px] text-slate-500">{isTe ? 'నీటి శాతం తగ్గినప్పుడు అలర్ట్.' : 'Alerts when soil water percentage drops below threshold.'}</p>
              </div>
              <Switch
                checked={alertSettings.irrigation}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, irrigation: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🔋 {isTe ? 'పరికరాల బ్యాటరీ హెచ్చరిక' : 'Hardware Battery & Node Offline'}</p>
                <p className="text-[11px] text-slate-500">{isTe ? 'బ్యాటరీ 20% కన్నా తక్కువ ఉన్నప్పుడు అలర్ట్.' : 'Alerts when ESP32 battery drops under 20%.'}</p>
              </div>
              <Switch
                checked={alertSettings.battery}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, battery: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🔊 {isTe ? 'నోటిఫికేషన్ సౌండ్' : 'Alert Sound Chime'}</p>
                <p className="text-[11px] text-slate-500">{isTe ? 'అత్యవసర సందేశం వచ్చినప్పుడు శబ్దం వినిపించును.' : 'Play an audible chime on critical warnings.'}</p>
              </div>
              <Switch
                checked={alertSettings.sound}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, sound: e.target.checked })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="primary" size="sm" onClick={() => setSettingsOpen(false)}>
              {isTe ? 'పూర్తయింది' : 'Done'}
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
}
