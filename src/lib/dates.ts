/**
 * The database stores timestamps as UTC "YYYY-MM-DD HH:MM:SS" with no zone.
 * `new Date()` reads that as local time in Chrome and as Invalid Date in Safari,
 * so normalise it to ISO UTC first.
 */
export function parseDbDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  let normalized = raw;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
    normalized = `${raw.replace(' ', 'T')}Z`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
    normalized = `${raw}Z`;
  }
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDbDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const d = parseDbDate(value);
  if (!d) return '';
  return d.toLocaleDateString(undefined, options ?? { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDbDateTime(value: string | null | undefined): string {
  const d = parseDbDate(value);
  if (!d) return '';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function formatRelativeTime(value: string | null | undefined, now: number = Date.now()): string {
  const d = parseDbDate(value);
  if (!d) return '';
  const seconds = Math.round((now - d.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDbDate(value);
}

/** True when the timestamp is within the last `windowMinutes` minutes. */
export function isRecentlyActive(value: string | null | undefined, windowMinutes = 10, now: number = Date.now()): boolean {
  const d = parseDbDate(value);
  if (!d) return false;
  return now - d.getTime() <= windowMinutes * 60 * 1000;
}
