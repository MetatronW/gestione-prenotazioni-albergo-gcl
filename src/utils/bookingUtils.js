import { diffDays, formatShortDate, isValidISODate } from './dateUtils.js';

export const MAX_NIGHTS = 30;

// ---- Stati della prenotazione --------------------------------------------
// Gli stati SALVATI sono tre: prenotata, arrivato, annullata.
// "Partito" non si salva: una prenotazione non annullata con il check-out già passato
// risulta "Partito" e diventa di sola lettura. Per accorciare o allungare un soggiorno
// si modifica il check-out.

export const BOOKING_STATUS = {
  BOOKED: 'booked',
  CHECKED_IN: 'checkedIn',
  CANCELLED: 'cancelled',
};

// Stato che si mostra ma non si salva.
export const DEPARTED = 'departed';

export const STATUS_LABELS = {
  booked: 'Prenotata',
  checkedIn: 'Arrivato',
  departed: 'Partito',
  cancelled: 'Annullata',
};

// Gli unici passaggi ammessi (gli stessi delle regole di Firestore).
const NEXT_STATUSES = {
  booked: ['checkedIn', 'cancelled'],
  checkedIn: [],
  cancelled: [],
};

// today: la data di oggi (AAAA-MM-GG). Il giorno del check-out la prenotazione è ancora
// aperta: diventa "Partito" il giorno dopo.
export const isDeparted = (booking, today) =>
  booking.status !== BOOKING_STATUS.CANCELLED && booking.checkOut < today;

export const getDisplayStatus = (booking, today) =>
  isDeparted(booking, today) ? DEPARTED : booking.status;

export const getNextStatuses = (booking, today) =>
  isDeparted(booking, today) ? [] : (NEXT_STATUSES[booking.status] ?? []);

export const isEditable = (booking, today) =>
  !isDeparted(booking, today) &&
  (booking.status === BOOKING_STATUS.BOOKED || booking.status === BOOKING_STATUS.CHECKED_IN);

export const isCheckInLocked = (status) => status === BOOKING_STATUS.CHECKED_IN;
export const canDelete = (status) => status === BOOKING_STATUS.CANCELLED;

// ---- Notti e totale ------------------------------------------------------

export const calcNights = (checkIn, checkOut) => diffDays(checkIn, checkOut);
export const calcTotal = (nights, pricePerNight) => nights * pricePerNight;

// ---- Sovrapposizioni -----------------------------------------------------
// Il giorno del check-out la camera si libera: chi parte il 6 e chi arriva il 6
// non si sovrappongono (confronto stretto).

export const rangesOverlap = (inA, outA, inB, outB) => inA < outB && inB < outA;

export function findOverlap(bookings, { roomId, checkIn, checkOut }, ignoreId = null) {
  return (
    bookings.find(
      (b) =>
        b.id !== ignoreId &&
        b.roomId === roomId &&
        b.status !== BOOKING_STATUS.CANCELLED &&
        rangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)
    ) ?? null
  );
}

// ---- Validazione ---------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// input: { guestName, phone, email, roomId, checkIn, checkOut, guestsCount (numero), notes }
// room: la camera scelta (o undefined). bookings: prenotazioni già caricate.
// ignoreId: id della prenotazione che si sta modificando (non si sovrappone a sé stessa).
export function validateBooking(input, room, bookings, ignoreId = null) {
  const errors = {};
  const guestName = (input.guestName ?? '').trim();
  const phone = (input.phone ?? '').trim();
  const email = (input.email ?? '').trim();
  const notes = input.notes ?? '';

  if (!guestName) errors.guestName = 'Inserisci il nome dell’intestatario.';
  else if (guestName.length > 100)
    errors.guestName = 'Il nome è troppo lungo (massimo 100 caratteri).';

  if (!phone) errors.phone = 'Inserisci il telefono.';
  else if (phone.length > 30) errors.phone = 'Il telefono è troppo lungo (massimo 30 caratteri).';

  if (email && (email.length > 100 || !EMAIL_RE.test(email))) {
    errors.email = 'L’indirizzo email non è valido.';
  }
  if (notes.length > 500) errors.notes = 'Le note sono troppo lunghe (massimo 500 caratteri).';

  if (!room) errors.roomId = 'Scegli una camera.';
  else if (!room.active) errors.roomId = `La camera ${room.name} è fuori servizio.`;

  const inOk = isValidISODate(input.checkIn);
  const outOk = isValidISODate(input.checkOut);
  if (!inOk) errors.checkIn = 'Inserisci la data di check-in.';
  if (!outOk) errors.checkOut = 'Inserisci la data di check-out.';

  if (inOk && outOk) {
    const nights = calcNights(input.checkIn, input.checkOut);
    if (nights < 1) {
      errors.checkOut = 'Il check-out deve essere dopo il check-in.';
    } else if (nights > MAX_NIGHTS) {
      errors.checkOut = `Il soggiorno massimo è di ${MAX_NIGHTS} notti.`;
    } else if (room && !errors.roomId) {
      const conflict = findOverlap(
        bookings,
        { roomId: room.id, checkIn: input.checkIn, checkOut: input.checkOut },
        ignoreId
      );
      if (conflict) {
        errors.roomId = `La camera ${room.name} è occupata dal ${formatShortDate(conflict.checkIn)} al ${formatShortDate(conflict.checkOut)}.`;
      }
    }
  }

  const guests = input.guestsCount;
  if (!Number.isInteger(guests) || guests < 1) {
    errors.guestsCount = 'Indica almeno una persona.';
  } else if (room && guests > room.capacity) {
    errors.guestsCount = `La camera ${room.name} ospita al massimo ${room.capacity} persone.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Costruisce il documento da salvare: esattamente i 12 campi ammessi dalle regole.
// pricePerNight lo decide chi chiama (tariffa della camera, o quella già bloccata).
export function buildBookingData(input, pricePerNight, status = BOOKING_STATUS.BOOKED) {
  const nights = calcNights(input.checkIn, input.checkOut);
  return {
    guestName: input.guestName.trim(),
    phone: input.phone.trim(),
    email: (input.email ?? '').trim(),
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestsCount: input.guestsCount,
    nights,
    pricePerNight,
    total: calcTotal(nights, pricePerNight),
    status,
    notes: (input.notes ?? '').trim(),
  };
}

// ---- Stato di una camera in un giorno (cruscotto) ------------------------

export const ROOM_STATE = {
  FREE: 'free',
  OCCUPIED: 'occupied',
  ARRIVAL: 'arrival',
  DEPARTURE: 'departure',
  OUT_OF_SERVICE: 'outOfService',
};

export const ROOM_STATE_LABELS = {
  free: 'Libera',
  occupied: 'Occupata',
  arrival: 'Arrivo oggi',
  departure: 'Partenza oggi',
  outOfService: 'Fuori servizio',
};

// Se nello stesso giorno c'è una partenza e un arrivo lo stato è "arrival",
// ma `departing` resta valorizzato: la scheda può mostrare entrambi.
export function getRoomDayStatus(room, bookings, day) {
  if (!room.active) {
    return { state: ROOM_STATE.OUT_OF_SERVICE, current: null, arriving: null, departing: null };
  }
  const mine = bookings.filter(
    (b) => b.roomId === room.id && b.status !== BOOKING_STATUS.CANCELLED
  );
  const arriving = mine.find((b) => b.checkIn === day) ?? null;
  const departing = mine.find((b) => b.checkOut === day) ?? null;
  const current = mine.find((b) => b.checkIn < day && day < b.checkOut) ?? null;

  let state = ROOM_STATE.FREE;
  if (arriving) state = ROOM_STATE.ARRIVAL;
  else if (departing) state = ROOM_STATE.DEPARTURE;
  else if (current) state = ROOM_STATE.OCCUPIED;

  return { state, current, arriving, departing };
}

export function getDaySummary(rooms, bookings, day) {
  const activeRooms = rooms.filter((r) => r.active);
  let arrivals = 0;
  let departures = 0;
  let occupiedTonight = 0;

  for (const room of activeRooms) {
    const { current, arriving, departing } = getRoomDayStatus(room, bookings, day);
    if (arriving) arrivals += 1;
    if (departing) departures += 1;
    if (arriving || current) occupiedTonight += 1;
  }

  return {
    totalRooms: rooms.length,
    activeRooms: activeRooms.length,
    arrivals,
    departures,
    occupiedTonight,
    freeTonight: activeRooms.length - occupiedTonight,
    occupancyPercent: activeRooms.length
      ? Math.round((occupiedTonight / activeRooms.length) * 100)
      : 0,
  };
}
