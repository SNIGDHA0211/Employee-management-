import { useState, useEffect } from 'react';
import { getHolidays } from '../services/api';

/** Normalize any date string to YYYY-MM-DD for consistent comparison. */
function toYYYYMMDD(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  // ISO: 2026-03-19 or 2026-03-19T00:00:00Z
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
    const part = s.includes('T') ? s.split('T')[0] : s.substring(0, 10);
    return part.length === 10 ? part : null;
  }
  // DD-MM-YYYY (e.g. 19-03-2026)
  const dmY = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmY) {
    const [, dd, mm, yyyy] = dmY;
    const d = dd!.padStart(2, '0');
    const m = mm!.padStart(2, '0');
    return `${yyyy}-${m}-${d}`;
  }
  // YYYY/MM/DD
  const yMd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yMd) {
    const [, yyyy, mm, dd] = yMd;
    return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Returns a Set of holiday dates (YYYY-MM-DD) from GET /eventsapi/holidays/.
 * Used to exclude holidays from leave duration calculation and half-day date selection.
 */
export function useLeaveHolidays(): { holidayDates: Set<string>; loading: boolean } {
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHolidays()
      .then((list) => {
        if (cancelled) return;
        const dates = new Set<string>();
        (list || []).forEach((h: { date?: string }) => {
          const norm = toYYYYMMDD(String(h?.date ?? ''));
          if (norm) dates.add(norm);
        });
        setHolidayDates(dates);
      })
      .catch(() => {
        if (!cancelled) setHolidayDates(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { holidayDates, loading };
}
