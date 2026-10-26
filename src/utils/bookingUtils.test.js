import { describe, it, expect } from 'vitest';
import {
  BOOKING_STATUS,
  MAX_NIGHTS,
  ROOM_STATE,
  buildBookingData,
  calcNights,
  calcTotal,
  DEPARTED,
  STATUS_LABELS,
  canDelete,
  findOverlap,
  getDaySummary,
  getDisplayStatus,
  getNextStatuses,
  getRoomDayStatus,
  isCheckInLocked,
  isDeparted,
  isEditable,
  rangesOverlap,
  validateBooking,
} from './bookingUtils.js';

const room101 = {
  id: 'r101',
  name: '101',
  type: 'standard',
  capacity: 2,
  pricePerNight: 95,
  active: true,
};
const room102 = {
  id: 'r102',
  name: '102',
  type: 'standard',
  capacity: 3,
  pricePerNight: 95,
  active: true,
};
const room204 = {
  id: 'r204',
  name: '204',
  type: 'superior',
  capacity: 2,
  pricePerNight: 130,
  active: false,
};

const booking = (overrides) => ({
  id: 'b1',
  guestName: 'Marco Bianchi',
  phone: '333 000 1000',
  email: '',
  roomId: 'r101',
  checkIn: '2026-10-05',
  checkOut: '2026-10-08',
  guestsCount: 2,
  nights: 3,
  pricePerNight: 95,
  total: 285,
  status: 'booked',
  notes: '',
  ...overrides,
});

const input = (overrides) => ({
  guestName: 'Anna Verdi',
  phone: '333 000 2000',
  email: '',
  roomId: 'r101',
  checkIn: '2026-10-10',
  checkOut: '2026-10-12',
  guestsCount: 2,
  notes: '',
  ...overrides,
});

describe('notti e totale', () => {
  it('conta le notti, non i giorni', () => {
    expect(calcNights('2026-10-05', '2026-10-06')).toBe(1);
    expect(calcNights('2026-10-05', '2026-10-08')).toBe(3);
  });
  it('calcola il totale', () => {
    expect(calcTotal(3, 95)).toBe(285);
  });
});

describe('rangesOverlap', () => {
  it('chi parte e chi arriva lo stesso giorno non si sovrappongono', () => {
    expect(rangesOverlap('2026-10-05', '2026-10-08', '2026-10-08', '2026-10-10')).toBe(false);
    expect(rangesOverlap('2026-10-08', '2026-10-10', '2026-10-05', '2026-10-08')).toBe(false);
  });
  it('riconosce sovrapposizioni parziali e totali', () => {
    expect(rangesOverlap('2026-10-05', '2026-10-08', '2026-10-07', '2026-10-10')).toBe(true);
    expect(rangesOverlap('2026-10-05', '2026-10-12', '2026-10-07', '2026-10-09')).toBe(true);
    expect(rangesOverlap('2026-10-05', '2026-10-08', '2026-10-05', '2026-10-08')).toBe(true);
  });
  it('intervalli distanti non si sovrappongono', () => {
    expect(rangesOverlap('2026-10-05', '2026-10-08', '2026-10-09', '2026-10-10')).toBe(false);
  });
});

describe('findOverlap', () => {
  const bookings = [booking({ id: 'b1' })];
  const query = { roomId: 'r101', checkIn: '2026-10-07', checkOut: '2026-10-09' };

  it('trova la prenotazione in conflitto', () => {
    expect(findOverlap(bookings, query)?.id).toBe('b1');
  });
  it('ignora altre camere', () => {
    expect(findOverlap(bookings, { ...query, roomId: 'r102' })).toBeNull();
  });
  it('ignora le prenotazioni annullate', () => {
    expect(findOverlap([booking({ status: 'cancelled' })], query)).toBeNull();
  });
  it('ignora la prenotazione che si sta modificando', () => {
    expect(findOverlap(bookings, query, 'b1')).toBeNull();
  });
  it('permette il cambio nello stesso giorno', () => {
    expect(
      findOverlap(bookings, { ...query, checkIn: '2026-10-08', checkOut: '2026-10-10' })
    ).toBeNull();
  });
});

describe('validateBooking', () => {
  it('accetta una prenotazione corretta', () => {
    const result = validateBooking(input(), room101, [booking()]);
    expect(result).toEqual({ valid: true, errors: {} });
  });
  it('segnala i campi obbligatori', () => {
    const { errors } = validateBooking(input({ guestName: '  ', phone: '' }), room101, []);
    expect(errors.guestName).toBeDefined();
    expect(errors.phone).toBeDefined();
  });
  it('segnala l’email non valida ma accetta quella vuota', () => {
    expect(
      validateBooking(input({ email: 'non-una-email' }), room101, []).errors.email
    ).toBeDefined();
    expect(validateBooking(input({ email: 'a@b.it' }), room101, []).errors.email).toBeUndefined();
    expect(validateBooking(input({ email: '' }), room101, []).errors.email).toBeUndefined();
  });
  it('richiede una camera attiva', () => {
    expect(validateBooking(input({ roomId: '' }), undefined, []).errors.roomId).toMatch(/Scegli/);
    expect(validateBooking(input({ roomId: 'r204' }), room204, []).errors.roomId).toMatch(
      /fuori servizio/
    );
  });
  it('il check-out deve essere dopo il check-in', () => {
    const same = validateBooking(input({ checkOut: '2026-10-10' }), room101, []);
    const before = validateBooking(input({ checkOut: '2026-10-09' }), room101, []);
    expect(same.errors.checkOut).toMatch(/dopo il check-in/);
    expect(before.errors.checkOut).toMatch(/dopo il check-in/);
  });
  it('rifiuta date mancanti o inesistenti', () => {
    const { errors } = validateBooking(input({ checkIn: '', checkOut: '2026-02-30' }), room101, []);
    expect(errors.checkIn).toBeDefined();
    expect(errors.checkOut).toBeDefined();
  });
  it('accetta 30 notti e rifiuta 31', () => {
    const ok = validateBooking(
      input({ checkIn: '2026-11-01', checkOut: '2026-12-01' }),
      room101,
      []
    );
    const tooLong = validateBooking(
      input({ checkIn: '2026-11-01', checkOut: '2026-12-02' }),
      room101,
      []
    );
    expect(MAX_NIGHTS).toBe(30);
    expect(ok.valid).toBe(true);
    expect(tooLong.errors.checkOut).toMatch(/30 notti/);
  });
  it('controlla la capienza', () => {
    expect(validateBooking(input({ guestsCount: 3 }), room101, []).errors.guestsCount).toMatch(
      /massimo 2/
    );
    expect(validateBooking(input({ guestsCount: 3 }), room102, []).valid).toBe(true);
    expect(
      validateBooking(input({ guestsCount: 0 }), room101, []).errors.guestsCount
    ).toBeDefined();
    expect(
      validateBooking(input({ guestsCount: 1.5 }), room101, []).errors.guestsCount
    ).toBeDefined();
    expect(
      validateBooking(input({ guestsCount: NaN }), room101, []).errors.guestsCount
    ).toBeDefined();
  });
  it('segnala la sovrapposizione con le date del conflitto', () => {
    const result = validateBooking(
      input({ checkIn: '2026-10-07', checkOut: '2026-10-10' }),
      room101,
      [booking()]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.roomId).toBe('La camera 101 è occupata dal 5 ott al 8 ott.');
  });
  it('permette di allungare la propria prenotazione', () => {
    const existing = booking({ id: 'b1' });
    const extended = input({ checkIn: '2026-10-05', checkOut: '2026-10-10' });
    expect(validateBooking(extended, room101, [existing]).valid).toBe(false);
    expect(validateBooking(extended, room101, [existing], 'b1').valid).toBe(true);
  });
  it('l’allungamento si ferma se la camera è occupata dopo', () => {
    const existing = booking({ id: 'b1' });
    const next = booking({ id: 'b2', checkIn: '2026-10-09', checkOut: '2026-10-12' });
    const extended = input({ checkIn: '2026-10-05', checkOut: '2026-10-10' });
    const result = validateBooking(extended, room101, [existing, next], 'b1');
    expect(result.errors.roomId).toBe('La camera 101 è occupata dal 9 ott al 12 ott.');
  });
});

describe('buildBookingData', () => {
  it('produce esattamente i 12 campi ammessi dalle regole', () => {
    const data = buildBookingData(input(), 95);
    expect(Object.keys(data).sort()).toEqual(
      [
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
      ].sort()
    );
  });
  it('calcola notti e totale e parte da "Prenotata"', () => {
    const data = buildBookingData(input(), 95);
    expect(data.nights).toBe(2);
    expect(data.total).toBe(190);
    expect(data.pricePerNight).toBe(95);
    expect(data.status).toBe('booked');
  });
  it('pulisce gli spazi e completa i campi facoltativi', () => {
    const data = buildBookingData(
      input({ guestName: '  Anna Verdi ', phone: ' 333 ', email: undefined, notes: undefined }),
      100
    );
    expect(data.guestName).toBe('Anna Verdi');
    expect(data.phone).toBe('333');
    expect(data.email).toBe('');
    expect(data.notes).toBe('');
  });
  it('mantiene la tariffa che gli viene passata, anche se diversa da quella della camera', () => {
    const data = buildBookingData(input(), 80);
    expect(data.total).toBe(160);
  });
});

describe('stati della prenotazione', () => {
  const today = '2026-10-07';
  const open = (status) => booking({ status, checkIn: '2026-10-05', checkOut: '2026-10-08' });
  const past = (status) => booking({ status, checkIn: '2026-10-04', checkOut: '2026-10-06' });

  it('si salvano solo tre stati; "Partito" si mostra ma non si salva', () => {
    expect(Object.values(BOOKING_STATUS).sort()).toEqual(['booked', 'cancelled', 'checkedIn']);
    expect(DEPARTED).toBe('departed');
    expect(STATUS_LABELS).toEqual({
      booked: 'Prenotata',
      checkedIn: 'Arrivato',
      departed: 'Partito',
      cancelled: 'Annullata',
    });
  });

  it('una prenotazione è "Partita" dal giorno dopo il check-out', () => {
    expect(isDeparted(past('booked'), today)).toBe(true);
    expect(isDeparted(past('checkedIn'), today)).toBe(true);
    expect(isDeparted(booking({ checkOut: today }), today)).toBe(false);
    expect(isDeparted(booking({ checkOut: '2026-10-08' }), today)).toBe(false);
    expect(isDeparted(booking({ checkOut: '2026-10-06' }), '2026-10-07')).toBe(true);
  });
  it('un’annullata non risulta mai "Partita"', () => {
    expect(isDeparted(past('cancelled'), today)).toBe(false);
  });
  it('lo stato mostrato è quello salvato, tranne per i soggiorni finiti', () => {
    expect(getDisplayStatus(open('booked'), today)).toBe('booked');
    expect(getDisplayStatus(open('checkedIn'), today)).toBe('checkedIn');
    expect(getDisplayStatus(past('checkedIn'), today)).toBe('departed');
    expect(getDisplayStatus(past('booked'), today)).toBe('departed');
    expect(getDisplayStatus(past('cancelled'), today)).toBe('cancelled');
  });

  it('ammette solo i passaggi previsti', () => {
    expect(getNextStatuses(open('booked'), today)).toEqual(['checkedIn', 'cancelled']);
    expect(getNextStatuses(open('checkedIn'), today)).toEqual([]);
    expect(getNextStatuses(open('cancelled'), today)).toEqual([]);
    expect(getNextStatuses(open('inventato'), today)).toEqual([]);
  });
  it('un soggiorno finito non ha più passaggi di stato', () => {
    expect(getNextStatuses(past('booked'), today)).toEqual([]);
    expect(getNextStatuses(past('checkedIn'), today)).toEqual([]);
  });

  it('si modificano solo prenotate e arrivate, finché non sono partite', () => {
    expect(isEditable(open('booked'), today)).toBe(true);
    expect(isEditable(open('checkedIn'), today)).toBe(true);
    expect(isEditable(open('cancelled'), today)).toBe(false);
    expect(isEditable(past('booked'), today)).toBe(false);
    expect(isEditable(past('checkedIn'), today)).toBe(false);
  });
  it('il giorno del check-out la prenotazione si può ancora modificare', () => {
    const lastDay = booking({ status: 'checkedIn', checkOut: today });
    expect(isEditable(lastDay, today)).toBe(true);
    expect(isEditable(lastDay, '2026-10-08')).toBe(false);
  });

  it('dopo l’arrivo il check-in è bloccato', () => {
    expect(isCheckInLocked('booked')).toBe(false);
    expect(isCheckInLocked('checkedIn')).toBe(true);
  });
  it('si elimina solo una prenotazione annullata', () => {
    expect(canDelete('cancelled')).toBe(true);
    expect(canDelete('booked')).toBe(false);
    expect(canDelete('checkedIn')).toBe(false);
  });
});

describe('getRoomDayStatus', () => {
  const day = '2026-10-07';

  it('camera libera', () => {
    expect(getRoomDayStatus(room101, [], day).state).toBe(ROOM_STATE.FREE);
  });
  it('camera occupata (ospite in casa, né arrivo né partenza)', () => {
    const r = getRoomDayStatus(
      room101,
      [booking({ checkIn: '2026-10-05', checkOut: '2026-10-09' })],
      day
    );
    expect(r.state).toBe(ROOM_STATE.OCCUPIED);
    expect(r.current.guestName).toBe('Marco Bianchi');
  });
  it('arrivo oggi', () => {
    const r = getRoomDayStatus(room101, [booking({ checkIn: day, checkOut: '2026-10-09' })], day);
    expect(r.state).toBe(ROOM_STATE.ARRIVAL);
    expect(r.arriving).not.toBeNull();
  });
  it('partenza oggi', () => {
    const r = getRoomDayStatus(room101, [booking({ checkIn: '2026-10-05', checkOut: day })], day);
    expect(r.state).toBe(ROOM_STATE.DEPARTURE);
    expect(r.departing).not.toBeNull();
  });
  it('partenza e arrivo nello stesso giorno: stato "arrivo", con la partenza segnalata', () => {
    const leaving = booking({ id: 'a', checkIn: '2026-10-05', checkOut: day });
    const coming = booking({
      id: 'b',
      guestName: 'Anna Verdi',
      checkIn: day,
      checkOut: '2026-10-10',
    });
    const r = getRoomDayStatus(room101, [leaving, coming], day);
    expect(r.state).toBe(ROOM_STATE.ARRIVAL);
    expect(r.departing.id).toBe('a');
    expect(r.arriving.id).toBe('b');
  });
  it('camera fuori servizio', () => {
    expect(getRoomDayStatus(room204, [], day).state).toBe(ROOM_STATE.OUT_OF_SERVICE);
  });
  it('ignora prenotazioni annullate e di altre camere', () => {
    const cancelled = booking({
      checkIn: '2026-10-05',
      checkOut: '2026-10-09',
      status: 'cancelled',
    });
    const other = booking({ roomId: 'r102', checkIn: '2026-10-05', checkOut: '2026-10-09' });
    expect(getRoomDayStatus(room101, [cancelled, other], day).state).toBe(ROOM_STATE.FREE);
  });
});

describe('getDaySummary', () => {
  const day = '2026-10-07';
  const rooms = [room101, room102, room204];
  const bookings = [
    booking({ id: 'a', roomId: 'r101', checkIn: '2026-10-05', checkOut: day }),
    booking({ id: 'b', roomId: 'r101', checkIn: day, checkOut: '2026-10-09' }),
    booking({ id: 'c', roomId: 'r102', checkIn: '2026-10-04', checkOut: '2026-10-10' }),
  ];

  it('conta arrivi, partenze, occupazione e camere libere', () => {
    expect(getDaySummary(rooms, bookings, day)).toEqual({
      totalRooms: 3,
      activeRooms: 2,
      arrivals: 1,
      departures: 1,
      occupiedTonight: 2,
      freeTonight: 0,
      occupancyPercent: 100,
    });
  });
  it('non divide per zero se non ci sono camere attive', () => {
    expect(getDaySummary([room204], [], day).occupancyPercent).toBe(0);
    expect(getDaySummary([], [], day).occupancyPercent).toBe(0);
  });
});
