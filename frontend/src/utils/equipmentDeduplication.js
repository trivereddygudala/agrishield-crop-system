/**
 * AgriShield Equipment & Bookings Master Deduplication Utility
 * Ensures 100% zero-duplicate integrity between Farmer Portal and Equipment Provider Portal.
 * Handles unified canonical fleet assets, multi-device synchronization, and semantic double-booking elimination.
 */

import { CURATED_FARM_PHOTOS } from '../services/photoService';
import { getNotificationStorageKeys } from './notificationStorage';

export const getEquipmentFallbackImage = (category, title = '') => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  if (c === 'drone' || t.includes('drone') || t.includes('agras') || t.includes('spray')) {
    return CURATED_FARM_PHOTOS.drone || 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'irrigation' || c === 'pump' || t.includes('pump') || t.includes('solar') || t.includes('water')) {
    return CURATED_FARM_PHOTOS.solarPump || 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'harvester' || t.includes('harvester') || t.includes('cutter')) {
    return CURATED_FARM_PHOTOS.harvester || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'implement' || t.includes('rotavator') || t.includes('plough') || t.includes('tiller')) {
    return CURATED_FARM_PHOTOS.rotavator || 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('john deere')) {
    return CURATED_FARM_PHOTOS.tractor || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80';
  }
  return CURATED_FARM_PHOTOS.tractorJohnDeere || CURATED_FARM_PHOTOS.tractorField || 'https://images.unsplash.com/photo-1594771804886-a933bb2d609b?auto=format&fit=crop&w=800&q=80';
};

// 100% Real User Equipment Fleet (Zero Hardcoded Demo Machinery)
export const CANONICAL_STARTER_FLEET = [];

export const LEGACY_MOCK_EQUIPMENT_IDS = new Set([
  'FL-001', 'FL-002', 'FL-003', 'FL-004', 'FL-005',
  'FL-8357', 'FL-2795', 'FL-2912',
  'EQ-LIVE-24021', 'EQ-V314-76559', 'EQ-TEST-1790444356', 'EQ-49891'
]);

export const LEGACY_MOCK_TITLES = new Set([
  'johndeere5050dtractor',
  'johndeere5050d4wdtractor',
  'djiagrast40agriculturedrone',
  'djiagrast40agriculturesprayingdrone',
  'kirloskar5hpsolarwaterpump',
  'mahindra575di45hptractor',
  'preet987combinedharvester',
  'hiitractor',
  'sampletractor',
  'livetesttractor20260926224409edited',
  'kubotamu55024wdtractor24021',
  'vstshakti932ditractor148',
  'kubotaharvesterpro774',
  'mahindrs575di'
]);

export const normalizeEquipmentTitle = (title) => {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Helper to fetch persistent set of user-deleted equipment IDs & titles
 */
export const getDeletedEquipmentIds = () => {
  try {
    const raw = localStorage.getItem('agrishield_deleted_equipment_ids');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
};

/**
 * Save deleted equipment ID & normalized title so it NEVER resurrects from remote catalogs
 */
export const saveDeletedEquipmentId = (equipmentId, title = '') => {
  try {
    const raw = localStorage.getItem('agrishield_deleted_equipment_ids');
    const list = raw ? JSON.parse(raw) : [];
    const idStr = String(equipmentId || '').trim();
    if (idStr && !list.includes(idStr)) {
      list.push(idStr);
    }
    const cleanNum = idStr.replace(/^[A-Za-z]+-/, '').trim();
    if (cleanNum && !list.includes(cleanNum)) {
      list.push(cleanNum);
    }
    if (title) {
      const normTitle = normalizeEquipmentTitle(title);
      if (normTitle && !list.includes(`title_${normTitle}`)) {
        list.push(`title_${normTitle}`);
      }
    }
    localStorage.setItem('agrishield_deleted_equipment_ids', JSON.stringify(list));
  } catch (e) {}
};

/**
 * Helper to fetch persistent set of user-deleted notification IDs
 */
export const getDeletedNotificationIds = (userOrId = null) => {
  try {
    const { deletedIdsKey, legacyDeletedIdsKey } = getNotificationStorageKeys(userOrId);
    const key = deletedIdsKey || legacyDeletedIdsKey;
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
};

/**
 * Save deleted notification ID so it never resurrects from booking synthesizers or server polling
 */
export const saveDeletedNotificationId = (notificationId, userOrId = null) => {
  try {
    const { deletedIdsKey, legacyDeletedIdsKey } = getNotificationStorageKeys(userOrId);
    const key = deletedIdsKey || legacyDeletedIdsKey;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const notifStr = String(notificationId || '').trim();
    if (notifStr && !list.includes(notifStr)) {
      list.push(notifStr);
    }
    // Also save variants if it has booking key
    const cleanId = notifStr.replace(/^notif-/, '').replace(/^farmer-notif-/, '').replace(/-[a-z]+$/, '');
    if (cleanId && cleanId !== notifStr) {
      if (!list.includes(`notif-${cleanId}`)) list.push(`notif-${cleanId}`);
      if (!list.includes(`farmer-notif-${cleanId}-confirmed`)) list.push(`farmer-notif-${cleanId}-confirmed`);
      if (!list.includes(`farmer-notif-${cleanId}-rejected`)) list.push(`farmer-notif-${cleanId}-rejected`);
      if (!list.includes(`farmer-notif-${cleanId}-declined`)) list.push(`farmer-notif-${cleanId}-declined`);
      if (!list.includes(`farmer-notif-${cleanId}-cancelled`)) list.push(`farmer-notif-${cleanId}-cancelled`);
    }
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {}
};

/**
 * Strict de-duplication of equipment items across local state, provider fleet, and remote catalog.
 * Guarantees zero duplicate machinery cards by comparing both normalized ID and normalized title.
 * Enforces strict exclusion of any equipment ID or title present in deletedEquipmentIds blacklist.
 */
export const deduplicateEquipment = (items = [], customDeletedIds = null) => {
  if (!Array.isArray(items)) return [];
  const delSet = customDeletedIds instanceof Set ? customDeletedIds : getDeletedEquipmentIds();
  const seenIds = new Set();
  const seenTitles = new Set();
  const result = [];

  for (const item of items) {
    if (!item) continue;
    const rawId = String(item.id || '').trim();
    const titleNorm = normalizeEquipmentTitle(item.title);

    // 1. Strict elimination of hardcoded legacy mock/demo equipment
    if (
      LEGACY_MOCK_EQUIPMENT_IDS.has(rawId) ||
      rawId.startsWith('eq-tr-') ||
      rawId.startsWith('eq-dr-') ||
      rawId.startsWith('eq-ir-') ||
      rawId.startsWith('eq-hv-') ||
      rawId.startsWith('EQ-TEST-') ||
      rawId.startsWith('FL-00') ||
      LEGACY_MOCK_TITLES.has(titleNorm)
    ) {
      continue;
    }

    // 2. Strict elimination of hardcoded demo provider entities
    const pName = String(item.providerName || item.ownerName || '').toLowerCase();
    if (
      pName.includes('agro fleet service') ||
      pName.includes('kisan drone kendra') ||
      pName.includes('solar agri tech hub') ||
      pName.includes('kisan harvester union') ||
      pName.includes('ramesh machinery hub') ||
      pName.includes('ramesh equipment hub')
    ) {
      continue;
    }

    const idKey = rawId || `eq-${titleNorm}`;

    // Blacklist check: if ID, clean number, or title was deleted by user, purge permanently
    const cleanNum = rawId.replace(/^[A-Za-z]+-/, '').trim();
    if (delSet.has(rawId) || (cleanNum && delSet.has(cleanNum)) || (titleNorm && delSet.has(`title_${titleNorm}`))) {
      continue;
    }

    const idMatch = rawId && seenIds.has(rawId);
    const titleMatch = titleNorm && seenTitles.has(titleNorm);

    if (idMatch || titleMatch) {
      // Find existing index and merge properties (preserving latest availability status)
      const existingIdx = result.findIndex(ex => {
        if (rawId && String(ex.id) === rawId) return true;
        if (titleNorm && normalizeEquipmentTitle(ex.title) === titleNorm) return true;
        return false;
      });

      if (existingIdx !== -1) {
        const existing = result[existingIdx];
        result[existingIdx] = {
          ...existing,
          ...item,
          id: existing.id || item.id,
          available: item.available !== undefined ? item.available : existing.available,
          availableToday: item.availableToday !== undefined ? item.availableToday : existing.availableToday,
          implements: Array.isArray(item.implements) && item.implements.length > 0 ? item.implements : existing.implements,
          implementsIncluded: Array.isArray(item.implementsIncluded) && item.implementsIncluded.length > 0 ? item.implementsIncluded : existing.implementsIncluded
        };
      }
      continue;
    }

    if (rawId) seenIds.add(rawId);
    if (titleNorm) seenTitles.add(titleNorm);

    result.push({
      ...item,
      id: idKey,
      title: item.title || 'Farm Machinery',
      category: item.category || 'tractor',
      phone: item.phone || item.contactPhone || '',
      contactPhone: item.contactPhone || item.phone || '',
      providerName: item.providerName || item.ownerName || 'Equipment Provider',
      village: item.village || item.locationVillage || '',
      mandal: item.mandal || '',
      district: item.district || item.locationDistrict || '',
      ratePerAcre: Number(item.ratePerAcre) || Number(item.hourlyRate) || 800,
      ratePerHour: Number(item.hourlyRate) || Number(item.ratePerHour) || 800,
      implements: Array.isArray(item.implements) ? item.implements : Array.isArray(item.implementsIncluded) ? item.implementsIncluded : [],
      implementsIncluded: Array.isArray(item.implementsIncluded) ? item.implementsIncluded : Array.isArray(item.implements) ? item.implements : [],
      available: item.available !== false,
      availableToday: item.available !== false && item.availableToday !== false,
      operatorIncluded: item.operatorIncluded !== false,
      imageUrl: item.imageUrl || item.image || getEquipmentFallbackImage(item.category, item.title)
    });
  }

  return result;
};

/**
 * Strict de-duplication of booking orders across local state, provider ledger, and backend API.
 * Guarantees zero duplicate booking cards or inflated revenue numbers.
 */
export const deduplicateBookings = (bookings = [], deletedIds = new Set()) => {
  if (!Array.isArray(bookings)) return [];
  const seenIds = new Set();
  const seenFingerprints = new Set();
  const result = [];

  const delSet = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);

  for (const b of bookings) {
    if (!b) continue;
    const rawId = String(b.id || b.bookingId || b._id || '').trim();
    if (!rawId && !b.title && !b.equipmentTitle) continue;

    // Filter test, mock, or user-deleted items
    if (rawId === 'BK-78210' || rawId.startsWith('BK-TEST-') || delSet.has(rawId)) {
      continue;
    }
    const cleanNumericId = rawId.replace(/^BK-/, '').trim();
    if (delSet.has(`BK-${cleanNumericId}`) || delSet.has(cleanNumericId)) {
      continue;
    }

    // Semantic fingerprint for duplicate submissions
    const titleNorm = String(b.equipmentTitle || b.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateNorm = String(b.serviceDate || b.date || b.bookingDate || '').trim();
    const slotNorm = String(b.timeSlot || b.slot || '').trim();
    const phoneNorm = String(b.farmerPhone || b.phone || b.contactPhone || '').replace(/[^0-9]/g, '').slice(-10);
    const acresNorm = String(b.acres || b.acreage || b.quantity || '').trim();
    const fingerprint = (titleNorm && dateNorm && phoneNorm)
      ? `${titleNorm}_${dateNorm}_${slotNorm}_${phoneNorm}_${acresNorm}`
      : null;

    const isIdSeen = (rawId && seenIds.has(rawId)) || (cleanNumericId && seenIds.has(`BK-${cleanNumericId}`));
    const isFingerprintSeen = fingerprint && seenFingerprints.has(fingerprint);

    if (isIdSeen || isFingerprintSeen) {
      const existingIdx = result.findIndex(ex => {
        const exId = String(ex.id || ex.bookingId || ex._id || '').trim();
        const exNumeric = exId.replace(/^BK-/, '').trim();
        if (rawId && (exId === rawId || exNumeric === cleanNumericId)) return true;
        if (fingerprint) {
          const exTitle = String(ex.equipmentTitle || ex.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const exDate = String(ex.serviceDate || ex.date || ex.bookingDate || '').trim();
          const exSlot = String(ex.timeSlot || ex.slot || '').trim();
          const exPhone = String(ex.farmerPhone || ex.phone || ex.contactPhone || '').replace(/[^0-9]/g, '').slice(-10);
          const exAcres = String(ex.acres || ex.acreage || ex.quantity || '').trim();
          if (`${exTitle}_${exDate}_${exSlot}_${exPhone}_${exAcres}` === fingerprint) return true;
        }
        return false;
      });

      if (existingIdx !== -1) {
        const existing = result[existingIdx];
        const statusPriority = { 'completed': 4, 'confirmed': 3, 'in-progress': 3, 'cancelled': 2, 'declined': 2, 'rejected': 2, 'pending': 1 };
        const curPri = statusPriority[String(existing.status).toLowerCase()] || 0;
        const newPri = statusPriority[String(b.status).toLowerCase()] || 0;
        result[existingIdx] = {
          ...existing,
          ...b,
          id: existing.id || b.id || `BK-${cleanNumericId || Math.floor(10000 + Math.random() * 90000)}`,
          bookingId: existing.bookingId || b.bookingId || existing.id,
          status: newPri >= curPri ? b.status : existing.status,
          phone: b.phone || b.farmerPhone || existing.phone || '9440182736',
          farmerPhone: b.farmerPhone || b.phone || existing.farmerPhone || '9440182736'
        };
      }
      continue;
    }

    if (rawId) {
      seenIds.add(rawId);
      if (cleanNumericId) {
        seenIds.add(`BK-${cleanNumericId}`);
        seenIds.add(cleanNumericId);
      }
    }
    if (fingerprint) seenFingerprints.add(fingerprint);

    result.push({
      ...b,
      id: rawId.startsWith('BK-') ? rawId : (cleanNumericId ? `BK-${cleanNumericId}` : `BK-${Math.floor(10000 + Math.random() * 90000)}`),
      bookingId: b.bookingId || rawId,
      phone: b.phone || b.farmerPhone || b.contactPhone || '9440182736',
      farmerPhone: b.farmerPhone || b.phone || b.contactPhone || '9440182736'
    });
  }

  return result;
};

/**
 * Helper to fetch persistent set of user-deleted booking IDs
 */
export const getDeletedBookingIds = () => {
  try {
    const raw = localStorage.getItem('agrishield_deleted_booking_ids');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
};

/**
 * Save deleted booking ID in all normalized formats and cascade to notification blacklist
 */
export const saveDeletedBookingId = (bookingId) => {
  try {
    const raw = localStorage.getItem('agrishield_deleted_booking_ids');
    const list = raw ? JSON.parse(raw) : [];
    const bStr = String(bookingId || '').trim();
    if (!bStr) return;

    if (!list.includes(bStr)) list.push(bStr);
    const cleanNum = bStr.replace(/^BK-/, '').trim();
    if (cleanNum) {
      if (!list.includes(`BK-${cleanNum}`)) list.push(`BK-${cleanNum}`);
      if (!list.includes(cleanNum)) list.push(cleanNum);
      // Cascade to notification blacklist so booking alerts vanish simultaneously
      saveDeletedNotificationId(`notif-${cleanNum}`);
      saveDeletedNotificationId(`farmer-notif-${cleanNum}-confirmed`);
      saveDeletedNotificationId(`farmer-notif-${cleanNum}-rejected`);
      saveDeletedNotificationId(`farmer-notif-${cleanNum}-declined`);
      saveDeletedNotificationId(`farmer-notif-${cleanNum}-cancelled`);
    }
    localStorage.setItem('agrishield_deleted_booking_ids', JSON.stringify(list));
  } catch (e) {}
};

