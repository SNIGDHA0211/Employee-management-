/**
 * Date format utilities for Date_of_join and Date_of_birth.
 * API expects: DD/MM/YYYY (e.g. "11/02/2026", "10/02/2003")
 * HTML date inputs use: YYYY-MM-DD
 */

/** Convert any date string to DD/MM/YYYY for API (Date_of_join, Date_of_birth) */
export function toApiDateFormat(date: string): string {
  if (!date || !date.trim()) return '';
  const s = date.trim();
  // Already DD/MM/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (ddmmyyyy) return `${ddmmyyyy[1].padStart(2, '0')}/${ddmmyyyy[2].padStart(2, '0')}/${ddmmyyyy[3]}`;
  // YYYY-MM-DD
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (yyyymmdd) return `${yyyymmdd[3]}/${yyyymmdd[2]}/${yyyymmdd[1]}`;
  // Try parsing as Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return s;
}

/** Convert API date (DD/MM/YYYY) to YYYY-MM-DD for HTML date inputs */
export function fromApiDateFormat(date: string): string {
  if (!date || !date.trim()) return '';
  const s = date.trim();
  // DD/MM/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try parsing as Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return s;
}
