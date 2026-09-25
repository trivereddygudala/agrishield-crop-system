import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, Search, Trash2, CheckCheck, Filter, RefreshCw,
  AlertTriangle, CloudRain, Droplets, BatteryWarning,
  WifiOff, Activity, ChevronDown, ChevronLeft, ChevronRight, X, BellOff, Download, Clock, Check,
  Settings, Volume2, VolumeX, ShieldAlert, Sparkles, SlidersHorizontal, MessageSquare, Truck, Phone
} from 'lucide-react';
import { Card, Button, Input, Select, Badge, Dialog, EmptyState, Skeleton, Switch } from '../../components/ui/index';
import API from '../../services/api';
import axios from 'axios';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import { timeAgo, formatDateTime } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { translateNotification } from '../../utils/notificationTranslator';
import GoogleMessageReader from '../../components/common/GoogleMessageReader';


const PRIORITY_CONFIG = {
  Critical: { bg: 'bg-rose-100 dark:bg-rose-950/70', border: 'border-rose-300 dark:border-rose-800', dot: 'bg-rose-500', badge: 'diseased', text: 'text-rose-700 dark:text-rose-300', label: 'Critical' },
  High:     { bg: 'bg-amber-100 dark:bg-amber-950/70', border: 'border-amber-300 dark:border-amber-800', dot: 'bg-amber-500', badge: 'warning', text: 'text-amber-700 dark:text-amber-300', label: 'High' },
  Medium:   { bg: 'bg-sky-100 dark:bg-sky-950/70', border: 'border-sky-300 dark:border-sky-800', dot: 'bg-sky-500', badge: 'agrochemical', text: 'text-sky-700 dark:text-sky-300', label: 'Medium' },
  Low:      { bg: 'bg-emerald-100 dark:bg-emerald-950/70', border: 'border-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500', badge: 'healthy', text: 'text-emerald-700 dark:text-emerald-300', label: 'Low' },
};

const CATEGORY_ICONS = {
  disease:        { Icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-950/60', label: 'Disease' },
  weather:        { Icon: CloudRain,     color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-950/60', label: 'Weather' },
  soil:           { Icon: Droplets,      color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-950/60', label: 'Irrigation' },
  battery:        { Icon: BatteryWarning,color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/60', label: 'Battery' },
  device:         { Icon: WifiOff,       color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Node Offline' },
  recommendation: { Icon: Activity,      color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-950/60', label: 'Advisory' },
  system:         { Icon: Activity,      color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-950/60', label: 'System' },
  booking:        { Icon: Truck,         color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-950/60', label: 'Machinery Booking' },
};

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentLang = i18n.language || user?.preferred_language || localStorage.getItem('i18nextLng') || 'te';
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isEquipmentProvider = user?.role?.toLowerCase() === 'equipment_provider';
  const isTe = i18n?.language === 'te';
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit]           = useState(25);
  const [toastMsg, setToastMsg] = useState('');

  // Selected Notification Dialog (Message view)
  const [selectedMessage, setSelectedMessage] = useState(null);

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

  const fetchNotifications = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: limit });
      if (priority !== 'All') params.set('priority', priority);
      
      const readIds = getReadIds();

      let serverNotifs = [];
      try {
        const res = await API.get(`/api/v1/notifications?${params}`);
        serverNotifs = (res.data.notifications || []).map(sn => {
          const sId = sn.notification_id || sn.id || sn._id;
          return (readIds.has(sId) || readIds.has(String(sId))) ? { ...sn, read: true } : sn;
        });
      } catch (err) {
        console.warn("Could not fetch remote notifications, falling back to local:", err);
      }

      // Load local notifications with strict role-based isolation:
      // Farmers must NEVER receive "New Machinery Booking Received" or incoming requests.
      // Farmers ONLY receive Accept or Decline decision notifications from providers.
      let localNotifs = [];
      try {
        const savedUserNotifs = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        if (Array.isArray(savedUserNotifs)) {
          if (!isEquipmentProvider) {
            // Strictly exclude incoming machinery requests and "booked your" notifications for farmers
            localNotifs = savedUserNotifs.filter(n => {
              const title = (n.title || '').toLowerCase();
              const msg = (n.message || '').toLowerCase();
              const isIncomingOrder = title.includes('కొత్త యంత్ర బుకింగ్') || 
                                     title.includes('new machinery booking') ||
                                     title.includes('booking request') ||
                                     msg.includes('booked your') ||
                                     msg.includes('బుక్ చేసుకున్నారు');
              return !isIncomingOrder;
            });
            // Auto-clean storage on farmer device
            if (localNotifs.length !== savedUserNotifs.length) {
              try { localStorage.setItem('agrishield_user_notifications', JSON.stringify(localNotifs)); } catch (_) {}
            }
          } else {
            localNotifs = [...savedUserNotifs];
          }

          // Hydrate read state from persistent readIds registry
          localNotifs = localNotifs.map(ln => {
            const lId = ln.notification_id || ln.id || ln.booking_id;
            const isRead = readIds.has(lId) || (ln.booking_id && (readIds.has(`booking-${ln.booking_id}`) || readIds.has(ln.booking_id)));
            return isRead ? { ...ln, read: true } : ln;
          });
        }
      } catch (e) {}

      // If equipment provider, synthesize notifications from recorded machinery bookings
      if (isEquipmentProvider) {
        try {
          let bookings = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
          try {
            let bRes = await API.get('/api/v1/equipment/bookings');
            if (!bRes.data || typeof bRes.data !== 'object' || !Array.isArray(bRes.data.bookings)) {
              try { bRes = await API.get('/api/equipment/bookings'); } catch (_) {}
            }
            if (!bRes.data || typeof bRes.data !== 'object' || !Array.isArray(bRes.data.bookings)) {
              try { bRes = await axios.get('https://agrishield-ai-worker-1.onrender.com/api/v1/equipment/bookings', { timeout: 15000 }); } catch (_) {}
            }
            if (!bRes.data || typeof bRes.data !== 'object' || !Array.isArray(bRes.data.bookings)) {
              try { bRes = await axios.get('https://agrishield-ai-worker-2.onrender.com/api/v1/equipment/bookings', { timeout: 15000 }); } catch (_) {}
            }
            if (bRes.data?.bookings && Array.isArray(bRes.data.bookings)) {
              const bMap = new Map();
              bRes.data.bookings.forEach(b => { if (b && b.id) bMap.set(b.id, b); });
              bookings.forEach(b => { if (b && b.id && !bMap.has(b.id)) bMap.set(b.id, b); });
              bookings = Array.from(bMap.values());
            }
          } catch (e) {}

          if (Array.isArray(bookings)) {
            bookings.forEach((b) => {
              const bId = b.id || `BK-${Math.floor(10000 + Math.random() * 90000)}`;
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

      // If farmer, synthesize notifications ONLY for provider Accept or Decline status decisions
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

      // Persist local notifications with updated read states back to disk
      try {
        localStorage.setItem('agrishield_user_notifications', JSON.stringify(localNotifs));
      } catch (_) {}

      // Merge local and server without duplicates
      const merged = [...localNotifs];
      serverNotifs.forEach((sn) => {
        const snId = sn.notification_id || sn.id || sn._id;
        if (!merged.some(m => (m.notification_id || m.id || m._id) === snId)) {
          merged.push(sn);
        }
      });

      merged.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));

      setNotifications(merged);
      setTotal(merged.length);
      setPages(Math.max(1, Math.ceil(merged.length / limit)));
      setPage(p);
    } catch {
      setToastMsg(t('notifications_page.toast.load_failed', 'Failed to load notifications.'));
    } finally {
      setLoading(false);
    }
  }, [limit, t, isEquipmentProvider, isTe, getReadIds, priority]);

  useEffect(() => { fetchNotifications(1); }, [fetchNotifications]);

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

  const handleMarkRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await API.put(`/api/v1/notifications/${id}/read`).catch(() => {});
      const readIds = getReadIds();
      readIds.add(id);
      readIds.add(String(id));
      saveReadIds(readIds);

      setNotifications(prev => prev.map(n => {
        const match = (n.notification_id === id || n.id === id || n.booking_id === id);
        return match ? { ...n, read: true } : n;
      }));

      try {
        const stored = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        localStorage.setItem('agrishield_user_notifications', JSON.stringify(stored.map(n => {
          const match = (n.notification_id === id || n.id === id || n.booking_id === id);
          return match ? { ...n, read: true } : n;
        })));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('agrishield_notification_read', { detail: { id } }));
      setToastMsg(isTe ? 'చదివినట్లు గుర్తించబడింది' : t('notifications_page.toast.marked_read', 'Marked as read.'));
    } catch {
      setToastMsg(isTe ? 'గుర్తించడంలో విఫలమైంది' : t('notifications_page.toast.mark_read_failed', 'Failed to mark as read.'));
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await API.delete(`/api/v1/notifications/${id}`).catch(() => {});
      setNotifications(prev => prev.filter(n => n.notification_id !== id && n.id !== id));
      setTotal(t => Math.max(0, t - 1));
      try {
        const stored = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        localStorage.setItem('agrishield_user_notifications', JSON.stringify(stored.filter(n => n.notification_id !== id && n.id !== id)));
      } catch (e) {}
      if (selectedMessage?.notification_id === id || selectedMessage?.id === id) setSelectedMessage(null);
      setToastMsg(t('notifications_page.toast.deleted', 'Notification deleted.'));
    } catch { setToastMsg(t('notifications_page.toast.delete_failed', 'Failed to delete notification.')); }
  };

  const handleReadAll = async () => {
    try {
      await API.post('/api/v1/notifications/read-all').catch(() => {});
      await API.post('/api/notifications/read-all').catch(() => {});

      // Add all notification IDs and booking IDs to persistent read set
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

      // Instantly update state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      // Save to localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        const updated = stored.map(n => ({ ...n, read: true }));
        localStorage.setItem('agrishield_user_notifications', JSON.stringify(updated));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('agrishield_notifications_all_read'));
      setToastMsg(isTe ? 'అన్ని నోటిఫికేషన్‌లు చదివినట్లు గుర్తించబడ్డాయి.' : t('notifications_page.toast.all_read', 'All notifications marked as read.'));
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

  const handleSimulateAlert = () => {
    playNotificationChime();
    const simulated = {
      notification_id: 'SIM-' + Date.now(),
      title: '🚨 High Disease Vulnerability Alert',
      message: 'Persistent canopy humidity (>88%) detected. High risk of Tomato Early Blight outbreak. Preventative copper or neem foliar spray strongly advised.',
      category: 'disease',
      priority: 'High',
      created_at: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [simulated, ...prev]);
    setTotal(t => t + 1);
    setToastMsg(t('notifications_page.toast.simulated', 'Simulated crop disease alert delivered with audio chime!'));
  };

  const handleClear = async () => {
    if (!window.confirm(t('notifications_page.confirm_clear', 'Clear all notifications?'))) return;
    try {
      await API.delete('/api/v1/notifications/clear');
      setNotifications([]);
      setTotal(0);
      setSelectedMessage(null);
      setToastMsg(t('notifications_page.toast.inbox_cleared', 'Inbox cleared.'));
    } catch { setToastMsg(t('notifications_page.toast.clear_failed', 'Failed to clear notifications.')); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    // 1. Search Query
    if (search) {
      const q = search.toLowerCase();
      const { title: dt, message: dm } = translateNotification(n.title, n.message, currentLang);
      const matchesSearch = (n.title || '').toLowerCase().includes(q) ||
        (n.message || '').toLowerCase().includes(q) ||
        (dt || '').toLowerCase().includes(q) ||
        (dm || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Unread filter
    if (unreadOnly && n.read) return false;

    // 3. Category grouping
    if (category === 'All') return true;

    if (category === 'crop_alerts') {
      const cat = (n.category || '').toLowerCase();
      const isBooking = n.type === 'booking' || cat === 'booking' || n.isFarmerDecision === true || (n.id || '').startsWith('farmer-notif-') || (n.id || '').startsWith('notif-BK-');
      return !isBooking;
    }

    if (category === 'machinery_services') {
      const cat = (n.category || '').toLowerCase();
      const isBooking = cat === 'booking' || n.type === 'booking' || n.isFarmerDecision === true || (n.id || '').startsWith('farmer-notif-') || (n.id || '').startsWith('notif-BK-');
      return isBooking;
    }

    return (n.category || '').toLowerCase() === category.toLowerCase();
  });

  const FILTER_PILLS = isEquipmentProvider ? [
    { id: 'All', label: isTe ? '🔔 అన్ని సందేశాలు' : '🔔 All Messages', icon: MessageSquare },
    { id: 'unread', label: isTe ? `📬 చదవనివి (${unreadCount})` : `📬 Unread (${unreadCount})`, icon: Bell, isUnreadPill: true },
    { id: 'machinery_services', label: isTe ? '🚜 యంత్రాల బుకింగ్ ఆర్డర్‌లు' : '🚜 Machinery Rental Orders', icon: Truck },
    { id: 'crop_alerts', label: isTe ? '🛡️ హబ్ & సిస్టమ్ అలర్ట్‌లు' : '🛡️ Hub & System Alerts', icon: Activity },
  ] : [
    { id: 'All', label: isTe ? '🔔 అన్ని నోటిఫికేషన్‌లు' : '🔔 All Notifications', icon: MessageSquare },
    { id: 'unread', label: isTe ? `📬 చదవనివి (${unreadCount})` : `📬 Unread (${unreadCount})`, icon: Bell, isUnreadPill: true },
    { id: 'crop_alerts', label: isTe ? '🌿 పంట ఆరోగ్యం & పొలం హెచ్చరికలు' : '🌿 Crop Health & Field Alerts', icon: AlertTriangle },
    { id: 'machinery_services', label: isTe ? '🚜 యంత్రాలు & సేవా ఆర్డర్‌లు' : '🚜 Machinery & Service Orders', icon: Truck },
  ];

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto w-full p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ─── OPTION B FULL SCREEN REAL MESSENGER VIEW ───
  if (selectedMessage) {
    const { title: transTitle, message: transBody } = translateNotification(
      selectedMessage.title,
      selectedMessage.message,
      currentLang
    );
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col w-full h-full overflow-hidden animate-fade-in">
        <GoogleMessageReader
          message={selectedMessage}
          translatedTitle={transTitle}
          translatedBody={transBody}
          lang={currentLang}
          onBack={() => setSelectedMessage(null)}
          onDelete={(id) => handleDelete(id)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 px-2 sm:px-4 space-y-4 animate-fade-in">

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-18 right-4 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 text-white text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 border border-white/10">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ─── APP BAR HEADER (WhatsApp / Messages Style) ─── */}
      <div className="flex items-center justify-between gap-3 pt-1 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('notifications_page.title', 'Messages & Alerts')}
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-xs">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {isEquipmentProvider 
              ? (isTe ? `${total} మెషినరీ బుకింగ్ అభ్యర్థనలు & అలర్ట్‌లు` : `${total} machinery booking requests & dispatch alerts`)
              : `${total} farm updates & disease warnings`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Test/Simulate Disease Alert Button */}
          <button
            onClick={handleSimulateAlert}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-all shadow-xs"
            title="Simulate Real-Time Crop Warning"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Simulate Alert</span>
          </button>

          {/* Notification Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all shadow-xs"
            title="Notification Settings"
          >
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all shadow-xs"
              title="Mark All Read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}

          {/* Clear Inbox */}
          {notifications.length > 0 && (
            <button
              onClick={handleClear}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 transition-all shadow-xs"
              title="Clear Inbox"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── SEARCH BAR (Instant filter) ─── */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search alerts, crops, disease names, weather..."
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ─── FILTER CHIPS CAROUSEL (WhatsApp Style) ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
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
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border shadow-xs ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span>{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── NOTIFICATIONS CHAT LIST (WhatsApp / iMessage Style) ─── */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={isEquipmentProvider ? (isTe ? 'బుకింగ్ సందేశాలు లేవు' : 'No Booking Messages') : t('notifications_page.empty_title', 'No Messages')}
          description={isEquipmentProvider 
            ? (isTe ? 'మీ ఇన్‌బాక్స్ స్పష్టంగా ఉంది! రైతులు మీ ట్రాక్టర్లు లేదా డ్రోన్లు బుక్ చేసుకున్నప్పుడు తక్షణ అలర్ట్‌లు ఇక్కడ కనిపిస్తాయి.' : 'Your inbox is clear. Whenever farmers book your tractors or spray drones, instant alerts and booking details will stream here.')
            : "Your inbox is completely clear! All field disease warnings and environmental updates will stream here."}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900/80 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          <AnimatePresence>
            {filteredNotifications.map((item) => {
              const pc = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.Low;
              const catObj = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.system;
              const CatIcon = catObj.Icon;
              const isUnread = !item.read;
              const { title: displayTitle, message: displayMessage } = translateNotification(
                item.title,
                item.message,
                currentLang
              );

              return (
                <motion.div
                  key={item.notification_id || item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  onClick={() => {
                    setSelectedMessage(item);
                    if (isUnread) handleMarkRead(item.notification_id);
                  }}
                  className={`flex items-start gap-3.5 p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors relative group ${
                    isUnread ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''
                  }`}
                >
                  {/* Left Avatar Icon */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs ${catObj.bg} ${pc.border}`}>
                      <CatIcon className={`w-5 h-5 ${catObj.color}`} />
                    </div>
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-xs sm:text-sm truncate font-black ${
                        isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {displayTitle}
                      </h3>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold shrink-0">
                        {timeAgo(item.lifecycle?.created_at || item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-medium">
                      {displayMessage}
                    </p>


                    <div className="flex items-center gap-2 pt-1">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${pc.bg} ${pc.text}`}>
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {catObj.label}
                      </span>
                    </div>

                    {/* Quick Call & Action Buttons for Booking Alerts (Strictly Role Isolated) */}
                    {(item.category === 'booking' || item.type === 'booking') && (
                      <div className="flex flex-wrap items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        {isEquipmentProvider ? (
                          // Equipment Provider View: Actions to reach the farmer and view provider orders
                          <>
                            <a
                              href={`tel:${String(item.farmerPhone || item.phone || '9440182736').replace(/[^0-9]/g, '')}`}
                              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{isTe ? 'రైతుకు కాల్' : 'Call Farmer'}</span>
                            </a>
                            <a
                              href={`https://wa.me/${String(item.farmerPhone || item.phone || '9440182736').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${item.farmerName || 'Farmer'}, regarding your machinery booking on AgriShield...`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                            <Link
                              to="/provider/dashboard?tab=orders"
                              className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold"
                            >
                              {isTe ? 'ఆర్డర్లలో చూడండి' : 'View Orders'}
                            </Link>
                          </>
                        ) : (
                          // Farmer View: Actions to contact the provider and check their booking voucher (NEVER links to provider dashboard)
                          <>
                            <a
                              href={`tel:${String(item.providerPhone || '9876543210').replace(/[^0-9]/g, '')}`}
                              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{isTe ? 'ప్రొవైడర్‌కు కాల్' : 'Call Provider'}</span>
                            </a>
                            <a
                              href={`https://wa.me/${String(item.providerPhone || '9876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${item.providerName || 'Provider'}, regarding my equipment booking #${item.booking_id || ''}...`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                            <Link
                              to="/equipment-booking"
                              className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold"
                            >
                              {isTe ? 'బుకింగ్ చూడండి' : 'View Booking Voucher'}
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Quick Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkRead(item.notification_id, e)}
                        className="p-1.5 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-600"
                        title="Mark Read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(item.notification_id, e)}
                      className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── MESSAGE DETAILS POPUP MODAL ─── */}
      <Dialog
        isOpen={Boolean(selectedMessage)}
        onClose={() => setSelectedMessage(null)}
        title={selectedMessage?.title || "Alert Details"}
      >
        {selectedMessage && (() => {
          const pc = PRIORITY_CONFIG[selectedMessage.priority] || PRIORITY_CONFIG.Low;
          const catObj = CATEGORY_ICONS[selectedMessage.category] || CATEGORY_ICONS.system;
          const CatIcon = catObj.Icon;

          return (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${catObj.bg}`}>
                  <CatIcon className={`w-5 h-5 ${catObj.color}`} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{catObj.label} Alert</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={pc.badge}>{selectedMessage.priority} Priority</Badge>
                    <span className="text-xs text-slate-500 font-bold">
                      {formatDateTime(selectedMessage.lifecycle?.created_at || selectedMessage.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">{selectedMessage.title}</h4>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {selectedMessage.message}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" size="sm" onClick={() => setSelectedMessage(null)}>
                  Close
                </Button>
                {selectedMessage.category === 'disease' && (
                  <Button variant="primary" size="sm" onClick={() => { setSelectedMessage(null); navigate('/upload'); }}>
                    🌿 Scan Crop Leaf
                  </Button>
                )}
                {selectedMessage.category === 'weather' && (
                  <Button variant="primary" size="sm" onClick={() => { setSelectedMessage(null); navigate('/crop-advisory'); }}>
                    🌦️ View Weather Advisory
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedMessage.notification_id)} className="text-rose-500 hover:bg-rose-50">
                  Delete
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* ─── NOTIFICATION SETTINGS MODAL ─── */}
      <Dialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="🔔 Notification Settings & Alert Channels"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Customize which field alerts and push warnings you receive on this device.
          </p>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center justify-between pt-2">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🚨 Disease & Pest Outbreak Alerts</p>
                <p className="text-[11px] text-slate-500">Immediate warnings when neighboring farms detect fungal or pest infections.</p>
              </div>
              <Switch
                checked={alertSettings.disease}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, disease: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🌧️ Severe Rain & Spray Windows</p>
                <p className="text-[11px] text-slate-500">Advisories before high wind or rainfall to prevent pesticide chemical wastage.</p>
              </div>
              <Switch
                checked={alertSettings.weather}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, weather: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">💧 Soil Moisture & Irrigation Prompts</p>
                <p className="text-[11px] text-slate-500">Alerts when soil water percentage drops below optimal crop thresholds.</p>
              </div>
              <Switch
                checked={alertSettings.irrigation}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, irrigation: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🔋 Hardware Battery & Node Offline</p>
                <p className="text-[11px] text-slate-500">Alerts when ESP32 battery drops under 20% or Wi-Fi loses connection.</p>
              </div>
              <Switch
                checked={alertSettings.battery}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, battery: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="pr-4">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">🔊 Alert Sound Chime</p>
                <p className="text-[11px] text-slate-500">Play an audible chime whenever a critical emergency warning arrives.</p>
              </div>
              <Switch
                checked={alertSettings.sound}
                onChange={(e) => handleSaveAlertSettings({ ...alertSettings, sound: e.target.checked })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="primary" size="sm" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
