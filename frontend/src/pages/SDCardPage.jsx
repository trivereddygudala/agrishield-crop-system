import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, CheckCircle, XCircle, FileText, Download, RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, Button, Skeleton } from '../components/ui/index';
import Breadcrumbs from '../components/Breadcrumbs';
import API from '../services/api';

const SDCardPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [nodeIp, setNodeIp] = useState('');
  const [sdData, setSdData] = useState({
    mounted: false,
    usedMb: 0,
    totalMb: 0,
    freeMb: 0,
    status: 'unmounted'
  });

  const fetchSDData = async () => {
    setLoading(true);
    try {
      // Get device data from backend to determine SD card status
      const res = await API.get('/api/v1/devices/status');
      const devices = res.data;
      if (devices && devices.length > 0) {
        // Pick the most recently seen device that has an IP
        const withIp = devices.filter(d => d.ip);
        const best = withIp.sort((a, b) =>
          (a.seconds_since_seen ?? 999999) - (b.seconds_since_seen ?? 999999)
        )[0];
        
        let ip = '';
        if (best) {
          ip = best.ip;
          setNodeIp(best.ip);
        }

        const dev = best || devices[0];
        const telem = dev.latest_telemetry || dev.last_telemetry || {};
        const isOnline = dev.status === 'online';
        let mounted = Boolean(isOnline && (telem.sd_card_status === "mounted" || telem.sd_mounted === 1));
        let total = telem.sd_total_mb || (mounted ? 7680 : 0);
        let used = telem.sd_used_mb || 0;

        // Try to fetch live metrics via local device proxy if online
        if (ip && isOnline) {
          try {
            const proxyRes = await API.post('/api/v1/devices/proxy', {
              ip,
              endpoint: '/status',
              method: 'GET'
            });
            const statusData = proxyRes.data;
            if (statusData && statusData.sd) {
              mounted = statusData.sd === 'MOUNTED';
              total = statusData.sz || (mounted ? 7680 : 0);
              used = statusData.su !== undefined ? statusData.su : 0;
            }
          } catch (proxyErr) {
            console.warn("Failed to fetch live status via proxy, using telemetry cache:", proxyErr);
          }
        }
        
        setSdData({
          mounted,
          usedMb: used,
          totalMb: total,
          freeMb: Math.max(0, total - used),
          status: mounted ? 'mounted' : 'unmounted'
        });
      }
    } catch (err) {
      console.error("Failed to fetch SD card data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSDData();
    const interval = setInterval(fetchSDData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !sdData.totalMb) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="w-64 h-10 mb-4 rounded-xl" />
        <Skeleton className="w-full h-64 rounded-xl" />
      </div>
    );
  }

  const isMounted = sdData.mounted;
  const usagePercent = sdData.totalMb > 0 ? (sdData.usedMb / sdData.totalMb) * 100 : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <HardDrive className="h-8 w-8 text-amber-500" />
            MicroSD Storage Module
          </h1>
          <div className="mt-2">
            <Breadcrumbs />
          </div>
        </div>
        <Button onClick={fetchSDData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SD Card Status Card */}
        <Card className="lg:col-span-1 p-6 flex flex-col items-center justify-center border-t-4 border-t-amber-500">
          <div className={`relative w-32 h-40 rounded-t-xl rounded-br-xl rounded-bl-sm border-4 flex flex-col p-2 mb-6 shadow-xl transition-all ${isMounted ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'}`}>
            <div className="flex justify-end gap-1 mb-2">
              <div className="w-2 h-4 bg-amber-300 dark:bg-amber-600 rounded-b-sm"></div>
              <div className="w-2 h-4 bg-amber-300 dark:bg-amber-600 rounded-b-sm"></div>
              <div className="w-2 h-4 bg-amber-300 dark:bg-amber-600 rounded-b-sm"></div>
              <div className="w-2 h-4 bg-amber-300 dark:bg-amber-600 rounded-b-sm"></div>
            </div>
            <div className="mt-auto text-center font-black text-xl tracking-wider text-slate-700 dark:text-slate-300">
              {isMounted ? `${Math.round(sdData.totalMb / 1024)}GB` : 'N/A'}
            </div>
            <div className="text-center text-[10px] font-bold text-slate-500">MicroSDHC</div>
          </div>
          
          <h2 className="text-xl font-bold mb-2">Storage Status</h2>
          {isMounted ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-full">
              <CheckCircle className="h-5 w-5" />
              MOUNTED & ACTIVE
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/30 px-4 py-2 rounded-full">
              <XCircle className="h-5 w-5" />
              CARD NOT DETECTED
            </div>
          )}
          
          {!isMounted && (
            <div className="mt-4 text-sm text-slate-500 text-center flex flex-col items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Please check SPI Connections: CS:15, SCK:14, MISO:12, MOSI:13.
            </div>
          )}
        </Card>

        {/* Capacity Details */}
        <Card className="lg:col-span-2 p-6 flex flex-col justify-center">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-4">
            <Activity className="h-5 w-5 text-indigo-500" /> Storage Capacity
          </h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm font-bold mb-2">
                <span className="text-slate-600 dark:text-slate-300">Used Space</span>
                <span className="text-slate-800 dark:text-slate-100">{sdData.usedMb.toFixed(1)} MB</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-200 dark:border-slate-700">
                <div 
                  className={`h-4 rounded-full transition-all duration-1000 ${usagePercent > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.max(usagePercent, isMounted ? 2 : 0)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <p className="text-sm font-medium text-slate-500">Free Space</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {sdData.freeMb.toFixed(1)} <span className="text-sm font-bold">MB</span>
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <p className="text-sm font-medium text-slate-500">Total Capacity</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {sdData.totalMb.toFixed(1)} <span className="text-sm font-bold">MB</span>
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* File System Logs (Mocked for Visual UI) */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-500" /> File System Logs
          </h2>
          <Button variant="danger" size="sm" disabled={!isMounted} leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}>
            Format SD Card
          </Button>
        </div>
        
        {isMounted ? (
          <div className="border rounded-2xl overflow-hidden border-slate-200/90 dark:border-slate-800 shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3 hidden md:table-cell">Last Modified</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-500" /> telemetry_log.txt
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{(sdData.usedMb * 1024).toFixed(0)} KB</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">Just now</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => {
                        if (nodeIp) {
                          window.open(`http://${nodeIp}/download-logs`, '_blank');
                        } else {
                          alert("ESP32 IP address not discovered yet. Please ensure the device is online on the local network.");
                        }
                      }}
                      className={`font-bold text-xs inline-flex items-center justify-end gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                        nodeIp 
                          ? 'bg-sky-500/10 hover:bg-sky-600 hover:text-white text-sky-600 dark:text-sky-400 border-sky-500/30 shadow-xs' 
                          : 'text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" /> Download Log
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-500" /> archive_log.txt
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{(sdData.usedMb * 1024 > 0 ? (sdData.usedMb * 1024) + 142 : 142).toFixed(0)} KB</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">10 mins ago</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => {
                        if (nodeIp) {
                          window.open(`http://${nodeIp}/download-archive`, '_blank');
                        } else {
                          alert("ESP32 IP address not discovered yet. Please ensure the device is online on the local network.");
                        }
                      }}
                      className={`font-bold text-xs inline-flex items-center justify-end gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                        nodeIp 
                          ? 'bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-xs' 
                          : 'text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" /> Download Archive
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed dark:border-slate-800">
            <HardDrive className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">No SD Card Mounted</p>
            <p className="text-xs mt-1">Insert an SD card to view logs.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

// Simple Activity component since it wasn't imported above
const Activity = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;

export default SDCardPage;
