/**
 * AgriShield Date & Time Utilities
 * Provides accurate UTC-to-IST parsing, relative timeAgo calculation, and formatted date strings.
 */

/**
 * Universal date parser that handles UTC timestamps stored in MongoDB
 * without trailing 'Z' or timezone offsets.
 */
export function parseServerDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  let s = String(dateInput).trim();
  if (!s) return null;

  // Numeric epoch timestamp (seconds or milliseconds)
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
 * Returns human-readable relative time string ("Just now", "5m ago", "2h ago", "3d ago")
 * accurately comparing against Date.now().
 */
export function timeAgo(dateInput) {
  const date = parseServerDate(dateInput);
  if (!date || isNaN(date.getTime())) return 'Just now';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/**
 * Returns localized Indian Standard Time (IST) date and time format
 * e.g. "08 Sep 2026, 06:10 PM" or "8/9/2026, 6:10:10 PM"
 */
export function formatDateTime(dateInput, options = {}) {
  const date = parseServerDate(dateInput);
  if (!date || isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString('en-IN', {
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
