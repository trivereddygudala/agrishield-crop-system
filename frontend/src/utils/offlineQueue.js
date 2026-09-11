/**
 * Offline Scan Queue for AgriShield PWA Field Mode
 * Uses Browser IndexedDB to safely store field photographs when offline/low reception.
 * Automatically triggers background upload and diagnosis sync when connection returns.
 */

const DB_NAME = 'agrishield_field_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_scans';

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('tabId', 'tabId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Save a field photograph for offline processing along with optional on-device offline triage
 */
export const queueOfflineScan = async ({ file, tabId = 'disease-diag', cropFilter = '', language = 'en', offlineTriage = null }) => {
  try {
    const db = await openDB();

    // Convert file to Base64 data URL for robust IndexedDB serialization
    let base64Data = null;
    if (file instanceof File || file instanceof Blob) {
      base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (typeof file === 'string' && file.startsWith('data:')) {
      base64Data = file;
    }

    const record = {
      fileName: (file && file.name) || `field_scan_${Date.now()}.jpg`,
      fileType: (file && file.type) || 'image/jpeg',
      fileSize: (file && file.size) || (base64Data ? base64Data.length : 0),
      dataUrl: base64Data,
      tabId,
      cropFilter,
      language,
      offlineTriage: offlineTriage || null,
      timestamp: Date.now(),
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);

      req.onsuccess = () => {
        // Dispatch custom window event so UI badges update instantly
        window.dispatchEvent(new CustomEvent('agrishield-offline-scans-updated'));
        resolve({ success: true, id: req.result, record });
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to queue offline scan:', err);
    throw err;
  }
};

/**
 * Retrieve all pending offline scans
 */
export const getPendingOfflineScans = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not read offline scans:', err);
    return [];
  }
};

/**
 * Remove an item from the queue after successful upload
 */
export const removeOfflineScan = async (id) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('agrishield-offline-scans-updated'));
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to remove offline scan ${id}:`, err);
    return false;
  }
};

/**
 * Clear all offline scans from IndexedDB (e.g. discarding corrupted/unwanted scans)
 */
export const clearAllOfflineScans = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('agrishield-offline-scans-updated'));
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear offline scans:', err);
    return false;
  }
};

/**
 * Retrieve a specific scan by id
 */
export const getScanById = async (id) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(Number(id));

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to get scan ${id}:`, err);
    return null;
  }
};

/**
 * Update an existing scan record in IndexedDB (e.g. attaching cloud prediction result or updating status)
 */
export const updateScanRecord = async (id, updates) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(Number(id));

      getReq.onsuccess = () => {
        const current = getReq.result;
        if (!current) {
          resolve(false);
          return;
        }
        const updated = { ...current, ...updates };
        const putReq = store.put(updated);
        putReq.onsuccess = () => {
          window.dispatchEvent(new CustomEvent('agrishield-offline-scans-updated'));
          resolve(updated);
        };
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.error(`Failed to update scan ${id}:`, err);
    return false;
  }
};

/**
 * Convert Base64 back to File object for FormData submission
 */
export const dataUrlToFile = (dataUrl, fileName = 'offline_scan.jpg') => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
};

