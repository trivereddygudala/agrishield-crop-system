import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Bell, Search, Trash2, CheckCheck, Filter, RefreshCw,
  AlertTriangle, CloudRain, Droplets, BatteryWarning,
  WifiOff, Activity, ChevronDown, ChevronLeft, ChevronRight, X, BellOff, Download, Clock, Check
} from 'lucide-react';
import { Card, Button, Input, Select, Badge, Dialog, EmptyState, Skeleton } from '../components/ui/index';
import API from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { timeAgo, formatDateTime } from '../utils/dateUtils';

const PRIORITY_CONFIG = {
  Critical: { bg: 'bg-rose-50 dark:bg-rose-950/60', border: 'border-rose-200 dark:border-rose-800', badge: 'diseased', text: 'text-rose-700 dark:text-rose-300', label: 'Critical' },
  High:     { bg: 'bg-amber-50 dark:bg-amber-950/60', border: 'border-amber-200 dark:border-amber-800', badge: 'warning', text: 'text-amber-700 dark:text-amber-300', label: 'High' },
  Medium:   { bg: 'bg-sky-50 dark:bg-sky-950/60', border: 'border-sky-200 dark:border-sky-800', badge: 'agrochemical', text: 'text-sky-700 dark:text-sky-300', label: 'Medium' },
  Low:      { bg: 'bg-emerald-50 dark:bg-emerald-950/60', border: 'border-emerald-200 dark:border-emerald-800', badge: 'healthy', text: 'text-emerald-700 dark:text-emerald-300', label: 'Low' },
};

const CATEGORY_ICONS = {
  disease:        { Icon: AlertTriangle, color: 'text-rose-500', label: 'Disease' },
  weather:        { Icon: CloudRain,     color: 'text-sky-500', label: 'Weather' },
  soil:           { Icon: Droplets,      color: 'text-teal-500', label: 'Soil & Irrigation' },
  battery:        { Icon: BatteryWarning,color: 'text-amber-500', label: 'Battery' },
  device:         { Icon: WifiOff,       color: 'text-slate-500', label: 'Device Status' },
  recommendation: { Icon: Activity,      color: 'text-purple-500', label: 'Recommendation' },
  system:         { Icon: Activity,      color: 'text-purple-500', label: 'System' },
};

const CATEGORIES = ['All', 'disease', 'weather', 'soil', 'battery', 'device', 'recommendation', 'system'];
const PRIORITIES = ['All', 'Critical', 'High', 'Medium', 'Low'];

export default function NotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
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

  const [selectedTimeline, setSelectedTimeline] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [customActionText, setCustomActionText] = useState('');

  const fetchNotifications = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: limit });
      if (category !== 'All') params.set('category', category);
      if (priority !== 'All') params.set('priority', priority);
      if (unreadOnly)         params.set('unread_only', 'true');
      const res = await API.get(`/api/v1/notifications?${params}`);
      setNotifications(res.data.notifications || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
      setPage(p);
    } catch {
      setToastMsg('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [category, priority, unreadOnly, limit]);

  useEffect(() => { fetchNotifications(1); }, [fetchNotifications]);

  const { latestAlert } = useWebSocket();
  useEffect(() => {
    if (latestAlert) {
      setNotifications(prev => {
        // Prevent duplicate if notification_id or id already exists in list
        const exists = prev.some(n => (n.notification_id && n.notification_id === latestAlert.notification_id) || (n.id && n.id === latestAlert.id) || (n._id && n._id === latestAlert._id));
        if (exists) return prev;
        return [latestAlert, ...prev];
      });
      setTotal(prev => prev + 1);
    }
  }, [latestAlert]);

  const handleMarkRead = async (id) => {
    try {
      await API.put(`/api/v1/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
      setToastMsg('Marked as read.');
    } catch { setToastMsg('Failed to mark as read.'); }
  };

  const handleAcknowledge = async (id, action) => {
    try {
      await API.post(`/api/v1/notifications/${id}/acknowledge`, { acknowledged_action: action });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, status: 'acknowledged', read: true } : n));
      setAcknowledgingId(null);
      setCustomActionText('');
      setToastMsg('Alert acknowledged.');
    } catch { setToastMsg('Failed to acknowledge alert.'); }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/api/v1/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      setTotal(t => Math.max(0, t - 1));
      setToastMsg('Notification deleted.');
    } catch { setToastMsg('Failed to delete notification.'); }
  };

  const handleReadAll = async () => {
    try {
      await API.post('/api/v1/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setToastMsg('All notifications marked as read.');
    } catch { setToastMsg('Failed to mark all as read.'); }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear all notifications?')) return;
    try {
      await API.delete('/api/v1/notifications/clear');
      setNotifications([]);
      setTotal(0);
      setToastMsg('Inbox cleared.');
    } catch { setToastMsg('Failed to clear notifications.'); }
  };

  const filteredNotifications = notifications.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (n.title || '').toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto w-full">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto w-full pb-12"
    >
      {/* Title Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Notifications Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time disease warnings, IoT sensor threshold triggers &amp; system telemetry advisories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
              <Link to="/admin?tab=broadcast">
                <Button variant="primary" size="sm" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold shadow-md shadow-amber-500/20">
                  📢 Dispatch Broadcast Alert
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleReadAll} leftIcon={<CheckCheck className="w-4 h-4 text-emerald-600" />} className="flex-1 sm:flex-none">
              Mark All Read
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />} className="flex-1 sm:flex-none">
              Clear Inbox
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <Card glass className="p-4 border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <Input
            placeholder="Search notification title or body..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Category">
            {CATEGORIES.map(c => <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </Select>

          <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
            {PRIORITIES.map(p => <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={p} value={p}>{p === 'All' ? 'All Priorities' : p}</option>)}
          </Select>

          <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))} label="Show Limit">
            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={10}>10 Items</option>
            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={25}>25 Items</option>
            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={50}>50 Items</option>
            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={100}>100 Items</option>
            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={1000}>Show All</option>
          </Select>

          <div className="flex items-center pt-5">
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all w-full border ${
                unreadOnly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {unreadOnly ? 'Showing Unread Only' : 'Show Unread Only'}
            </button>
          </div>
        </div>
      </Card>

      {/* Notifications Timeline List */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No Notifications Found"
          description="Your inbox is completely clear! All farm environmental and diagnostic alerts will stream here."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredNotifications.map((item) => {
              const pc = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.Low;
              const catObj = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.system;
              const CatIcon = catObj.Icon;

              return (
                <motion.div
                  key={item.notification_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden bg-white dark:bg-slate-900 ${pc.border} ${
                    !item.read ? 'shadow-md border-l-4 border-l-emerald-500' : 'opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${pc.bg} shrink-0 mt-0.5`}>
                        <CatIcon className={`w-5 h-5 ${catObj.color}`} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</h3>
                          <Badge variant={pc.badge}>{item.priority}</Badge>
                          {!item.read && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">{item.message}</p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block pt-1">
                          {(item.lifecycle?.created_at || item.created_at) ? formatDateTime(item.lifecycle?.created_at || item.created_at, { seconds: true }) : 'Unknown Date'} • {timeAgo(item.lifecycle?.created_at || item.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!item.read && (
                        <Button variant="ghost" size="icon" onClick={() => handleMarkRead(item.notification_id)} title="Mark Read">
                          <Check className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.notification_id)} title="Delete Notification">
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Pagination Controls */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-5 mt-4 border-t border-slate-200/60 dark:border-slate-800/80">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchNotifications(Math.max(1, page - 1))} 
                disabled={page === 1}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>
              
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                Page {page} of {pages}
              </span>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchNotifications(Math.min(pages, page + 1))} 
                disabled={page === pages}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
