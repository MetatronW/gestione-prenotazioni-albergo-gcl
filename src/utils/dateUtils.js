// Le date sono testo AAAA-MM-GG. Tutti i calcoli usano UTC, così il cambio
// dell'ora legale non sposta mai un giorno.

// Per l'account demo "oggi" è sempre questo giorno (primo lunedì di ottobre 2026),
// così la demo mostra camere occupate, arrivi e partenze anche mesi dopo.
export const DEMO_TODAY = '2026-10-05';

const DAY_MS = 86400000;
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n, size = 2) => String(n).padStart(size, '0');

function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms) {
  const dt = new Date(ms);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * DAY_MS);

export const diffDays = (from, to) => Math.round((toUTC(to) - toUTC(from)) / DAY_MS);

// Data locale del computer (non UTC): serve per "oggi" del personale.
export const toISODate = (date) =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getToday = (mode) => (mode === 'demo' ? DEMO_TODAY : toISODate(new Date()));

export const getWindowDays = (startIso, n = 7) =>
  Array.from({ length: n }, (_, i) => addDays(startIso, i));

export const getWeekdayLabel = (iso) => WEEKDAYS[new Date(toUTC(iso)).getUTCDay()];

export function isWeekend(iso) {
  const day = new Date(toUTC(iso)).getUTCDay();
  return day === 0 || day === 6;
}

export const getDayNumber = (iso) => Number(iso.slice(8));

export const formatShortDate = (iso) =>
  `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export function formatRange(startIso, n = 7) {
  const end = addDays(startIso, n - 1);
  return `${formatShortDate(startIso)} – ${formatShortDate(end)} ${end.slice(0, 4)}`;
}
