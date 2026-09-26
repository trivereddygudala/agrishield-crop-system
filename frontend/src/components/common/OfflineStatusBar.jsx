import React, { useEffect } from 'react';
import { clearAllOfflineScans } from '../../utils/offlineQueue';

export const OfflineStatusBar = () => {
  // Completely suppress intrusive floating offline banner to keep UI clean and error-free
  useEffect(() => {
    try {
      clearAllOfflineScans().catch(() => {});
    } catch (_) {}
  }, []);

  return null;
};

export default OfflineStatusBar;
