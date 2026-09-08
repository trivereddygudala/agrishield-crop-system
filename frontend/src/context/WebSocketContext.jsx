import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('offline'); // 'connected' | 'reconnecting' | 'offline' | 'error'
  const [lastMessageTime, setLastMessageTime] = useState(null);
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const [deviceStatusMap, setDeviceStatusMap] = useState({});
  const [unreadCount, setUnreadCount] = useState(null);
  const [latestAlert, setLatestAlert] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const subscribersRef = useRef({});

  // Event subscription system for child components (e.g., DevicesPage, NotificationsPage)
  const subscribe = useCallback((eventType, callback) => {
    if (!subscribersRef.current[eventType]) {
      subscribersRef.current[eventType] = new Set();
    }
    subscribersRef.current[eventType].add(callback);
    return () => {
      if (subscribersRef.current[eventType]) {
        subscribersRef.current[eventType].delete(callback);
      }
    };
  }, []);

  const notifySubscribers = useCallback((eventType, payload) => {
    if (subscribersRef.current[eventType]) {
      subscribersRef.current[eventType].forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in WebSocket subscriber callback for ${eventType}:`, err);
        }
      });
    }
    // Also trigger generic wildcard listeners
    if (subscribersRef.current['*']) {
      subscribersRef.current['*'].forEach((cb) => {
        try {
          cb({ type: eventType, payload });
        } catch (err) {
          console.error('Error in wildcard WebSocket subscriber:', err);
        }
      });
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Client clean disconnect');
      }
    }
    setConnectionStatus('offline');
  }, [clearTimers]);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (!user) {
      disconnect();
      return;
    }

    const userId = user.id || user._id;
    if (!userId) return;

    // Avoid duplicate sockets if already open or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    clearTimers();

    if (reconnectAttemptRef.current > 0) {
      setConnectionStatus('reconnecting');
    } else {
      setConnectionStatus('connecting');
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Default to Local backend if VITE_API_URL is missing
    let host = '127.0.0.1:8000';
    
    if (import.meta.env.VITE_API_URL) {
      try {
        const urlObj = new URL(import.meta.env.VITE_API_URL);
        host = urlObj.host;
      } catch (e) {
        console.warn('Could not parse VITE_API_URL host, using default Local host');
      }
    } else if (typeof window !== 'undefined') {
      // Local development fallback (routes through Vite proxy or LocalTunnel)
      host = window.location.host;
    }

    const authToken = token || localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const wsUrl = `${protocol}//${host}/api/v1/notifications/ws/${userId}?token=${encodeURIComponent(authToken)}&client=react_spa`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isUnmountedRef.current || wsRef.current !== socket) return;
        setConnectionStatus('connected');
        reconnectAttemptRef.current = 0;
        setLastMessageTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));

        // Setup ping/heartbeat interval every 30 seconds
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              if (pongTimeoutRef.current) {
                clearTimeout(pongTimeoutRef.current);
                pongTimeoutRef.current = null;
              }
              socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              // Timeout detection: if no pong received within 35 seconds, terminate connection
              pongTimeoutRef.current = setTimeout(() => {
                console.warn('WebSocket heartbeat timeout detected. Closing dead connection.');
                socket.close(4000, 'Heartbeat timeout');
              }, 35000);
            } catch (err) {
              console.error('Failed to send heartbeat ping:', err);
            }
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        if (isUnmountedRef.current || wsRef.current !== socket) return;

        // Clear pong timeout on any incoming data from server
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }

        const nowStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        setLastMessageTime(nowStr);

        try {
          const data = JSON.parse(event.data);

          // Handle pong / ack from server
          if (data.status === 'ping_ack' || data.type === 'pong') {
            return;
          }

          // Handle Notification Alerts (from NotificationService)
          if (data.type === 'new_notification' || data.type === 'notification') {
            const notif = data.notification || data;
            setLatestAlert(notif);
            if (data.unread_count !== undefined) {
              setUnreadCount(data.unread_count);
            } else {
              setUnreadCount((prev) => (prev !== null ? prev + 1 : 1));
            }
            notifySubscribers('notification', notif);
          }

          // Handle Unread Count Updates (read, acknowledged, deleted)
          else if (data.type === 'unread_count_update' || data.type === 'unread_count') {
            const count = data.unread_count !== undefined ? data.unread_count : data.count;
            if (count !== undefined) {
              setUnreadCount(count);
              notifySubscribers('unread_count_update', count);
            }
          }

          // Handle Live Telemetry Updates (from ESP32 sensor ingestion)
          else if (data.type === 'telemetry_update') {
            setLastTelemetry(data);
            if (data.device_id) {
              setDeviceStatusMap((prev) => ({
                ...prev,
                [data.device_id]: {
                  ...prev[data.device_id],
                  status: data.status || 'online',
                  last_seen: data.timestamp || new Date().toISOString(),
                  latest_telemetry: data.telemetry || data
                }
              }));
            }
            notifySubscribers('telemetry', data);
            notifySubscribers('telemetry_update', data);
          }

          // Handle Batch Offline Telemetry Sync (when ESP32 flushes SD queue to backend)
          else if (data.type === 'telemetry_batch_synced') {
            if (data.latest_telemetry) {
              setLastTelemetry({
                type: 'telemetry_update',
                device_id: data.device_id,
                telemetry: data.latest_telemetry,
                data: data.latest_telemetry,
                timestamp: data.timestamp
              });
              if (data.device_id) {
                setDeviceStatusMap((prev) => ({
                  ...prev,
                  [data.device_id]: {
                    ...prev[data.device_id],
                    status: 'online',
                    last_seen: data.timestamp || new Date().toISOString(),
                    latest_telemetry: data.latest_telemetry
                  }
                }));
              }
            }
            notifySubscribers('telemetry_batch_synced', data);
            notifySubscribers('telemetry_update', data);
            notifySubscribers('telemetry', data);
          }

          // Handle Live Device Status / Heartbeats
          else if (data.type === 'device_status_update') {
            if (data.device_id) {
              setDeviceStatusMap((prev) => ({
                ...prev,
                [data.device_id]: {
                  ...prev[data.device_id],
                  status: data.status || 'online',
                  last_seen: data.timestamp || new Date().toISOString(),
                  uptime_ms: data.uptime_ms !== undefined ? data.uptime_ms : prev[data.device_id]?.uptime_ms,
                  battery: data.battery !== undefined ? data.battery : prev[data.device_id]?.battery
                }
              }));
            }
            notifySubscribers('device_status', data);
          }

          // Generic custom event dispatch
          else if (data.type) {
            notifySubscribers(data.type, data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket incoming JSON payload:', err, event.data);
        }
      };

      socket.onerror = (err) => {
        if (isUnmountedRef.current || wsRef.current !== socket) return;
        setConnectionStatus('error');
      };

      socket.onclose = (event) => {
        if (isUnmountedRef.current || wsRef.current !== socket) return;
        clearTimers();
        wsRef.current = null;

        // Do not reconnect on clean client logout / termination
        if (event.code === 1000) {
          setConnectionStatus('offline');
          return;
        }

        setConnectionStatus('reconnecting');
        const attempt = reconnectAttemptRef.current++;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
        const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current && user) {
            connect();
          }
        }, delay);
      };
    } catch (err) {
      setConnectionStatus('error');
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current && user) {
          connect();
        }
      }, delay);
    }
  }, [user, token, clearTimers, disconnect, notifySubscribers]);

  useEffect(() => {
    isUnmountedRef.current = false;
    if (user) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [user, connect, disconnect]);

  const value = {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    lastMessageTime,
    lastTelemetry,
    deviceStatusMap,
    unreadCount,
    latestAlert,
    subscribe,
    reconnect: connect,
    disconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
export default WebSocketContext;
