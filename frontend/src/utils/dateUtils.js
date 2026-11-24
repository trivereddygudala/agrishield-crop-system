/**
 * AgriShield Date & Time Utilities
 * Provides accurate UTC-to-IST parsing, relative timeAgo calculation, Google Messages native formatting, and localized date strings.
 */

/**
 * Universal date parser that handles UTC timestamps stored in MongoDB
 * without trailing 'Z', epoch numbers, or timezone offsets.
 */
export function parseServerDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  // Handle MongoDB $date object e.g. { $date: "2026-11-24T..." } or { $date: 1795444076586 }
  if (typeof dateInput === 'object') {
    if (dateInput.$date) {
      return parseServerDate(dateInput.$date);
    }
  }

  // Handle numeric epoch
  if (typeof dateInput === 'number') {
    return new Date(dateInput < 1e11 ? dateInput * 1000 : dateInput);
  }

  let s = String(dateInput).trim();
  if (!s) return null;

  // Numeric epoch timestamp in string form (seconds or milliseconds)
  if (/^\d{10,13}$/.test(s)) {
    const num = Number(s);
    return new Date(num < 1e11 ? num * 1000 : num);
  }

  // If ISO string does not contain timezone indicator ('Z', '+HH:MM', '-HH:MM'), treat as UTC
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    // Replace space with 'T' if format is "YYYY-MM-DD HH:MM:SS"
    s = s.replace(' ', 'T') + 'Z';
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(dateInput) : d;
}

/**
 * Helper to obtain standardized YYYY-MM-DD date key in Indian Standard Time (Asia/Kolkata)
 */
export function getISTDateKey(dateInput) {
  const d = parseServerDate(dateInput);
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * Returns human-readable relative time string ("Just now", "5m ago", "2h ago", "3d ago")
 * with optional Telugu localization, accurately comparing against Date.now().
 */
export function timeAgo(dateInput, isTe = false) {
  const isTelugu = Boolean(isTe === true || isTe === 'te' || (typeof isTe === 'string' && isTe.startsWith('te')));
  const date = parseServerDate(dateInput);
  if (!date || isNaN(date.getTime())) return isTelugu ? 'ఇప్పుడే' : 'Just now';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSec < 45) return isTelugu ? 'ఇప్పుడే' : 'Just now';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return isTelugu ? `${mins} నిమి క్రితం` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isTelugu ? `${hours} గం క్రితం` : `${hours}h ago`;
  }
  if (diffSec < 604800) {
    const days = Math.floor(diffSec / 86400);
    return isTelugu ? `${days} రోజుల క్రితం` : `${days}d ago`;
  }
  return date.toLocaleDateString(isTelugu ? 'te-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Format timestamp in Google Messages native style:
 * "Just now", "10 min", "04:15 PM", "Yesterday", "14 Nov"
 * Always normalized to Indian Standard Time (Asia/Kolkata).
 */
export function formatGoogleMessagesTime(dateInput, isTe = false) {
  if (!dateInput) return '';
  const d = parseServerDate(dateInput);
  if (!d || isNaN(d.getTime())) return '';

  const isTelugu = Boolean(isTe === true || isTe === 'te' || (typeof isTe === 'string' && isTe.startsWith('te')));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return isTelugu ? 'ఇప్పుడే' : 'Just now';
  if (diffMin < 60) return `${diffMin} ${isTelugu ? 'నిమి' : 'min'}`;

  const dateKey = getISTDateKey(d);
  const todayKey = getISTDateKey(now);
  if (dateKey === todayKey) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  }

  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayKey = getISTDateKey(yesterday);
  if (dateKey === yesterdayKey) {
    return isTelugu ? 'నిన్న' : 'Yesterday';
  }

  const isCurrentYear = dateKey.slice(0, 4) === todayKey.slice(0, 4);
  return d.toLocaleDateString(isTelugu ? 'te-IN' : 'en-IN', {
    month: 'short',
    day: 'numeric',
    year: isCurrentYear ? undefined : 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Format chat stream day dividers in native Google Messages style:
 * "Today", "Yesterday", "Sat, 14 Nov"
 * Always normalized to Indian Standard Time (Asia/Kolkata).
 */
export function formatChatDayDivider(dateInput, isTe = false) {
  const isTelugu = Boolean(isTe === true || isTe === 'te' || (typeof isTe === 'string' && isTe.startsWith('te')));
  if (!dateInput) return isTelugu ? 'ఈ రోజు (Today)' : 'Today';
  const d = parseServerDate(dateInput);
  if (!d || isNaN(d.getTime())) return isTelugu ? 'ఈ రోజు (Today)' : 'Today';

  const now = new Date();
  const dateKey = getISTDateKey(d);
  const todayKey = getISTDateKey(now);

  if (dateKey === todayKey) {
    return isTelugu ? 'ఈ రోజు (Today)' : 'Today';
  }

  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayKey = getISTDateKey(yesterday);
  if (dateKey === yesterdayKey) {
    return isTelugu ? 'నిన్న (Yesterday)' : 'Yesterday';
  }

  const isCurrentYear = dateKey.slice(0, 4) === todayKey.slice(0, 4);
  return d.toLocaleDateString(isTelugu ? 'te-IN' : 'en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: isCurrentYear ? undefined : 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Returns localized Indian Standard Time (IST) date and time format
 * e.g. "08 Sep 2026, 06:10 PM" or "8/9/2026, 6:10:10 PM"
 */
export function formatDateTime(dateInput, options = {}, isTe = false) {
  const date = parseServerDate(dateInput);
  if (!date || isNaN(date.getTime())) return 'N/A';

  const isTelugu = Boolean(isTe === true || isTe === 'te' || (typeof isTe === 'string' && isTe.startsWith('te')));
  return date.toLocaleString(isTelugu ? 'te-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: options.seconds ? '2-digit' : undefined,
    hour12: true,
    ...options
  });
}
