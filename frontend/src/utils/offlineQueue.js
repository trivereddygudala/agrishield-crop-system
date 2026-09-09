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
 * Save a field photograph for offline processing
 */
export const queueOfflineScan = async ({ file, tabId = 'disease-diag', cropFilter = '', language = 'en' }) => {
  try {
    const db = await openDB();

    // Convert file to Base64 data URL for robust IndexedDB serialization
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const record = {
      fileName: file.name || `field_scan_${Date.now()}.jpg`,
      fileType: file.type || 'image/jpeg',
      fileSize: file.size,
      dataUrl: base64Data,
      tabId,
      cropFilter,
      language,
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
        resolve({ success: true, id: req.result });
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
