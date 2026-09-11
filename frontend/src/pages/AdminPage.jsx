import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Crown, 
  User, 
  Sprout, 
  Globe, 
  Lock,
  Edit3,
  UserPlus,
  Cpu,
  FileText,
  Activity,
  Sliders,
  Server,
  Zap,
  Radio,
  Wifi,
  Database,
  Key,
  Trash2,
  X,
  UploadCloud, 
  DownloadCloud, 
  ActivitySquare,
  MapPin,
  TrendingUp,
  Info,
  ArrowLeft,
  ChevronRight,
  Calendar,
  Download,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Headphones,
  PhoneCall,
  MessageCircle
} from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import UserGeographyMap from '../components/admin/UserGeographyMap';
import { parseServerDate, formatDateTime, timeAgo } from '../utils/dateUtils';

export default function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam && tabParam !== 'overview' ? tabParam : 'overview';

  const setTab = (tabId) => {
    if (tabId === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // IoT & Security state
  const [iotNodes, setIotNodes] = useState([]);
  const [selectedIotNode, setSelectedIotNode] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logDateFilter, setLogDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'custom'
  const [customLogDate, setCustomLogDate] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('all'); // 'all', 'INFO', 'WARNING', 'ERROR'
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logViewMode, setLogViewMode] = useState('grouped'); // 'grouped' or 'table'

  // Firmware & OTA state
  const [firmwareList, setFirmwareList] = useState([]);
  const [otaLogs, setOtaLogs] = useState([]);
  const [uploadingFirmware, setUploadingFirmware] = useState(false);
  const [firmwareFile, setFirmwareFile] = useState(null);
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [firmwareModel, setFirmwareModel] = useState('ESP32 DevKit V1');
  const [firmwareNotes, setFirmwareNotes] = useState('');

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('High');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Admin Modals & Data Editing State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'farmer', preferred_language: 'en', farm_location: '' });
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create User State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'farmer', preferred_language: 'en', farm_location: '' });

  // IoT Ingestion Master Switch State
  const [iotIngestionEnabled, setIotIngestionEnabled] = useState(false);
  const [togglingIngestion, setTogglingIngestion] = useState(false);

  // Farmer Support & Helpdesk State
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportStats, setSupportStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, urgent_callbacks: 0 });
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportStatusFilter, setSupportStatusFilter] = useState('all');
  const [supportCategoryFilter, setSupportCategoryFilter] = useState('all');
  const [supportPriorityFilter, setSupportPriorityFilter] = useState('all');
  const [supportSearchTerm, setSupportSearchTerm] = useState('');
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [ticketResolutionInputs, setTicketResolutionInputs] = useState({});
  const [supportConfig, setSupportConfig] = useState({
    whatsapp_number: '+91 98765 43210',
    support_phone: '1800-180-1551',
    support_hours: '24x7 Emergency Assistance',
    auto_reply_enabled: true
  });
  const [savingSupportConfig, setSavingSupportConfig] = useState(false);

  const fetchSupportConfig = async () => {
    try {
      const res = await API.get('/api/support/config');
      if (res.data && res.data.whatsapp_number) {
        setSupportConfig(res.data);
      }
    } catch (e) {
      console.warn('Could not fetch support config:', e);
    }
  };

  const handleSaveSupportConfig = async (e) => {
    if (e) e.preventDefault();
    setSavingSupportConfig(true);
    setError('');
    setSuccessMsg('');
    try {
      await API.put('/api/support/admin/config', supportConfig);
      setSuccessMsg('Helpdesk contact & WhatsApp settings saved! All farmer app buttons updated in real-time.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update helpdesk configuration.');
    } finally {
      setSavingSupportConfig(false);
    }
  };

  const fetchSupportTickets = async () => {
    setSupportLoading(true);
    try {
      const params = {};
      if (supportStatusFilter !== 'all') params.status_filter = supportStatusFilter;
      if (supportCategoryFilter !== 'all') params.category_filter = supportCategoryFilter;
      if (supportPriorityFilter !== 'all') params.priority_filter = supportPriorityFilter;
      if (supportSearchTerm) params.search = supportSearchTerm;

      const [ticketsRes, statsRes] = await Promise.all([
        API.get('/api/support/admin/tickets', { params }),
        API.get('/api/support/admin/stats')
      ]);
      setSupportTickets(ticketsRes.data?.tickets || []);
      setSupportStats(statsRes.data || { total: 0, open: 0, in_progress: 0, resolved: 0, urgent_callbacks: 0 });
    } catch (e) {
      console.warn('Could not fetch support tickets:', e);
    } finally {
      setSupportLoading(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, newStatus, resolutionNotes = null) => {
    setUpdatingTicketId(ticketId);
    setError('');
    setSuccessMsg('');
    try {
      const payload = { status: newStatus };
      if (resolutionNotes !== null) {
        payload.resolution_notes = resolutionNotes;
      }
      await API.patch(`/api/support/admin/tickets/${ticketId}`, payload);
      setSuccessMsg(`Ticket updated to '${newStatus}'!`);
      fetchSupportTickets();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update ticket status.');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const fetchIoTIngestionStatus = async () => {
    try {
      const res = await API.get('/api/admin/iot-ingestion/status');
      setIotIngestionEnabled(Boolean(res.data?.enabled));
    } catch (e) {
      console.warn('Could not fetch IoT ingestion status:', e);
    }
  };

  const handleToggleIoTIngestion = async () => {
    setTogglingIngestion(true);
    setError('');
    setSuccessMsg('');
    try {
      const nextState = !iotIngestionEnabled;
      const res = await API.post('/api/admin/iot-ingestion/toggle', { enabled: nextState });
      setIotIngestionEnabled(Boolean(res.data?.enabled));
      setSuccessMsg(res.data?.message || `IoT ingestion is now ${nextState ? 'ENABLED' : 'PAUSED'}.`);
      fetchAuditLogs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to toggle IoT ingestion setting.');
    } finally {
      setTogglingIngestion(false);
    }
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setIsBroadcasting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await API.post('/api/admin/broadcast', {
        title: broadcastTitle,
        message: broadcastMessage,
        priority: broadcastPriority
      });
      setSuccessMsg(res.data?.message || 'Broadcast alert successfully dispatched to all registered users!');
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastPriority('High');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to dispatch broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await API.post('/api/v1/admin/create-user', createForm);
      setSuccessMsg(`Successfully registered new account for ${createForm.email}!`);
      if (res.data?.user) {
        setUsersList(prev => [res.data.user, ...prev]);
      } else {
        fetchUsers();
      }
      setIsCreateUserOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'farmer', preferred_language: 'en', farm_location: '' });
    } catch (err) {
      try {
        const res = await API.post('/api/admin/create-user', createForm);
        setSuccessMsg(`Successfully registered new account for ${createForm.email}!`);
        if (res.data?.user) {
          setUsersList(prev => [res.data.user, ...prev]);
        } else {
          fetchUsers();
        }
        setIsCreateUserOpen(false);
        setCreateForm({ name: '', email: '', password: '', role: 'farmer', preferred_language: 'en', farm_location: '' });
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Failed to create user account.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || u.full_name || '',
      email: u.email || '',
      role: u.role || 'farmer',
      preferred_language: u.preferred_language || 'en',
      farm_location: u.farm_location || '',
      password: ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { password, ...detailsPayload } = editForm;
      await API.put(`/api/v1/admin/users/${editingUser.id}`, detailsPayload);
      
      let pwdMsg = '';
      if (password && password.trim()) {
        await API.post(`/api/v1/admin/users/${editingUser.id}/reset-password`, { new_password: password.trim() });
        pwdMsg = ' & password updated!';
      }

      setSuccessMsg(`User ${editForm.email} updated${pwdMsg}`);
      setUsersList(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...detailsPayload } : u));
      setEditingUser(null);
    } catch (err) {
      try {
        const { password, ...detailsPayload } = editForm;
        await API.put(`/api/admin/users/${editingUser.id}`, detailsPayload);

        let pwdMsg = '';
        if (password && password.trim()) {
          await API.post(`/api/admin/users/${editingUser.id}/reset-password`, { new_password: password.trim() });
          pwdMsg = ' & password updated!';
        }

        setSuccessMsg(`User ${editForm.email} updated${pwdMsg}`);
        setUsersList(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...detailsPayload } : u));
        setEditingUser(null);
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Failed to update user details.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetPwdUser || !newPasswordInput) return;
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await API.post(`/api/v1/admin/users/${resetPwdUser.id}/reset-password`, { new_password: newPasswordInput });
      setSuccessMsg(`Password for ${resetPwdUser.email} reset successfully!`);
      setResetPwdUser(null);
      setNewPasswordInput('');
    } catch (err) {
      try {
        await API.post(`/api/admin/users/${resetPwdUser.id}/reset-password`, { new_password: newPasswordInput });
        setSuccessMsg(`Password for ${resetPwdUser.email} reset successfully!`);
        setResetPwdUser(null);
        setNewPasswordInput('');
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Password reset failed. Ensure it is 12+ chars with uppercase, number & symbol.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUserSubmit = async () => {
    if (!deleteUserTarget) return;
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await API.delete(`/api/v1/admin/users/${deleteUserTarget.id}`);
      setSuccessMsg(`Account for ${deleteUserTarget.email} permanently deleted.`);
      setUsersList(prev => prev.filter(u => u.id !== deleteUserTarget.id));
      setDeleteUserTarget(null);
    } catch (err) {
      try {
        await API.delete(`/api/admin/users/${deleteUserTarget.id}`);
        setSuccessMsg(`Account for ${deleteUserTarget.email} permanently deleted.`);
        setUsersList(prev => prev.filter(u => u.id !== deleteUserTarget.id));
        setDeleteUserTarget(null);
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Failed to delete user.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/api/v1/admin/users');
      setUsersList(res.data?.users || []);
    } catch (err) {
      try {
        const fallbackRes = await API.get('/api/admin/users');
        setUsersList(fallbackRes.data?.users || []);
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Failed to fetch registered users.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchIotNodes = async () => {
    try {
      const res = await API.get('/api/v1/devices/status');
      setIotNodes(res.data?.nodes || res.data || []);
    } catch (e) {
      console.warn("Could not fetch IoT nodes:", e);
    }
  };

  const fetchFirmwareData = async () => {
    try {
      const resList = await API.get('/api/v1/firmware/history');
      setFirmwareList(resList.data?.releases || []);
      const resLogs = await API.get('/api/v1/firmware/audit-logs');
      setOtaLogs(resLogs.data?.logs || []);
    } catch (e) {
      console.warn("Could not fetch firmware data:", e);
    }
  };

  const handleFirmwareUpload = async (e) => {
    e.preventDefault();
    if (!firmwareFile || !firmwareVersion) {
      setError('Please select a .bin file and specify a version string.');
      return;
    }
    setUploadingFirmware(true);
    const formData = new FormData();
    formData.append('file', firmwareFile);
    formData.append('version', firmwareVersion);
    formData.append('hardware_model', firmwareModel);
    formData.append('release_notes', firmwareNotes);
    try {
      await API.post('/api/v1/firmware/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessMsg(`Firmware release ${firmwareVersion} uploaded and ready for OTA sync!`);
      setFirmwareFile(null);
      setFirmwareVersion('');
      setFirmwareNotes('');
      fetchFirmwareData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload firmware binary.');
    } finally {
      setUploadingFirmware(false);
    }
  };
  
  const handleDeleteFirmware = async (version) => {
    if (!window.confirm(`Delete firmware release ${version}?`)) return;
    try {
      await API.delete(`/api/v1/firmware/${version}`);
      setSuccessMsg(`Firmware ${version} removed.`);
      fetchFirmwareData();
    } catch (e) {
      setError('Failed to delete firmware.');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await API.get('/api/admin/audit-logs');
      setAuditLogs(res.data || []);
    } catch (e) {
      console.warn("Could not fetch audit logs:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchIotNodes();
    fetchAuditLogs();
    fetchFirmwareData();
    fetchIoTIngestionStatus();
    fetchSupportTickets();
    fetchSupportConfig();
    
    const iotInterval = setInterval(fetchIotNodes, 10000);
    const auditInterval = setInterval(fetchAuditLogs, 15000);
    const supportInterval = setInterval(fetchSupportTickets, 20000);
    return () => {
      clearInterval(iotInterval);
      clearInterval(auditInterval);
      clearInterval(supportInterval);
    };
  }, []);

  // Fetch support tickets whenever support filters change
  useEffect(() => {
    if (activeTab === 'support') {
      fetchSupportTickets();
    }
  }, [activeTab, supportStatusFilter, supportCategoryFilter, supportPriorityFilter]);

  // Auto-dismiss messages
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    setSuccessMsg('');
    setError('');
    try {
      await API.put(`/api/v1/admin/users/${userId}/role?new_role=${newRole}`);
      setSuccessMsg(`User role updated successfully to '${newRole}'.`);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      try {
        await API.put(`/api/admin/users/${userId}/role?new_role=${newRole}`);
        setSuccessMsg(`User role updated successfully to '${newRole}'.`);
        setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } catch (err2) {
        setError('Failed to update user role.');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = 
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.id && u.id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesProfile = profileFilter === 'all' || (profileFilter === 'completed' && u.farm_profile_completed);
    return matchesSearch && matchesRole && matchesProfile;
  });

  const totalUsers = usersList.length;
  const totalAdmins = usersList.filter(u => u.role === 'admin').length;
  const totalFarmers = usersList.filter(u => u.role === 'farmer').length;
  const completedProfiles = usersList.filter(u => u.farm_profile_completed).length;
  const onlineIotCount = iotNodes.filter(n => n.status === 'online').length;

  // 7 Core Administrator Modules Configuration
  const adminTabs = [
    { 
      id: 'users', 
      label: 'Registered Users', 
      description: 'User directory, role management, and farmer account inspection.',
      icon: Users, 
      badge: `${totalUsers} Users`, 
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
    },
    { 
      id: 'broadcast', 
      label: 'Global Broadcasts', 
      description: 'Dispatch real-time emergency agricultural alerts with priority tags and expiry timestamps.',
      icon: Radio, 
      badge: 'Live Stream', 
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
    },
    { 
      id: 'geography', 
      label: 'Farmer Geography', 
      description: 'Interactive state/district choropleth and farmer distribution map.',
      icon: Globe, 
      badge: 'Choropleth Map', 
      badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' 
    },
    { 
      id: 'iot', 
      label: 'IoT Hardware Fleet', 
      description: 'Real-time ESP32 node registry, battery levels, and telemetry heartbeats.',
      icon: Cpu, 
      badge: onlineIotCount > 0 ? `${onlineIotCount} Online` : 'Standby', 
      badgeColor: onlineIotCount > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' 
    },
    { 
      id: 'firmware', 
      label: 'Firmware OTA', 
      description: 'Over-the-air firmware binary uploads and remote hardware flashing controls.',
      icon: UploadCloud, 
      badge: firmwareList.length > 0 ? firmwareList[0].version : 'OTA Ready', 
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' 
    },
    { 
      id: 'logs', 
      label: 'Security Audit Logs', 
      description: 'Access logs, authentication events, and system security timestamps.',
      icon: FileText, 
      badge: 'Live Audit', 
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' 
    },
    { 
      id: 'support', 
      label: 'Farmer Support & Helpdesk', 
      description: 'Incoming farmer support tickets, 15-minute phone callback requests, and issue resolution.',
      icon: Headphones, 
      badge: supportStats?.open > 0 ? `${supportStats.open} Open` : 'Helpdesk', 
      badgeColor: supportStats?.urgent_callbacks > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
    },
    { 
      id: 'settings', 
      label: 'System Health & Specs', 
      description: 'Server CPU, memory, database latency, and API specs.',
      icon: Sliders, 
      badge: 'Health 100%', 
      badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' 
    },
  ];

  // Strict Admin Role Guard
  if (user && user.role?.toLowerCase() !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-lg mx-auto">
        <div className="p-4 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
          <ShieldCheck className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">403 Access Denied</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          You are signed in as <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-rose-600 dark:text-rose-400 font-bold capitalize">{user.role}</code>. The System Administration Control Panel is strictly restricted to verified <strong>Admin</strong> accounts.
        </p>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          Return to Farm Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600 shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. OVERVIEW HUB VIEW (Shown when activeTab === 'overview')    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Command Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 dark:from-slate-950 dark:via-emerald-950 dark:to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-emerald-900/40 relative overflow-hidden">
            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise Admin Command Center</span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Administrative Control Hub
              </h1>
              
              <p className="text-sm text-slate-300 max-w-2xl mt-1">
                Manage registered farmers, emergency broadcasts, IoT fleet telemetry, OTA firmware deployments, security logs, and infrastructure health.
              </p>
            </div>

            <button
              onClick={() => { fetchUsers(); fetchIotNodes(); fetchAuditLogs(); fetchFirmwareData(); }}
              disabled={loading}
              className="relative z-10 self-start md:self-center flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer btn-spring"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Portal Data</span>
            </button>
          </div>

          {/* Quick Platform Metrics Summary Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Registered Users</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{totalUsers} Total</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Global Broadcast</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">Live Stream</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">IoT Fleet</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{onlineIotCount} Online</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">System Status</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">100% Operational</p>
              </div>
            </div>
          </div>

          {/* 7 Core Admin Control Modules (Interactive Box Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  7 Core Administrative Modules
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                Click any module box to open dedicated page
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {adminTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all duration-200 text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 w-full mb-3">
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs group-hover:shadow-md group-hover:shadow-emerald-600/30">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${tab.badgeColor}`}>
                          {tab.badge}
                        </span>
                      </div>

                      <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-1.5">
                        {tab.label}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {tab.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Open Workspace</span>
                      <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. DEDICATED MODULE PAGE HEADER WITH RETURN BUTTON             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab !== 'overview' && (
        <div className="space-y-4">
          {/* Top Return Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              onClick={() => setTab('overview')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-800 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300 font-extrabold text-xs border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer btn-spring shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Admin Modules</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <button onClick={() => setTab('overview')} className="hover:underline text-slate-700 dark:text-slate-300 cursor-pointer font-bold">
                Admin Hub
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {adminTabs.find(t => t.id === activeTab)?.label || activeTab}
              </span>
            </div>

            <button
              onClick={() => { fetchUsers(); fetchIotNodes(); fetchAuditLogs(); fetchFirmwareData(); fetchSupportTickets(); }}
              disabled={loading || supportLoading}
              className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loading || supportLoading) ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>

          {/* Dedicated Module Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 dark:from-slate-950 dark:via-emerald-950 dark:to-slate-950 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-emerald-900/40 relative overflow-hidden">
            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                {activeTab === 'users' && <Users className="w-3.5 h-3.5" />}
                {activeTab === 'broadcast' && <Radio className="w-3.5 h-3.5" />}
                {activeTab === 'geography' && <Globe className="w-3.5 h-3.5" />}
                {activeTab === 'iot' && <Cpu className="w-3.5 h-3.5" />}
                {activeTab === 'firmware' && <UploadCloud className="w-3.5 h-3.5" />}
                {activeTab === 'logs' && <FileText className="w-3.5 h-3.5" />}
                {activeTab === 'settings' && <Sliders className="w-3.5 h-3.5" />}
                {activeTab === 'support' && <Headphones className="w-3.5 h-3.5" />}
                <span>
                  {activeTab === 'users' && 'Farmer Directory & Roles'}
                  {activeTab === 'broadcast' && 'Emergency Broadcasting Service'}
                  {activeTab === 'geography' && 'State & District Choropleth'}
                  {activeTab === 'iot' && 'ESP32 Device Telemetry'}
                  {activeTab === 'firmware' && 'Over-The-Air Fleet Flashing'}
                  {activeTab === 'logs' && 'Security & Access Logs'}
                  {activeTab === 'settings' && 'Platform Health & Specs'}
                  {activeTab === 'support' && 'Farmer Support & Emergency Helpdesk'}
                </span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {adminTabs.find(t => t.id === activeTab)?.label}
              </h1>
              
              <p className="text-sm text-slate-300 max-w-2xl mt-1">
                {activeTab === 'users' && <span>Manage farmer accounts, roles, credentials, and locations in <code className="bg-emerald-950/80 px-1.5 py-0.5 rounded text-emerald-300">crop_disease_db.users</code></span>}
                {activeTab === 'broadcast' && 'Dispatch real-time emergency disease outbreak alerts and system announcements to all farmers.'}
                {activeTab === 'geography' && 'Visualize where your registered farmers and farm fields are located across Indian states.'}
                {activeTab === 'iot' && 'Monitor all connected ESP32 field nodes, battery levels, signal strength, and live telemetry.'}
                {activeTab === 'firmware' && 'Upload and deploy Over-The-Air (OTA) binary firmware updates to deployed field devices.'}
                {activeTab === 'logs' && 'Real-time security log stream of user logins, role modifications, and administrative operations.'}
                {activeTab === 'settings' && 'Inspect core platform health, API status, database connectivity, and runtime configurations.'}
                {activeTab === 'support' && 'Directly assist registered farmers, dispatch 15-minute phone callbacks, WhatsApp consultations, and resolve technical issues.'}
              </p>
            </div>

            <span className={`self-start md:self-center px-3.5 py-1 rounded-full text-xs font-extrabold border ${adminTabs.find(t => t.id === activeTab)?.badgeColor || 'bg-emerald-600 text-white'}`}>
              {adminTabs.find(t => t.id === activeTab)?.badge}
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: REGISTERED USERS MANAGEMENT                       */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* KPI Interactive Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Registered */}
            <button
              onClick={() => { setRoleFilter('all'); setProfileFilter('all'); }}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border text-left transition-all duration-200 cursor-pointer flex items-center justify-between card-lift ${
                roleFilter === 'all' && profileFilter === 'all'
                  ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/30 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Registered</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalUsers} Users</h3>
                </div>
              </div>
              {roleFilter === 'all' && profileFilter === 'all' && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                  Active
                </span>
              )}
            </button>

            {/* Card 2: Admins */}
            <button
              onClick={() => { setRoleFilter('admin'); setProfileFilter('all'); }}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border text-left transition-all duration-200 cursor-pointer flex items-center justify-between card-lift ${
                roleFilter === 'admin' && profileFilter === 'all'
                  ? 'border-amber-500 shadow-md ring-2 ring-amber-500/30 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-300 dark:hover:border-amber-800'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admins</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalAdmins} Admins</h3>
                </div>
              </div>
              {roleFilter === 'admin' && profileFilter === 'all' && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                  Active
                </span>
              )}
            </button>

            {/* Card 3: Farmers */}
            <button
              onClick={() => { setRoleFilter('farmer'); setProfileFilter('all'); }}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border text-left transition-all duration-200 cursor-pointer flex items-center justify-between card-lift ${
                roleFilter === 'farmer' && profileFilter === 'all'
                  ? 'border-sky-500 shadow-md ring-2 ring-sky-500/30 dark:bg-sky-950/20'
                  : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-sky-300 dark:hover:border-sky-800'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                  <Sprout className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Farmers</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalFarmers} Farmers</h3>
                </div>
              </div>
              {roleFilter === 'farmer' && profileFilter === 'all' && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
                  Active
                </span>
              )}
            </button>

            {/* Card 4: Profiles Completed */}
            <button
              onClick={() => { setRoleFilter('all'); setProfileFilter('completed'); }}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border text-left transition-all duration-200 cursor-pointer flex items-center justify-between card-lift ${
                profileFilter === 'completed'
                  ? 'border-purple-500 shadow-md ring-2 ring-purple-500/30 dark:bg-purple-950/20'
                  : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-purple-300 dark:hover:border-purple-800'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profiles Completed</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{completedProfiles} Users</h3>
                </div>
              </div>
              {profileFilter === 'completed' && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                  Active
                </span>
              )}
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by name, email, or user ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-200"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-200 font-semibold"
              >
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">All Roles ({totalUsers})</option>
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="admin">Admins ({totalAdmins})</option>
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="farmer">Farmers ({totalFarmers})</option>
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="tester">Testers</option>
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="researcher">Researchers</option>
              </select>

              <button
                onClick={() => setIsCreateUserOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap btn-spring"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register New Account</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="py-4 px-4">#</th>
                    <th className="py-4 px-4">User</th>
                    <th className="py-4 px-4">Email</th>
                    <th className="py-4 px-4">Role</th>
                    <th className="py-4 px-4">Location</th>
                    <th className="py-4 px-4">Lang</th>
                    <th className="py-4 px-4">Profile</th>
                    <th className="py-4 px-4">Registered Date</th>
                    <th className="py-4 px-4 text-right">Role Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold">No registered users match your search criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, idx) => (
                      <tr key={u.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              u.role === 'admin' 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                : u.role === 'tester'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                            }`}>
                              {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">{u.name || 'Unnamed'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {u.id?.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono">
                          {u.email}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            u.role === 'admin'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
                              : u.role === 'tester'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                          }`}>
                            {u.role === 'admin' ? <Crown className="w-3 h-3 text-amber-500" /> : <User className="w-3 h-3 text-emerald-500" />}
                            <span className="capitalize">{u.role || 'farmer'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          {u.farm_location || 'N/A'}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 uppercase font-bold">
                          {u.preferred_language || 'en'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            u.farm_profile_completed
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {u.farm_profile_completed ? 'Completed' : 'Pending'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {u.created_at ? formatDateTime(u.created_at) : 'N/A'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Role Select Dropdown */}
                            <select
                              value={u.role || 'farmer'}
                              onChange={e => handleRoleChange(u.id, e.target.value)}
                              disabled={updatingId === u.id}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="farmer">Farmer</option>
                              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="admin">Admin</option>
                              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="tester">Tester</option>
                              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="researcher">Researcher</option>
                            </select>

                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(u)}
                              title="Edit User Details"
                              className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Reset Password Button */}
                            <button
                              onClick={() => { setResetPwdUser(u); setNewPasswordInput(''); }}
                              title="Reset User Password"
                              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User Button */}
                            <button
                              onClick={() => setDeleteUserTarget(u)}
                              title="Delete User Account"
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GLOBAL SYSTEM BROADCASTS                          */}
      {/* ======================================================== */}
      {activeTab === 'broadcast' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Radio className="w-6 h-6 text-rose-500 animate-pulse" />
                <span>Dispatch Global Broadcast Notification</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Push instantaneous mass announcements, emergency disease outbreak alerts, or server maintenance notices to all {totalUsers} registered farmer accounts.
              </p>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">Alert Title</label>
                <input 
                  required 
                  value={broadcastTitle} 
                  onChange={(e) => setBroadcastTitle(e.target.value)} 
                  placeholder="e.g. 🚨 Urgent: Yellow Rust Outbreak Warning in Guntur" 
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-semibold text-xs" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">Priority Level</label>
                <select 
                  required 
                  value={broadcastPriority} 
                  onChange={(e) => setBroadcastPriority(e.target.value)} 
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-semibold text-xs cursor-pointer"
                >
                  <option value="Normal">Normal — Standard informational update</option>
                  <option value="High">High — Bypasses quiet hours & highlights card</option>
                  <option value="Emergency">Emergency — Critical Red Alert banner on farmer dashboards</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">Message Content</label>
                <textarea 
                  required 
                  value={broadcastMessage} 
                  onChange={(e) => setBroadcastMessage(e.target.value)} 
                  placeholder="Type the detailed advisory message, preventive measures, or scheduling notice that will be received by all farmers..." 
                  rows={4} 
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all text-xs"
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isBroadcasting} 
                className="px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 bg-rose-600 hover:bg-rose-700 text-white w-full sm:w-auto flex justify-center items-center gap-2 shadow-lg hover:shadow-rose-500/25 cursor-pointer btn-spring"
              >
                <Radio size={16} />
                <span>{isBroadcasting ? 'Dispatching to Farmers...' : `Send Broadcast to All ${totalUsers} Users`}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: FARMER GEOGRAPHY MAP                              */}
      {/* ======================================================== */}
      {activeTab === 'geography' && (
        <div className="space-y-6">
          <UserGeographyMap />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: IOT HARDWARE FLEET REGISTRY                       */}
      {/* ======================================================== */}
      {activeTab === 'iot' && (() => {
        const displayNodes = iotNodes.length > 0 ? iotNodes.map((dev, idx) => {
          const isOnline = dev.status === "online";
          const telem = dev.latest_telemetry || {};
          return {
            device_id: dev.device_id || `ESP32-AGRI-NODE-${idx+1}`,
            name: dev.device_name || `Field Telemetry Node #${idx+1}`,
            status: isOnline ? "ONLINE" : "OFFLINE",
            firmware_version: dev.firmware_version || "v2.5.0-production",
            ip_address: isOnline ? (telem.ip || "10.54.220.146") : "OFFLINE",
            mac_address: dev.mac_address || "A4:CF:12:8B:99:C1",
            rssi: isOnline ? (telem.wifi_rssi || telem.rssi || -58) : null,
            battery: isOnline ? `${telem.battery_voltage ? telem.battery_voltage.toFixed(2) : '3.95'}V (${Math.round(telem.battery_percentage || 88)}%)` : "0.00V",
            telemetry: telem,
            last_seen: dev.last_seen || dev.updated_at
          };
        }) : [];

        const activeCount = displayNodes.filter(n => n.status === "ONLINE").length;

        return (
          <div className="space-y-6">
            {/* Master IoT Ingestion Control Banner */}
            <div className={`p-5 sm:p-6 rounded-3xl border transition-all duration-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              iotIngestionEnabled
                ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/30 border-emerald-500/40 text-white'
                : 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border-amber-500/40 text-white'
            }`}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${iotIngestionEnabled ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    iotIngestionEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {iotIngestionEnabled ? '● Telemetry Ingestion LIVE' : '⏸ Telemetry Ingestion PAUSED'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-100 flex items-center gap-2">
                  <span>IoT Field Sensor Telemetry Master Gate</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {iotIngestionEnabled 
                    ? 'The backend is actively receiving, validating, and saving real-time sensor packets from ESP32 nodes into MongoDB Atlas.' 
                    : 'IoT data transmission is currently stopped. Incoming ESP32 packets are blocked to protect database storage until you turn this on.'}
                </p>
              </div>

              <button
                onClick={handleToggleIoTIngestion}
                disabled={togglingIngestion}
                className={`self-start md:self-center px-5 py-3 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer shrink-0 flex items-center gap-2 btn-spring ${
                  iotIngestionEnabled
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 hover:shadow-amber-500/25'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-emerald-500/25'
                }`}
              >
                {togglingIngestion ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating Gateway...</span>
                  </>
                ) : iotIngestionEnabled ? (
                  <>
                    <X className="w-4 h-4" />
                    <span>Turn OFF / Pause Ingestion</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    <span>Turn ON / Enable Ingestion</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-emerald-500" />
                    <span>ESP32 Hardware Nodes Fleet Registry</span>
                  </h2>
                  <p className="text-xs text-slate-400">Real-time status, battery levels, and telemetry from deployed ESP32 field devices.</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${activeCount > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300"}`}>
                  {activeCount} Active / {displayNodes.length} Total Nodes
                </span>
              </div>

              {displayNodes.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 mx-auto flex items-center justify-center">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No ESP32 Hardware Registered</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Field hardware nodes will automatically register here upon transmitting their first Wi-Fi telemetry packet.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {displayNodes.map((node, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedIotNode(node)}
                      className={`p-5 rounded-2xl bg-gradient-to-br ${node.status === "ONLINE" ? "from-slate-50 to-emerald-50/30 dark:from-slate-800/80 dark:to-slate-900 border-emerald-200/60 dark:border-emerald-900/40 hover:border-emerald-500" : "from-slate-50 to-slate-100/50 dark:from-slate-800/80 dark:to-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400"} border shadow-sm hover:shadow-md transition-all cursor-pointer space-y-3 group`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl ${node.status === "ONLINE" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-500/10 text-slate-400"} group-hover:scale-110 transition-transform`}>
                            <Cpu className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{node.device_id}</h4>
                            <p className="text-[10px] text-slate-400">{node.name}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${node.status === "ONLINE" ? "bg-emerald-500 text-white animate-pulse" : "bg-slate-400 text-white"}`}>
                          {node.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/60 dark:border-slate-800">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Firmware</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{node.firmware_version}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Wi-Fi RSSI</span>
                          <span className={`font-mono font-bold ${node.status === "ONLINE" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>{node.status === "ONLINE" ? `${node.rssi} dBm` : "OFFLINE"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">IP Address</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{node.ip_address}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Battery Power</span>
                          <span className={`font-bold ${node.status === "ONLINE" ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}`}>{node.battery}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                        <span>Tap to view live telemetry &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* TAB 5: FIRMWARE & OVER-THE-AIR (OTA) UPDATES             */}
      {/* ======================================================== */}
      {activeTab === 'firmware' && (() => {
        const otaSuccessCount = otaLogs.filter(l => l.action === 'OTA_SYNC' && l.details?.status === 'SUCCESS').length;
        const otaFailCount = otaLogs.filter(l => l.action === 'OTA_SYNC' && (l.details?.status === 'FAILED' || l.details?.status === 'FAILED_ROLLBACK')).length;
        const downloadCount = otaLogs.filter(l => l.action === 'FIRMWARE_DOWNLOAD').length;
        
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 border-l-4 border-l-indigo-500 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                    <DownloadCloud size={24} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Firmware Downloads</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{downloadCount}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <ActivitySquare size={24} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Successful OTA Installs</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{otaSuccessCount}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 border-l-4 border-l-rose-500 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Failed / Rolled Back</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{otaFailCount}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-indigo-500" />
                    <span>Upload OTA Binary</span>
                  </h3>
                  <form onSubmit={handleFirmwareUpload} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Version String</label>
                      <input required value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} placeholder="e.g. v2.6.0" className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Target Hardware Model</label>
                      <input required value={firmwareModel} onChange={(e) => setFirmwareModel(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Compiled Binary File (.bin)</label>
                      <input type="file" required accept=".bin" onChange={(e) => setFirmwareFile(e.target.files[0])} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Release Notes</label>
                      <textarea value={firmwareNotes} onChange={(e) => setFirmwareNotes(e.target.value)} placeholder="Key improvements, pin updates, or power optimization..." className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300" rows={3}></textarea>
                    </div>
                    <button type="submit" disabled={uploadingFirmware} className="px-4 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs cursor-pointer">
                      {uploadingFirmware ? 'Uploading Binary...' : 'Deploy to OTA Fleet'}
                    </button>
                  </form>
                </div>
              </div>
              
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">Deployed Firmware Releases</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {firmwareList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">No firmware binary uploaded yet.</div>
                    ) : firmwareList.map((fw) => (
                      <div key={fw.version} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <div>
                          <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{fw.version}</p>
                          <p className="text-xs text-slate-500">{fw.hardware_model} • Uploaded on {fw.uploaded_at ? formatDateTime(fw.uploaded_at) : 'N/A'}</p>
                          {fw.release_notes && <p className="text-xs text-slate-400 mt-1 italic">"{fw.release_notes}"</p>}
                        </div>
                        <button onClick={() => handleDeleteFirmware(fw.version)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 cursor-pointer">
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">OTA Lifecycle Audit</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/50 text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                          <th className="py-3 px-4">Time</th>
                          <th className="py-3 px-4">Device</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Status / Version</th>
                        </tr>
                      </thead>
                      <tbody>
                        {otaLogs.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-6 text-slate-400">No OTA events recorded.</td></tr>
                        ) : otaLogs.slice(0, 10).map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/50">
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{log.timestamp ? formatDateTime(log.timestamp) : 'N/A'}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{log.actor}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                log.action === 'FIRMWARE_DOWNLOAD' 
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : log.details?.status === 'SUCCESS' 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {log.details?.version || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* TAB 6: SECURITY AUDIT LOGS (DAY-BY-DAY AUDIT CONSOLE)     */}
      {/* ======================================================== */}
      {activeTab === 'logs' && (() => {
        const getLogDateKey = (timestamp) => {
          const d = parseServerDate(timestamp);
          if (!d || isNaN(d.getTime())) return 'unknown';
          return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
        };

        const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const getLogDateFormatted = (dateKey) => {
          if (dateKey === todayKey) return `Today (${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })})`;
          if (dateKey === yesterdayKey) return `Yesterday (${yesterdayDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })})`;
          if (dateKey === 'unknown') return 'Legacy Records';
          const parts = dateKey.split('-');
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          }
          return dateKey;
        };

        const getLogTimeFormatted = (timestamp) => {
          const d = parseServerDate(timestamp);
          if (!d || isNaN(d.getTime())) return '--:--:--';
          return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST';
        };

        const getLogColor = (level, type) => {
          const lvl = (level || 'INFO').toUpperCase();
          const t = (type || '').toUpperCase();
          if (lvl === 'ERROR' || t.includes('FAILED') || t.includes('BLOCKED') || t.includes('LOCKED')) return { badge: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800', dot: 'bg-rose-500' };
          if (lvl === 'WARNING' || t.includes('WARN') || t.includes('DELETE') || t.includes('RESET')) return { badge: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800', dot: 'bg-amber-500' };
          if (t.includes('LOGIN') || t.includes('AUTH') || t.includes('REGISTER')) return { badge: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800', dot: 'bg-sky-500' };
          return { badge: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' };
        };

        // Filter logs
        const filteredAuditLogs = auditLogs.filter(log => {
          const logDateKey = getLogDateKey(log.timestamp);
          const logDateObj = parseServerDate(log.timestamp);

          // Date filter
          if (logDateFilter === 'today' && logDateKey !== todayKey) return false;
          if (logDateFilter === 'yesterday' && logDateKey !== yesterdayKey) return false;
          if (logDateFilter === 'week' && logDateObj && logDateObj < sevenDaysAgo) return false;
          if (logDateFilter === 'custom' && customLogDate && logDateKey !== customLogDate) return false;

          // Severity filter
          if (logLevelFilter !== 'all') {
            const level = (log.level || 'INFO').toUpperCase();
            if (logLevelFilter === 'ERROR' && !(level === 'ERROR' || log.event_type?.includes('FAILED') || log.event_type?.includes('BLOCKED'))) return false;
            if (logLevelFilter === 'WARNING' && level !== 'WARNING') return false;
            if (logLevelFilter === 'INFO' && level !== 'INFO') return false;
          }

          // Search term
          if (logSearchTerm.trim()) {
            const term = logSearchTerm.toLowerCase();
            const typeMatch = log.event_type && log.event_type.toLowerCase().includes(term);
            const ipMatch = log.client_ip && log.client_ip.toLowerCase().includes(term);
            const detailsMatch = log.details && JSON.stringify(log.details).toLowerCase().includes(term);
            const dateMatch = logDateKey.includes(term);
            if (!typeMatch && !ipMatch && !detailsMatch && !dateMatch) return false;
          }

          return true;
        });

        // Group by Date Key (Descending order)
        const groupedLogs = filteredAuditLogs.reduce((acc, log) => {
          const key = getLogDateKey(log.timestamp);
          if (!acc[key]) acc[key] = [];
          acc[key].push(log);
          return acc;
        }, {});

        const sortedDateKeys = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

        const totalTodayEvents = auditLogs.filter(l => getLogDateKey(l.timestamp) === todayKey).length;
        const totalYesterdayEvents = auditLogs.filter(l => getLogDateKey(l.timestamp) === yesterdayKey).length;
        const flaggedCount = auditLogs.filter(l => l.level === 'WARNING' || l.level === 'ERROR' || l.event_type?.includes('FAILED') || l.event_type?.includes('BLOCKED')).length;
        const uniqueIpsCount = new Set(auditLogs.map(l => l.client_ip).filter(Boolean)).size;

        const exportAuditLogsCSV = () => {
          if (!filteredAuditLogs.length) return;
          const headers = ['Date (IST)', 'Time (IST)', 'Severity Level', 'Event Action', 'Client IP', 'Details'];
          const rows = filteredAuditLogs.map(log => {
            const d = parseServerDate(log.timestamp);
            const dateStr = d ? d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
            const timeStr = d ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) + ' IST' : 'N/A';
            const detailsStr = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
            return `"${dateStr}","${timeStr}","${log.level || 'INFO'}","${log.event_type || ''}","${log.client_ip || ''}","${detailsStr}"`;
          });
          const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `agrishield_security_audit_logs_${todayKey}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="space-y-6">
            {/* 4 KPI Summary Cards for Daily Security Audit */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded Logs</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{auditLogs.length} Events</h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                <div className="p-3 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Events</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{totalTodayEvents} Events Today</h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flagged & Warnings</p>
                  <h3 className="text-xl font-black text-amber-600 dark:text-amber-400">{flaggedCount} Flagged</h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client IP Addresses</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{uniqueIpsCount} Unique IPs</h3>
                </div>
              </div>
            </div>

            {/* Daily Filter & Search Control Toolbar */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Date Filter Quick Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Filter By Day:</span>
                  </span>

                  <button
                    onClick={() => { setLogDateFilter('all'); setCustomLogDate(''); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      logDateFilter === 'all'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    All Days ({auditLogs.length})
                  </button>

                  <button
                    onClick={() => { setLogDateFilter('today'); setCustomLogDate(''); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      logDateFilter === 'today'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Today ({totalTodayEvents})
                  </button>

                  <button
                    onClick={() => { setLogDateFilter('yesterday'); setCustomLogDate(''); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      logDateFilter === 'yesterday'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Yesterday ({totalYesterdayEvents})
                  </button>

                  <button
                    onClick={() => { setLogDateFilter('week'); setCustomLogDate(''); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      logDateFilter === 'week'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Past 7 Days
                  </button>

                  {/* Specific Date Picker Input */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Select Date:</span>
                    <input
                      type="date"
                      value={customLogDate}
                      onChange={(e) => {
                        setCustomLogDate(e.target.value);
                        if (e.target.value) setLogDateFilter('custom');
                        else setLogDateFilter('all');
                      }}
                      className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Actions & Export */}
                <div className="flex items-center gap-2 self-start lg:self-auto">
                  <button
                    onClick={exportAuditLogsCSV}
                    disabled={filteredAuditLogs.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300 font-bold text-xs border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-all cursor-pointer disabled:opacity-40"
                    title="Export filtered logs to CSV file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Logs CSV</span>
                  </button>

                  <button
                    onClick={() => setLogViewMode(m => m === 'grouped' ? 'table' : 'grouped')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    <span>View: {logViewMode === 'grouped' ? 'Grouped by Day' : 'Stream Table'}</span>
                  </button>
                </div>
              </div>

              {/* Second Row: Search & Severity Selector */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by event type, IP, or user details..."
                    value={logSearchTerm}
                    onChange={(e) => setLogSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                  />
                  {logSearchTerm && (
                    <button onClick={() => setLogSearchTerm('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-xs font-bold text-slate-400">Severity:</span>
                  <select
                    value={logLevelFilter}
                    onChange={(e) => setLogLevelFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="INFO">🟢 INFO (Normal Activity)</option>
                    <option value="WARNING">🟡 WARNING (Modifications & Deletions)</option>
                    <option value="ERROR">🔴 ERROR (Failed / Blocked Attempts)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Daily Audit Log Display */}
            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Security Events Found for Selected Filters</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No security audit logs match the specified date range or search query. Try switching to "All Days" or clearing your search filters.
                </p>
                <button
                  onClick={() => { setLogDateFilter('all'); setCustomLogDate(''); setLogLevelFilter('all'); setLogSearchTerm(''); }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : logViewMode === 'grouped' ? (
              /* Grouped by Day View */
              <div className="space-y-6">
                {sortedDateKeys.map(dateKey => {
                  const dayLogs = groupedLogs[dateKey];
                  const formattedDay = getLogDateFormatted(dateKey);
                  const isToday = dateKey === todayKey;

                  return (
                    <div key={dateKey} className="space-y-3">
                      {/* Day Group Header Banner */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isToday ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          <h3 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                            <span>📅 {formattedDay}</span>
                          </h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {dayLogs.length} Event{dayLogs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Day Log Cards Stream */}
                      <div className="space-y-2">
                        {dayLogs.map((log, idx) => {
                          const timeStr = getLogTimeFormatted(log.timestamp);
                          const relativeTime = timeAgo(log.timestamp);
                          const colors = getLogColor(log.level, log.event_type);
                          const d = parseServerDate(log.timestamp);
                          const dateBadge = d ? d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

                          return (
                            <div
                              key={log._id || idx}
                              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-start gap-3">
                                {/* Severity Dot & Icon */}
                                <div className="pt-0.5 shrink-0">
                                  <span className={`w-3 h-3 rounded-full inline-block ${colors.dot} ring-4 ring-slate-100 dark:ring-slate-800`} />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${colors.badge}`}>
                                      {log.level || 'INFO'}
                                    </span>

                                    <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 font-mono">
                                      {log.event_type}
                                    </span>

                                    {log.client_ip && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                                        <Globe className="w-3 h-3 text-slate-400" />
                                        <span>{log.client_ip}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Parsed Log Details */}
                                  {log.details && (
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 pt-0.5">
                                      {Object.entries(log.details).map(([k, v]) => (
                                        <span key={k} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[10px]">
                                          <strong className="text-slate-500 mr-1">{k}:</strong>
                                          <span className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Exact Full Date & Time Badges */}
                              <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                  <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>{timeStr}</span>
                                </div>

                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                                  <span>📅 {dateBadge}</span>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{relativeTime}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Tabular Stream View */
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                        <th className="py-3.5 px-4">Full Date (IST)</th>
                        <th className="py-3.5 px-4">Time (IST)</th>
                        <th className="py-3.5 px-4">Severity</th>
                        <th className="py-3.5 px-4">Event Action</th>
                        <th className="py-3.5 px-4">Client IP</th>
                        <th className="py-3.5 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredAuditLogs.map((log, idx) => {
                        const colors = getLogColor(log.level, log.event_type);
                        const d = parseServerDate(log.timestamp);
                        const dateBadge = d ? d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                        const timeStr = getLogTimeFormatted(log.timestamp);
                        const relativeTime = timeAgo(log.timestamp);

                        return (
                          <tr key={log._id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                              📅 {dateBadge}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                              <div>{timeStr}</div>
                              <div className="text-[10px] text-slate-400">{relativeTime}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${colors.badge}`}>
                                {log.level || 'INFO'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                              {log.event_type}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {log.client_ip || '127.0.0.1'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                              {log.details ? Object.entries(log.details).map(([k,v]) => `${k}=${v}`).join(', ') : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* TAB 7: SYSTEM HEALTH & SPECS                             */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Platform Service Health</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Backend API', status: 'Healthy (FastAPI)', color: 'emerald' },
                { label: 'MongoDB Atlas', status: 'Connected (Atlas Cluster)', color: 'emerald' },
                { label: 'AI Engine', status: 'Ready (PyTorch Neural)', color: 'emerald' },
                { label: 'ESP32 Nodes', status: onlineIotCount > 0 ? `${onlineIotCount} Online` : 'Standby / Offline', color: onlineIotCount > 0 ? 'emerald' : 'slate' },
              ].map((s, i) => (
                <div key={i} className={`p-4 rounded-2xl border text-center ${s.color === 'emerald' ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'}`}>
                  <span className={`w-2 h-2 rounded-full inline-block mb-1.5 ${s.color === 'emerald' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</p>
                  <p className={`text-xs font-extrabold ${s.color === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>{s.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-500" />
              <span>Platform Runtime Configuration</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                { label: 'Environment Mode', value: 'Local Production Ready', icon: Server, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' },
                { label: 'Backend Framework', value: 'FastAPI (Python 3.11)', icon: Zap, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' },
                { label: 'Database Cluster', value: 'MongoDB Atlas (crop_disease_db)', icon: Database, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' },
                { label: 'Max Upload Size', value: '15 MB per image', icon: FileText, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40' },
                { label: 'AI Model Engine', value: 'EfficientNetV2 (PyTorch)', icon: Activity, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40' },
                { label: 'IoT Protocol', value: 'HTTP REST / ESP32 DevKit V1', icon: Radio, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40' },
                { label: 'Auth Mechanism', value: 'JWT Access + Refresh Tokens', icon: Key, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' },
                { label: 'Frontend Build', value: 'Vite + React 18 (SWC)', icon: Zap, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' },
                { label: 'Supported Languages', value: '12 Indian Regional Languages', icon: Globe, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className={`p-2.5 rounded-xl ${item.color} shrink-0`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 8: FARMER SUPPORT & HELPDESK MANAGEMENT              */}
      {/* ======================================================== */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          {/* KPI Stat Cards (Matching Modern SaaS Mockup) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Total Inquiries */}
            <button
              onClick={() => { setSupportStatusFilter('all'); setSupportCategoryFilter('all'); }}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-4 border-t-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Inquiries
                </span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  All
                </span>
              </div>
              
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                    {supportStats.total || supportTickets.length || 0}
                  </p>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                    Farmer requests logged
                  </p>
                </div>
                {/* SVG Mini Sparkline Wave */}
                <div className="w-16 h-8 shrink-0 text-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 64 32" className="w-full h-full fill-none stroke-current stroke-2 stroke-linecap-round stroke-linejoin-round">
                    <path d="M 0,22 Q 16,8 32,20 T 64,10" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Stat 2: Open Action Items */}
            <button
              onClick={() => setSupportStatusFilter('open')}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border ${supportStatusFilter === 'open' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-800'} border-t-4 border-t-rose-500 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Open Action Items
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                    Needs Action
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-3xl sm:text-4xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                    {supportStats.open || supportTickets.filter(t => t.status === 'open').length || 0}
                  </p>
                  <p className="text-[11px] font-bold text-rose-500/80 mt-0.5">
                    Pending response
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* Stat 3: Urgent 15-Min Callbacks */}
            <button
              onClick={() => { setSupportCategoryFilter('urgent_callback'); setSupportStatusFilter('all'); }}
              className={`p-5 rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-white dark:to-slate-900 border ${supportCategoryFilter === 'urgent_callback' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-300/70 dark:border-amber-700/60'} border-t-4 border-t-amber-500 hover:shadow-xl hover:shadow-amber-500/20 transition-all duration-300 text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Urgent 15-Min Callbacks
                </span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs animate-pulse flex items-center gap-1">
                  <span>⚡ LIVE</span>
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                    {supportStats.urgent_callbacks || supportTickets.filter(t => (t.category === 'urgent_callback' || t.category === 'callback_request' || t.is_callback_request) && t.status !== 'resolved').length || 0}
                  </p>
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    Farmers on waitlist
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30 group-hover:scale-110 transition-transform">
                  <PhoneCall className="w-5 h-5 animate-bounce" />
                </div>
              </div>
            </button>

            {/* Stat 4: Resolved Cases */}
            <button
              onClick={() => setSupportStatusFilter('resolved')}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border ${supportStatusFilter === 'resolved' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800'} border-t-4 border-t-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Resolved Cases
                </span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                  Done
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                    {supportStats.resolved || supportTickets.filter(t => t.status === 'resolved').length || 0}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-600/80 mt-0.5">
                    Issues resolved
                  </p>
                </div>
                {/* SVG Mini Sparkline Uptrend */}
                <div className="w-16 h-8 shrink-0 text-emerald-500 opacity-80 group-hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 64 32" className="w-full h-full fill-none stroke-current stroke-2 stroke-linecap-round stroke-linejoin-round">
                    <path d="M 0,28 L 24,18 L 42,22 L 64,4" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          {/* Helpdesk WhatsApp & Hotline Settings Card */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Helpdesk WhatsApp & Hotline Configuration</span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Live Dynamic Config
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Set your real WhatsApp number and hotline phone. When farmers tap "Chat on WhatsApp" or "Call Helpdesk", they connect directly to your device.
                  </p>
                </div>
              </div>

              {supportConfig.whatsapp_number && (
                <a
                  href={`https://wa.me/${(supportConfig.whatsapp_number || '').replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] font-black text-xs transition-all self-start sm:self-auto cursor-pointer border border-[#25D366]/30"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Test WhatsApp Link ↗</span>
                </a>
              )}
            </div>

            <form onSubmit={handleSaveSupportConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* WhatsApp Support Number */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span>Your WhatsApp Phone Number</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#25D366] font-bold">💬</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98765 43210 or 9876543210"
                    value={supportConfig.whatsapp_number}
                    onChange={(e) => setSupportConfig({ ...supportConfig, whatsapp_number: e.target.value })}
                    className="w-full pl-10 pr-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Include country code (e.g. +91). Cleaned automatically for wa.me.</p>
              </div>

              {/* Calling Hotline */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span>Support Hotline Phone</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-emerald-600 font-bold">📞</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1800-180-1551 or mobile"
                    value={supportConfig.support_phone}
                    onChange={(e) => setSupportConfig({ ...supportConfig, support_phone: e.target.value })}
                    className="w-full pl-10 pr-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Displayed on the farmer emergency helpline banner.</p>
              </div>

              {/* Operating Hours */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Support Operating Hours
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-amber-500 font-bold">⏰</span>
                  <input
                    type="text"
                    placeholder="e.g. 24x7 Emergency Assistance"
                    value={supportConfig.support_hours}
                    onChange={(e) => setSupportConfig({ ...supportConfig, support_hours: e.target.value })}
                    className="w-full pl-10 pr-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Shown to farmers on the support overview.</p>
              </div>

              {/* Submit Button */}
              <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingSupportConfig}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className={`w-4 h-4 ${savingSupportConfig ? 'animate-spin' : ''}`} />
                  <span>{savingSupportConfig ? 'Saving Settings...' : 'Save WhatsApp & Contact Settings'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Filters and Search Bar */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by farmer name, phone, ticket subject, or IoT node ID..."
                  value={supportSearchTerm}
                  onChange={(e) => setSupportSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                {supportSearchTerm && (
                  <button
                    onClick={() => setSupportSearchTerm('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs (Refined Style) */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl shrink-0 overflow-x-auto">
                {[
                  { id: 'all', label: 'All Tickets' },
                  { id: 'open', label: 'Needs Action' },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'resolved', label: 'Resolved' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSupportStatusFilter(st.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      supportStatusFilter === st.id
                        ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSupportTickets}
                  disabled={supportLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${supportLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>
            </div>

            {/* Dropdown Filters for Category & Priority */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-slate-500">Category:</span>
                <select
                  value={supportCategoryFilter}
                  onChange={(e) => setSupportCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="urgent_callback">⚡ 15-Minute Emergency Callback</option>
                  <option value="hardware_iot">Hardware & IoT Sensor Nodes</option>
                  <option value="crop_scan">AI Crop Disease Diagnostics</option>
                  <option value="maps_gis">Farm Boundary & Satellite Maps</option>
                  <option value="account_profile">Farmer Account & Setup</option>
                  <option value="general">General Advisory & Assistance</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">Priority:</span>
                <select
                  value={supportPriorityFilter}
                  onChange={(e) => setSupportPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {(supportCategoryFilter !== 'all' || supportPriorityFilter !== 'all' || supportStatusFilter !== 'all' || supportSearchTerm) && (
                <button
                  onClick={() => {
                    setSupportCategoryFilter('all');
                    setSupportPriorityFilter('all');
                    setSupportStatusFilter('all');
                    setSupportSearchTerm('');
                  }}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer ml-auto"
                >
                  Reset all filters
                </button>
              )}
            </div>
          </div>

          {/* Tickets Queue List */}
          <div className="space-y-4">
            {supportTickets.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <Headphones className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  No Farmer Support Tickets Found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  There are currently no support requests matching your criteria. When farmers request 15-minute callbacks or submit tickets, they will appear here in real time.
                </p>
              </div>
            ) : (
              supportTickets.map((ticket) => {
                const farmerPhone = ticket.contact_phone || ticket.phone || '';
                const rawDigits = farmerPhone.replace(/[^0-9]/g, '');
                const cleanedPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
                const waMessage = encodeURIComponent(
                  `Hello ${ticket.farmer_name || 'Farmer'}, this is the AgriShield Support Team responding to your request (Ref #${ticket.id.slice(0, 8)}: "${ticket.subject}"). How can we assist you with your field or device today?`
                );
                const isCallback = ticket.category === 'urgent_callback' || ticket.category === 'callback_request' || ticket.is_callback_request;
                const currentResNote = ticketResolutionInputs[ticket.id] !== undefined
                  ? ticketResolutionInputs[ticket.id]
                  : (ticket.resolution_notes || '');

                return (
                  <div
                    key={ticket.id}
                    className={`rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-lg ${
                      isCallback
                        ? 'border-amber-400 dark:border-amber-600/70 ring-1 ring-amber-400/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Urgent 15-Minute Callback Banner (Glow Amber to Coral Gradient) */}
                    {isCallback && (
                      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-6 py-2.5 text-xs font-black flex items-center justify-between tracking-wide shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <PhoneCall className="w-4 h-4 animate-bounce" />
                          <span>⚡ URGENT 15-MINUTE CALLBACK REQUEST • CALL FARMER NOW</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </span>
                          <span className="text-[10px] bg-black/20 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider">
                            Priority Call
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Top Meta Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono font-black px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            #{ticket.id.slice(0, 8)}
                          </span>

                          {/* Category Badge */}
                          <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ticket.category === 'hardware_iot' && 'Hardware & IoT'}
                            {ticket.category === 'crop_scan' && 'Crop Disease Scan'}
                            {ticket.category === 'maps_gis' && 'Maps & Coordinates'}
                            {ticket.category === 'account_profile' && 'Account & Farm'}
                            {(ticket.category === 'urgent_callback' || ticket.category === 'callback_request') && '⚡ 15-Min Phone Callback'}
                            {ticket.category === 'general' && 'General Inquiry'}
                          </span>

                          {/* Priority Badge */}
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                              ticket.priority === 'critical' || ticket.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                                : ticket.priority === 'high'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                : ticket.priority === 'medium'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {ticket.priority} priority
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`text-[11px] font-black px-3 py-1 rounded-full border ${
                              ticket.status === 'open'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                                : ticket.status === 'in_progress'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                            }`}
                          >
                            {ticket.status === 'open' && '🔴 Open'}
                            {ticket.status === 'in_progress' && '🟡 In Progress'}
                            {ticket.status === 'resolved' && '🟢 Resolved'}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{ticket.created_at ? formatDateTime(ticket.created_at) : 'Just now'}</span>
                        </div>
                      </div>

                      {/* Subject & Description */}
                      <div className="space-y-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          {ticket.subject}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 leading-relaxed whitespace-pre-wrap">
                          {ticket.description}
                        </p>
                      </div>

                      {/* Extra Hardware/Crop Metadata Badges if present */}
                      {(ticket.device_id || ticket.crop_type) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {ticket.device_id && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <Cpu className="w-3 h-3" />
                              <span>Node: {ticket.device_id}</span>
                            </span>
                          )}
                          {ticket.crop_type && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <Sprout className="w-3 h-3" />
                              <span>Crop: {ticket.crop_type}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Farmer Contact Card & Direct Communication Buttons (Elevated Look) */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                              {ticket.farmer_name || 'Registered Farmer'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                              {farmerPhone ? (
                                <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  📞 {farmerPhone}
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️ No phone number</span>
                              )}
                              {(ticket.contact_email || ticket.farmer_email) && (
                                <span>✉️ {ticket.contact_email || ticket.farmer_email}</span>
                              )}
                              {(ticket.district || ticket.state || ticket.location) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{[ticket.district, ticket.state, ticket.location].filter(Boolean).join(', ')}</span>
                                </span>
                              )}
                              {ticket.preferred_time && (
                                <span className="font-semibold text-sky-600 dark:text-sky-400">⏰ {ticket.preferred_time}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Direct One-Click Communication Actions (Lush Glow Buttons) */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          {farmerPhone ? (
                            <>
                              <a
                                href={`tel:${farmerPhone}`}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                              >
                                <PhoneCall className="w-4 h-4 animate-pulse" />
                                <span>Call {farmerPhone}</span>
                              </a>

                              <a
                                href={`https://wa.me/${cleanedPhone}?text=${waMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs shadow-lg shadow-green-500/25 active:scale-95 transition-all cursor-pointer"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>WhatsApp Chat</span>
                              </a>
                            </>
                          ) : (ticket.contact_email || ticket.farmer_email) ? (
                            <a
                              href={`mailto:${ticket.contact_email || ticket.farmer_email}?subject=${encodeURIComponent(`AgriShield Support - Ticket #${ticket.id.slice(0, 8)}`)}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                            >
                              <span>Email Farmer</span>
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {/* Resolution Summary if already resolved */}
                      {ticket.status === 'resolved' && ticket.resolution_notes && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Resolution Notes ({ticket.resolved_at ? formatDateTime(ticket.resolved_at) : 'Saved'}):</span>
                          </div>
                          <p className="text-emerald-900 dark:text-emerald-200 pl-5 leading-relaxed">
                            {ticket.resolution_notes}
                          </p>
                        </div>
                      )}

                      {/* Admin Resolution & Status Management Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Update Status:</span>
                          <select
                            value={ticket.status}
                            disabled={updatingTicketId === ticket.id}
                            onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value, currentResNote)}
                            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="open">🔴 Open (Pending Action)</option>
                            <option value="in_progress">🟡 In Progress (Contacting Farmer)</option>
                            <option value="resolved">🟢 Resolved (Issue Closed)</option>
                          </select>
                        </div>

                        {/* Resolution Note Input & Save Button */}
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Add resolution details or advice notes..."
                            value={currentResNote}
                            onChange={(e) => setTicketResolutionInputs(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500"
                          />
                          <button
                            onClick={() => handleUpdateTicketStatus(ticket.id, ticket.status, currentResNote)}
                            disabled={updatingTicketId === ticket.id}
                            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-bold text-xs shrink-0 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                          >
                            {updatingTicketId === ticket.id ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Bottom Return Bar for dedicated module workspaces */}
      {activeTab !== 'overview' && (
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setTab('overview')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-800 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300 font-bold text-xs border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Admin Modules</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Enterprise Admin v2.0</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">PyTorch AI & IoT Connected</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS SECTION                                           */}
      {/* ======================================================== */}

      {/* MODAL 1: EDIT USER DETAILS */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-500" />
                <span>Edit User Account Details</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">User Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="farmer">Farmer</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="admin">Admin</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="tester">Tester</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="researcher">Researcher</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Language</label>
                  <select
                    value={editForm.preferred_language}
                    onChange={e => setEditForm({ ...editForm, preferred_language: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="en">English</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="te">Telugu</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="ta">Tamil</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="hi">Hindi</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="kn">Kannada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Farm Location</label>
                <input
                  type="text"
                  value={editForm.farm_location}
                  onChange={e => setEditForm({ ...editForm, farm_location: e.target.value })}
                  placeholder="e.g. Guntur, Andhra Pradesh"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                  <span>New Password</span>
                  <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editForm.password || ''}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="e.g. StrongP@ss2026!"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-amber-300/60 dark:border-amber-900/60 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Admin Password Reset</span>
              </h3>
              <button onClick={() => setResetPwdUser(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="space-y-3">
              <p className="text-xs text-slate-500">
                Set a new password for <strong className="text-slate-800 dark:text-slate-200">{resetPwdUser.email}</strong>:
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">New Password</label>
                <input
                  type="text"
                  placeholder="e.g. AgriShield#2026!"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Must be 12+ chars with uppercase, lowercase, number & special char.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newPasswordInput}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {actionLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Lock className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Permanently Delete Account?</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong className="text-rose-600 dark:text-rose-400">{deleteUserTarget.email}</strong>? This will permanently erase their account and data from <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">crop_disease_db.users</code>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteUserTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUserSubmit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: REGISTER NEW ACCOUNT */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-500" />
                <span>Register New User Account</span>
              </h3>
              <button onClick={() => setIsCreateUserOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Reddy"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@agrishield.ai"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Password</label>
                <input
                  type="text"
                  placeholder="e.g. StrongP@ss2026!"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Must be 12+ chars with uppercase, number & special char.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Account Role</label>
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="farmer">Farmer</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="admin">Admin</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="tester">Tester</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="researcher">Researcher</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Language</label>
                  <select
                    value={createForm.preferred_language}
                    onChange={e => setCreateForm({ ...createForm, preferred_language: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="en">English</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="te">Telugu</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="ta">Tamil</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="hi">Hindi</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="kn">Kannada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Farm Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntur, Andhra Pradesh"
                  value={createForm.farm_location}
                  onChange={e => setCreateForm({ ...createForm, farm_location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !createForm.email || !createForm.password}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {actionLoading ? "Registering..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ESP32 HARDWARE TELEMETRY MODAL */}
      {selectedIotNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{selectedIotNode.device_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${selectedIotNode.status === 'ONLINE' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                      {selectedIotNode.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">{selectedIotNode.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedIotNode(null)} 
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Device Hardware Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Firmware</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{selectedIotNode.firmware_version}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">IP Address</span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{selectedIotNode.ip_address}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">MAC Address</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{selectedIotNode.mac_address}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Battery</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedIotNode.battery}</span>
              </div>
            </div>

            {/* Live Telemetry Data */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center justify-between">
                <span>Latest Telemetry Ingestion</span>
                <span className={`text-[10px] font-bold ${selectedIotNode.status === 'ONLINE' ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {selectedIotNode.status === 'ONLINE' ? 'Live Streaming' : 'Last Known Telemetry'}
                </span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Soil Moisture</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedIotNode.telemetry?.soil_moisture != null ? `${selectedIotNode.telemetry.soil_moisture}%` : 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Temperature</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedIotNode.telemetry?.temperature != null ? `${selectedIotNode.telemetry.temperature}°C` : 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Humidity</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedIotNode.telemetry?.humidity != null ? `${selectedIotNode.telemetry.humidity}% RH` : 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Ambient Light</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedIotNode.telemetry?.light_lux != null ? `${selectedIotNode.telemetry.light_lux} Lux` : 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Barometer</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedIotNode.telemetry?.pressure != null ? `${selectedIotNode.telemetry.pressure} hPa` : 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Rain Status</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedIotNode.telemetry?.rain_detected ? 'Rain Detected' : 'Dry'}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedIotNode(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
