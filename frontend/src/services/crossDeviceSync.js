/**
 * AgriShield Universal Cross-Device Synchronization & Tombstone Engine
 * 
 * Solves the multi-mobile synchronization problem:
 * When an item (equipment, booking, notification, diagnosis scan) is deleted
 * on Mobile 1, Mobile 2 instantly receives the deletion tombstone, purges its
 * local state & localStorage, and revalidates fresh server data upon unlock,
 * window focus, tab visibility change, or background sync.
 */

import API, { PRIMARY_RENDER_BACKEND, SECONDARY_RENDER_BACKEND } from './api';
import axios from 'axios';

let _syncIntervalId = null;
let _isSyncing = false;
let _listeners = new Set();

/**
 * LocalStorage keys that store entity lists and blacklists
 */
const STORAGE_KEYS = {
  DELETED_BOOKINGS: 'agrishield_deleted_booking_ids',
  DELETED_EQUIPMENT: 'agrishield_deleted_equipment_ids',
  DELETED_NOTIFICATIONS: 'agrishield_deleted_notification_ids',
  DELETED_PREDICTIONS: 'agrishield_deleted_prediction_ids',
  BOOKINGS_CACHE: 'agrishield_equipment_bookings',
  FLEET_CACHE: 'agrishield_provider_fleet_inventory',
  CUSTOM_FLEET_CACHE: 'agrishield_custom_equipment_listings',
  NOTIFICATIONS_CACHE: 'agrishield_user_notifications',
};

/**
 * Normalizes an entity ID for consistent string matching
 */
export const normalizeId = (id) => {
  if (id === null || id === undefined) return '';
  return String(id).trim();
};

/**
 * Reads a Set of deleted IDs from localStorage for a given entity type
 */
export const getLocalDeletedSet = (entityType) => {
  try {
    let key = STORAGE_KEYS.DELETED_BOOKINGS;
    if (entityType === 'equipment') key = STORAGE_KEYS.DELETED_EQUIPMENT;
    else if (entityType === 'notification') key = STORAGE_KEYS.DELETED_NOTIFICATIONS;
    else if (entityType === 'prediction') key = STORAGE_KEYS.DELETED_PREDICTIONS;

    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
};

/**
 * Purges deleted items from all local caches on this device
 */
export const purgeDeletedItemsFromLocalStorage = () => {
  try {
    const deletedBookings = getLocalDeletedSet('booking');
    const deletedEquipment = getLocalDeletedSet('equipment');
    const deletedNotifs = getLocalDeletedSet('notification');

    // 1. Purge Bookings Cache
    const rawBookings = localStorage.getItem(STORAGE_KEYS.BOOKINGS_CACHE);
    if (rawBookings) {
      try {
        const list = JSON.parse(rawBookings);
        if (Array.isArray(list)) {
          const clean = list.filter(b => {
            if (!b) return false;
            const bId = normalizeId(b.id || b.bookingId);
            const num = bId.replace(/^BK-/, '');
            return !deletedBookings.has(bId) && !deletedBookings.has(num);
          });
          if (clean.length !== list.length) {
            localStorage.setItem(STORAGE_KEYS.BOOKINGS_CACHE, JSON.stringify(clean));
          }
        }
      } catch (_) {}
    }

    // 2. Purge Fleet & Custom Equipment Caches
    const purgeFleet = (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const clean = list.filter(item => {
            if (!item) return false;
            const id = normalizeId(item.id);
            const num = id.replace(/^[A-Za-z]+-/, '');
            return !deletedEquipment.has(id) && !deletedEquipment.has(num);
          });
          if (clean.length !== list.length) {
            localStorage.setItem(key, JSON.stringify(clean));
          }
        }
      } catch (_) {}
    };

    purgeFleet(STORAGE_KEYS.FLEET_CACHE);
    purgeFleet(STORAGE_KEYS.CUSTOM_FLEET_CACHE);

    // 3. Purge Notifications Cache
    const rawNotifs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_CACHE);
    if (rawNotifs) {
      try {
        const list = JSON.parse(rawNotifs);
        if (Array.isArray(list)) {
          const clean = list.filter(n => {
            if (!n) return false;
            const nId = normalizeId(n.id || n.notification_id || n.booking_id);
            return !deletedNotifs.has(nId);
          });
          if (clean.length !== list.length) {
            localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_CACHE, JSON.stringify(clean));
          }
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn('⚠️ [CrossDeviceSync] Error purging local storage:', e);
  }
};

/**
 * Fetches deletion tombstones from the server and updates this device's blacklists
 */
export const syncDeletedIdsFromServer = async () => {
  if (_isSyncing) return;
  _isSyncing = true;

  try {
    let res = null;
    const endpoint = '/api/v1/sync/tombstones';

    try {
      res = await API.get(endpoint, { timeout: 8000 });
    } catch (_) {}

    if (!res?.data?.deleted_ids_by_type) {
      try {
        res = await API.get('/api/sync/tombstones', { timeout: 8000 });
      } catch (_) {}
    }

    if (!res?.data?.deleted_ids_by_type) {
      try {
        res = await axios.get(`${PRIMARY_RENDER_BACKEND}${endpoint}`, { timeout: 8000 });
      } catch (_) {}
    }

    if (!res?.data?.deleted_ids_by_type) {
      try {
        res = await axios.get(`${SECONDARY_RENDER_BACKEND}${endpoint}`, { timeout: 8000 });
      } catch (_) {}
    }

    if (res?.data?.deleted_ids_by_type) {
      const byType = res.data.deleted_ids_by_type;
      let hasNewDeletions = false;

      // Update Local Blacklists
      const updateBlacklist = (storageKey, remoteIds) => {
        if (!Array.isArray(remoteIds) || remoteIds.length === 0) return;
        try {
          const raw = localStorage.getItem(storageKey);
          const currentList = raw ? JSON.parse(raw) : [];
          const currentSet = new Set(currentList);
          let added = false;

          remoteIds.forEach(id => {
            const clean = normalizeId(id);
            if (clean && !currentSet.has(clean)) {
              currentList.push(clean);
              currentSet.add(clean);
              added = true;
              // Also add numeric variants
              if (clean.startsWith('BK-')) {
                const num = clean.replace('BK-', '');
                if (!currentSet.has(num)) {
                  currentList.push(num);
                  currentSet.add(num);
                }
              } else if (clean.startsWith('EQ-') || clean.startsWith('FL-')) {
                const num = clean.replace(/^[A-Za-z]+-/, '');
                if (!currentSet.has(num)) {
                  currentList.push(num);
                  currentSet.add(num);
                }
              }
            }
          });

          if (added) {
            localStorage.setItem(storageKey, JSON.stringify(currentList));
            hasNewDeletions = true;
          }
        } catch (_) {}
      };

      updateBlacklist(STORAGE_KEYS.DELETED_BOOKINGS, byType.booking || []);
      updateBlacklist(STORAGE_KEYS.DELETED_EQUIPMENT, byType.equipment || []);
      updateBlacklist(STORAGE_KEYS.DELETED_NOTIFICATIONS, byType.notification || []);
      updateBlacklist(STORAGE_KEYS.DELETED_PREDICTIONS, byType.prediction || []);

      // If new deletions were detected from another device, clean local caches & dispatch events
      if (hasNewDeletions) {
        purgeDeletedItemsFromLocalStorage();
        window.dispatchEvent(new CustomEvent('agrishield_bookings_updated', { detail: { source: 'cross_device_sync' } }));
        window.dispatchEvent(new CustomEvent('agrishield_equipment_updated', { detail: { source: 'cross_device_sync' } }));
        window.dispatchEvent(new CustomEvent('agrishield_notifications_updated', { detail: { source: 'cross_device_sync' } }));
        window.dispatchEvent(new CustomEvent('agrishield_cross_device_synced', { detail: { byType } }));
        
        // Notify any active callback listeners
        _listeners.forEach(fn => {
          try { fn({ hasNewDeletions: true, byType }); } catch (_) {}
        });
      }
    }
  } catch (err) {
    console.debug('⚠️ [CrossDeviceSync] Sync tick skipped:', err?.message || err);
  } finally {
    _isSyncing = false;
  }
};

/**
 * Records a deletion locally AND remotely across all workers so other devices see it
 * @param {string} entityType - 'equipment' | 'booking' | 'notification' | 'prediction'
 * @param {string} entityId - ID of the deleted item
 * @param {string} reason - Optional reason
 */
export const recordCrossDeviceDeletion = async (entityType, entityId, reason = 'User Action') => {
  if (!entityType || !entityId) return;
  const cleanId = normalizeId(entityId);

  // 1. Immediately store in local blacklist
  let key = STORAGE_KEYS.DELETED_BOOKINGS;
  if (entityType === 'equipment') key = STORAGE_KEYS.DELETED_EQUIPMENT;
  else if (entityType === 'notification') key = STORAGE_KEYS.DELETED_NOTIFICATIONS;
  else if (entityType === 'prediction') key = STORAGE_KEYS.DELETED_PREDICTIONS;

  try {
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(cleanId)) {
      list.push(cleanId);
    }
    if (cleanId.startsWith('BK-')) {
      const num = cleanId.replace('BK-', '');
      if (!list.includes(num)) list.push(num);
    } else if (cleanId.startsWith('EQ-') || cleanId.startsWith('FL-')) {
      const num = cleanId.replace(/^[A-Za-z]+-/, '');
      if (!list.includes(num)) list.push(num);
    }
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) {}

  // 2. Purge from local storage caches immediately
  purgeDeletedItemsFromLocalStorage();

  // 3. Post to backend tombstone sync endpoint (with failover)
  const payload = {
    entity_type: entityType,
    entity_id: cleanId,
    reason: reason,
    deleted_at: new Date().toISOString()
  };

  try {
    let saved = false;
    try {
      await API.post('/api/v1/sync/tombstones', payload);
      saved = true;
    } catch (_) {}

    if (!saved) {
      try {
        await API.post('/api/sync/tombstones', payload);
        saved = true;
      } catch (_) {}
    }

    if (!saved) {
      try {
        await axios.post(`${PRIMARY_RENDER_BACKEND}/api/v1/sync/tombstones`, payload, { timeout: 8000 });
        saved = true;
      } catch (_) {}
    }

    if (!saved) {
      try {
        await axios.post(`${SECONDARY_RENDER_BACKEND}/api/v1/sync/tombstones`, payload, { timeout: 8000 });
      } catch (_) {}
    }
  } catch (err) {
    console.warn('⚠️ [CrossDeviceSync] Remote tombstone sync warning:', err);
  }
};

/**
 * Initializes automatic cross-device synchronization:
 * - Runs sync on app startup
 * - Runs sync when the user switches to this tab / unlocks mobile screen (visibilitychange)
 * - Runs sync when the window receives focus
 * - Runs background polling heartbeat every 20 seconds
 */
export const initCrossDeviceAutoSync = (onSyncCallback) => {
  if (typeof window === 'undefined') return () => {};

  if (typeof onSyncCallback === 'function') {
    _listeners.add(onSyncCallback);
  }

  // 1. Initial immediate sync on mount
  syncDeletedIdsFromServer();

  // 2. Visibility change listener (Crucial for mobile phones!)
  // When user unlocks Mobile 2 or switches from another app after 2-3 minutes,
  // document.visibilityState transitions to 'visible'.
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      syncDeletedIdsFromServer();
    }
  };

  const handleFocus = () => {
    syncDeletedIdsFromServer();
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleFocus);

  // 3. Heartbeat timer (every 25 seconds)
  if (!_syncIntervalId) {
    _syncIntervalId = setInterval(() => {
      syncDeletedIdsFromServer();
    }, 25000);
  }

  // Cleanup function
  return () => {
    if (typeof onSyncCallback === 'function') {
      _listeners.delete(onSyncCallback);
    }
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleFocus);
  };
};

export default {
  syncDeletedIdsFromServer,
  recordCrossDeviceDeletion,
  initCrossDeviceAutoSync,
  purgeDeletedItemsFromLocalStorage,
  getLocalDeletedSet,
  normalizeId
};
