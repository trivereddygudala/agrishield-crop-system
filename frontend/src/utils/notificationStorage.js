/**
 * notificationStorage.js - B9.5B Centralized User-Namespaced Notification Storage
 * Provides stable user-specific localStorage keys and accessors to guarantee strict
 * tenant isolation, cross-tab synchronization, and zero cross-user cache contamination.
 */

export const normalizeUserId = (userOrId) => {
  if (!userOrId) {
    try {
      const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        return String(parsed.id || parsed._id || parsed.user_id || '').trim() || null;
      }
    } catch (_) {}
    return null;
  }
  if (typeof userOrId === 'string') return userOrId.trim();
  return String(userOrId.id || userOrId._id || userOrId.user_id || '').trim() || null;
};

export const getNotificationStorageKeys = (userOrId = null) => {
  const uid = normalizeUserId(userOrId);
  return {
    cacheKey: uid ? `agrishield_user_notifications_${uid}` : null,
    readIdsKey: uid ? `agrishield_read_notification_ids_${uid}` : null,
    deletedIdsKey: uid ? `agrishield_deleted_notification_ids_${uid}` : null,
    legacyCacheKey: 'agrishield_user_notifications',
    legacyReadIdsKey: 'agrishield_read_notification_ids',
    legacyDeletedIdsKey: 'agrishield_deleted_notification_ids'
  };
};

export const getUserNotificationCache = (userOrId = null) => {
  try {
    const { cacheKey } = getNotificationStorageKeys(userOrId);
    if (!cacheKey) return [];
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

export const setUserNotificationCache = (userOrId, notifications) => {
  try {
    const { cacheKey } = getNotificationStorageKeys(userOrId);
    if (!cacheKey) return;
    const safeList = Array.isArray(notifications) ? notifications : [];
    localStorage.setItem(cacheKey, JSON.stringify(safeList));
  } catch (_) {}
};

export const getUserReadNotificationIds = (userOrId = null) => {
  try {
    const { readIdsKey } = getNotificationStorageKeys(userOrId);
    if (!readIdsKey) return new Set();
    const raw = localStorage.getItem(readIdsKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return new Set();
  }
};

export const setUserReadNotificationIds = (userOrId, idsSetOrArray) => {
  try {
    const { readIdsKey } = getNotificationStorageKeys(userOrId);
    if (!readIdsKey) return;
    const arr = Array.from(idsSetOrArray || []);
    localStorage.setItem(readIdsKey, JSON.stringify(arr));
  } catch (_) {}
};

export const getUserDeletedNotificationIds = (userOrId = null) => {
  try {
    const { deletedIdsKey } = getNotificationStorageKeys(userOrId);
    if (!deletedIdsKey) return new Set();
    const raw = localStorage.getItem(deletedIdsKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return new Set();
  }
};

export const saveUserDeletedNotificationId = (userOrId, notificationId) => {
  try {
    const { deletedIdsKey } = getNotificationStorageKeys(userOrId);
    if (!deletedIdsKey || !notificationId) return;
    const raw = localStorage.getItem(deletedIdsKey);
    const list = raw ? JSON.parse(raw) : [];
    const notifStr = String(notificationId).trim();
    if (notifStr && !list.includes(notifStr)) {
      list.push(notifStr);
    }
    const cleanId = notifStr.replace(/^notif-/, '').replace(/^farmer-notif-/, '').replace(/-[a-z]+$/, '');
    if (cleanId && cleanId !== notifStr) {
      if (!list.includes(`notif-${cleanId}`)) list.push(`notif-${cleanId}`);
      if (!list.includes(`farmer-notif-${cleanId}-confirmed`)) list.push(`farmer-notif-${cleanId}-confirmed`);
      if (!list.includes(`farmer-notif-${cleanId}-rejected`)) list.push(`farmer-notif-${cleanId}-rejected`);
      if (!list.includes(`farmer-notif-${cleanId}-declined`)) list.push(`farmer-notif-${cleanId}-declined`);
      if (!list.includes(`farmer-notif-${cleanId}-cancelled`)) list.push(`farmer-notif-${cleanId}-cancelled`);
    }
    localStorage.setItem(deletedIdsKey, JSON.stringify(list));
  } catch (_) {}
};

export const clearUserNotificationsStorage = (userOrId = null) => {
  try {
    const { cacheKey, readIdsKey, deletedIdsKey, legacyCacheKey, legacyReadIdsKey, legacyDeletedIdsKey } = getNotificationStorageKeys(userOrId);
    if (cacheKey) localStorage.removeItem(cacheKey);
    if (readIdsKey) localStorage.removeItem(readIdsKey);
    if (deletedIdsKey) localStorage.removeItem(deletedIdsKey);
    // Security/Privacy: Always remove legacy un-namespaced keys on logout
    localStorage.removeItem(legacyCacheKey);
    localStorage.removeItem(legacyReadIdsKey);
    localStorage.removeItem(legacyDeletedIdsKey);
  } catch (_) {}
};
