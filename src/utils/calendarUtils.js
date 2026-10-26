import { addDays, diffDays } from './dateUtils.js';
import { MAX_NIGHTS } from './bookingUtils.js';

export const WINDOW_DAYS = 7;

// Una settimana si legge con una sola query su checkIn. Si parte MAX_NIGHTS giorni prima,
// così si vedono anche i soggiorni iniziati prima della settimana e ancora in corso.
// Le prenotazioni con checkOut precedente alla settimana si scartano lato client.
export function getQueryRange(startIso, days = WINDOW_DAYS) {
  return { from: addDays(startIso, -MAX_NIGHTS), to: addDays(startIso, days - 1) };
}

// Posizione di una barra in percentuale sulla larghezza dei giorni.
// La barra inizia a metà del giorno di check-in e finisce a metà del giorno di check-out.
// Restituisce null se la prenotazione non tocca la finestra.
export function getBarPosition(booking, startIso, days = WINDOW_DAYS) {
  const s = diffDays(startIso, booking.checkIn);
  const e = diffDays(startIso, booking.checkOut);
  const start = Math.max(s + 0.5, 0);
  const end = Math.min(e + 0.5, days);
  if (end <= start) return null;
  return {
    left: (start / days) * 100,
    width: ((end - start) / days) * 100,
    continuesBefore: s + 0.5 < 0,
    continuesAfter: e + 0.5 > days,
  };
}

export const ROOM_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'superior', label: 'Superior' },
  { value: 'suite', label: 'Suite' },
];

// Camere raggruppate per tipologia (solo quelle presenti), ordinate per nome.
export function groupRoomsByType(rooms) {
  return ROOM_TYPES.map(({ value, label }) => ({
    type: value,
    label,
    rooms: rooms
      .filter((r) => r.type === value)
      .sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true })),
  })).filter((group) => group.rooms.length > 0);
}
