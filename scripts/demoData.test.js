import { describe, it, expect } from 'vitest';
import { DEMO_BOOKINGS, DEMO_ROOMS } from './demoData.js';
import { DEMO_TODAY } from '../src/utils/dateUtils.js';
import {
  getDaySummary,
  getDisplayStatus,
  getRoomDayStatus,
  validateBooking,
} from '../src/utils/bookingUtils.js';
import { validateRoom } from '../src/utils/roomUtils.js';

const rooms = DEMO_ROOMS.map((r) => ({ id: r.id, ...r.data }));
const bookings = DEMO_BOOKINGS.map((b) => ({ id: b.id, ...b.data }));

describe('camere demo', () => {
  it('sono 20: 8 standard, 8 superior, 4 suite, con la 204 fuori servizio', () => {
    expect(rooms).toHaveLength(20);
    expect(rooms.filter((r) => r.type === 'standard')).toHaveLength(8);
    expect(rooms.filter((r) => r.type === 'superior')).toHaveLength(8);
    expect(rooms.filter((r) => r.type === 'suite')).toHaveLength(4);
    expect(rooms.filter((r) => !r.active).map((r) => r.name)).toEqual(['204']);
  });
  it('hanno id e nomi unici e passano la validazione', () => {
    expect(new Set(rooms.map((r) => r.id)).size).toBe(20);
    for (const r of rooms) {
      const others = rooms.filter((o) => o.id !== r.id);
      expect(validateRoom(r, others).errors).toEqual({});
    }
  });
});

describe('prenotazioni demo', () => {
  it('sono 52, di cui 3 annullate, con id unici', () => {
    expect(bookings).toHaveLength(52);
    expect(bookings.filter((b) => b.status === 'cancelled')).toHaveLength(3);
    expect(new Set(bookings.map((b) => b.id)).size).toBe(52);
  });
  it('hanno esattamente i 12 campi ammessi dalle regole', () => {
    const fields = [
      'guestName',
      'phone',
      'email',
      'roomId',
      'checkIn',
      'checkOut',
      'guestsCount',
      'nights',
      'pricePerNight',
      'total',
      'status',
      'notes',
    ].sort();
    for (const b of DEMO_BOOKINGS) expect(Object.keys(b.data).sort()).toEqual(fields);
  });
  it('rispettano tutti i controlli dell’app: nessuna sovrapposizione, capienza, camera attiva', () => {
    for (const b of bookings) {
      const room = rooms.find((r) => r.id === b.roomId);
      const others = bookings.filter((o) => o.id !== b.id);
      const { errors } = validateBooking(b, room, others, b.id);
      expect(errors, `${b.id} ${b.guestName}`).toEqual({});
    }
  });
  it('totale e tariffa sono coerenti con la camera', () => {
    for (const b of bookings) {
      const room = rooms.find((r) => r.id === b.roomId);
      expect(b.pricePerNight).toBe(room.pricePerNight);
      expect(b.total).toBe(b.nights * b.pricePerNight);
    }
  });
  it('gli stati salvati sono solo prenotata, arrivato e annullata', () => {
    for (const b of bookings) expect(['booked', 'checkedIn', 'cancelled']).toContain(b.status);
  });
  it('gli stati sono coerenti con la data demo', () => {
    for (const b of bookings) {
      if (b.status === 'checkedIn') expect(b.checkIn <= DEMO_TODAY).toBe(true);
      if (b.status === 'booked') expect(b.checkIn >= DEMO_TODAY).toBe(true);
    }
  });
  it('i soggiorni già finiti risultano "Partito", ricavandolo dalla data', () => {
    const departed = bookings.filter((b) => getDisplayStatus(b, DEMO_TODAY) === 'departed');
    expect(departed).toHaveLength(6);
    expect(departed.every((b) => b.status === 'checkedIn' && b.checkOut < DEMO_TODAY)).toBe(true);
  });
});

describe('la giornata demo', () => {
  const today = getDaySummary(rooms, bookings, DEMO_TODAY);

  it('ha arrivi, partenze e camere occupate', () => {
    expect(today).toEqual({
      totalRooms: 20,
      activeRooms: 19,
      arrivals: 6,
      departures: 4,
      occupiedTonight: 13,
      freeTonight: 6,
      occupancyPercent: 68,
    });
  });
  it('mostra tutti gli stati possibili', () => {
    const states = new Set(rooms.map((r) => getRoomDayStatus(r, bookings, DEMO_TODAY).state));
    expect(states).toEqual(new Set(['free', 'occupied', 'arrival', 'departure', 'outOfService']));
  });
  it('ha un cambio nello stesso giorno (partenza e arrivo nella 102)', () => {
    const r = getRoomDayStatus(
      rooms.find((x) => x.name === '102'),
      bookings,
      DEMO_TODAY
    );
    expect(r.state).toBe('arrival');
    expect(r.departing.guestName).toBe('Elena Conti');
    expect(r.arriving.guestName).toBe('Andrea Moretti');
  });
  it('ha arrivi ancora da registrare (stato Prenotata)', () => {
    const toCheckIn = bookings.filter((b) => b.checkIn === DEMO_TODAY && b.status === 'booked');
    expect(toCheckIn.length).toBeGreaterThanOrEqual(3);
  });
});
