export function formatDuration(totalSecs?: number | null): string {
  if (!totalSecs || totalSecs <= 0) return '';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.round((totalSecs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDate(ms?: number | null): string {
  if (!ms) return 'Unlimited';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function daysUntil(ms?: number | null): number | null {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / 86_400_000);
}

export function yearOf(date?: string | null): string | undefined {
  const match = date?.match(/(19|20)\d{2}/);
  return match?.[0];
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/);
  return (words[0]?.[0] ?? '?').toUpperCase() + (words[1]?.[0] ?? '').toUpperCase();
}
