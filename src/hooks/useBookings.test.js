import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as service from '../services/bookingsService.js';
import { useBookings } from './useBookings.js';

vi.mock('../services/bookingsService.js', () => ({
  getBookingsInRange: vi.fn(),
  addBooking: vi.fn(),
  updateBooking: vi.fn(),
  deleteBooking: vi.fn(),
}));

const START = '2026-10-05';
const rooms = [
  { id: 'r101', name: '101', type: 'standard', capacity: 2, pricePerNight: 95, active: true },
  { id: 'r102', name: '102', type: 'standard', capacity: 3, pricePerNight: 120, active: true },
  { id: 'r204', name: '204', type: 'superior', capacity: 2, pricePerNight: 130, active: false },
];

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

async function setup(loaded = [], { demo = true, start = START, today = START } = {}) {
  service.getBookingsInRange.mockResolvedValue(loaded);
  const hook = renderHook((props) => useBookings(demo, props.start, rooms, today), {
    initialProps: { start },
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

const call = async (hook, fn) => {
  let result;
  await act(async () => {
    result = await fn(hook.result.current);
  });
  return result;
};

beforeEach(() => vi.resetAllMocks());

describe('caricamento', () => {
  it('legge la settimana più i 30 giorni precedenti, dalla collezione giusta', async () => {
    await setup([], { demo: true });
    expect(service.getBookingsInRange).toHaveBeenCalledTimes(1);
    expect(service.getBookingsInRange).toHaveBeenCalledWith(true, '2026-09-05', '2026-10-11');
  });
  it('scarta le prenotazioni già finite prima della settimana', async () => {
    const { result } = await setup([
      booking({ id: 'finita', checkIn: '2026-09-28', checkOut: '2026-10-04' }),
      booking({ id: 'incorso', checkIn: '2026-10-03', checkOut: '2026-10-07' }),
      booking({ id: 'parteoggi', checkIn: '2026-10-01', checkOut: '2026-10-05' }),
    ]);
    expect(result.current.bookings.map((b) => b.id)).toEqual(['incorso', 'parteoggi']);
  });
  it('ricarica quando si cambia settimana', async () => {
    const hook = await setup();
    service.getBookingsInRange.mockResolvedValue([
      booking({ id: 'x', checkIn: '2026-10-13', checkOut: '2026-10-15' }),
    ]);
    hook.rerender({ start: '2026-10-12' });
    expect(hook.result.current.loading).toBe(true);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(service.getBookingsInRange).toHaveBeenLastCalledWith(true, '2026-09-12', '2026-10-18');
    expect(hook.result.current.bookings.map((b) => b.id)).toEqual(['x']);
  });
  it('segnala l’errore di caricamento', async () => {
    service.getBookingsInRange.mockRejectedValue(new Error('rete'));
    const { result } = renderHook(() => useBookings(true, START, rooms, START));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/caricare le prenotazioni/);
  });
});

describe('createBooking', () => {
  it('non legge il database se i campi non sono validi', async () => {
    const hook = await setup();
    const res = await call(hook, (h) => h.createBooking(input({ guestName: '' })));
    expect(res.ok).toBe(false);
    expect(res.errors.guestName).toBeDefined();
    expect(service.getBookingsInRange).toHaveBeenCalledTimes(1);
    expect(service.addBooking).not.toHaveBeenCalled();
  });
  it('controlla le sovrapposizioni sul database, anche fuori dalla settimana mostrata', async () => {
    const hook = await setup();
    service.getBookingsInRange.mockResolvedValue([
      booking({ id: 'lontana', checkIn: '2026-10-11', checkOut: '2026-10-14' }),
    ]);
    const res = await call(hook, (h) => h.createBooking(input()));
    expect(res.ok).toBe(false);
    expect(res.errors.roomId).toBe('La camera 101 è occupata dal 11 ott al 14 ott.');
    expect(service.getBookingsInRange).toHaveBeenLastCalledWith(true, '2026-09-10', '2026-10-11');
    expect(service.addBooking).not.toHaveBeenCalled();
  });
  it('crea la prenotazione con tariffa della camera, notti e totale calcolati', async () => {
    const hook = await setup();
    service.getBookingsInRange.mockResolvedValue([]);
    service.addBooking.mockImplementation(async (demo, data) => ({ id: 'nuova', ...data }));
    const res = await call(hook, (h) => h.createBooking(input({ roomId: 'r102', guestsCount: 3 })));
    expect(res.ok).toBe(true);
    expect(service.addBooking).toHaveBeenCalledWith(true, {
      guestName: 'Anna Verdi',
      phone: '333 000 2000',
      email: '',
      roomId: 'r102',
      checkIn: '2026-10-10',
      checkOut: '2026-10-12',
      guestsCount: 3,
      nights: 2,
      pricePerNight: 120,
      total: 240,
      status: 'booked',
      notes: '',
    });
    expect(hook.result.current.bookings.map((b) => b.id)).toEqual(['nuova']);
  });
  it('rifiuta camere fuori servizio e capienza superata', async () => {
    const hook = await setup();
    const out = await call(hook, (h) => h.createBooking(input({ roomId: 'r204' })));
    expect(out.errors.roomId).toMatch(/fuori servizio/);
    const crowded = await call(hook, (h) => h.createBooking(input({ guestsCount: 3 })));
    expect(crowded.errors.guestsCount).toMatch(/massimo 2/);
    expect(service.addBooking).not.toHaveBeenCalled();
  });
  it('segnala un errore di rete come errore del modulo', async () => {
    const hook = await setup();
    service.getBookingsInRange.mockResolvedValue([]);
    service.addBooking.mockRejectedValue(new Error('rete'));
    const res = await call(hook, (h) => h.createBooking(input()));
    expect(res).toEqual({ ok: false, errors: { form: expect.stringMatching(/riprova/) } });
    expect(hook.result.current.bookings).toEqual([]);
  });
});

describe('updateBooking', () => {
  it('permette di allungare il soggiorno: non si sovrappone a sé stessa', async () => {
    const hook = await setup([booking()]);
    service.getBookingsInRange.mockResolvedValue([booking()]);
    const res = await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-10' }))
    );
    expect(res.ok).toBe(true);
    expect(service.updateBooking).toHaveBeenCalledWith(
      true,
      'b1',
      expect.objectContaining({ nights: 5, total: 475, pricePerNight: 95, status: 'booked' })
    );
    expect(hook.result.current.bookings[0].checkOut).toBe('2026-10-10');
  });
  it('si ferma se la camera è occupata subito dopo', async () => {
    const hook = await setup([booking()]);
    service.getBookingsInRange.mockResolvedValue([
      booking(),
      booking({ id: 'b2', checkIn: '2026-10-09', checkOut: '2026-10-12' }),
    ]);
    const res = await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-10' }))
    );
    expect(res.errors.roomId).toBe('La camera 101 è occupata dal 9 ott al 12 ott.');
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
  it('mantiene la tariffa bloccata anche se il prezzo della camera è cambiato', async () => {
    const hook = await setup([booking({ pricePerNight: 80, total: 240 })]);
    service.getBookingsInRange.mockResolvedValue([]);
    await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-07' }))
    );
    expect(service.updateBooking).toHaveBeenCalledWith(
      true,
      'b1',
      expect.objectContaining({ pricePerNight: 80, total: 160 })
    );
  });
  it('usa la tariffa della nuova camera se si cambia camera', async () => {
    const hook = await setup([booking()]);
    service.getBookingsInRange.mockResolvedValue([]);
    await call(hook, (h) =>
      h.updateBooking(
        'b1',
        input({ roomId: 'r102', checkIn: '2026-10-05', checkOut: '2026-10-08' })
      )
    );
    expect(service.updateBooking).toHaveBeenCalledWith(
      true,
      'b1',
      expect.objectContaining({ roomId: 'r102', pricePerNight: 120, total: 360 })
    );
  });
  it('dopo l’arrivo il check-in non si cambia', async () => {
    const hook = await setup([booking({ status: 'checkedIn' })]);
    const res = await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-06', checkOut: '2026-10-08' }))
    );
    expect(res.errors.checkIn).toMatch(/dopo l’arrivo/i);
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
  it('dopo l’arrivo si può però cambiare il check-out', async () => {
    const hook = await setup([booking({ status: 'checkedIn' })]);
    service.getBookingsInRange.mockResolvedValue([]);
    const res = await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-09' }))
    );
    expect(res.ok).toBe(true);
    expect(service.updateBooking).toHaveBeenCalledWith(
      true,
      'b1',
      expect.objectContaining({ status: 'checkedIn', nights: 4 })
    );
  });
  it('una prenotazione annullata non si modifica', async () => {
    const hook = await setup([booking({ status: 'cancelled' })]);
    const res = await call(hook, (h) => h.updateBooking('b1', input()));
    expect(res.errors.form).toMatch(/non si può più modificare/);
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
  it('un soggiorno già finito (check-out passato) non si modifica', async () => {
    for (const status of ['booked', 'checkedIn']) {
      const hook = await setup([booking({ status, checkOut: '2026-10-07' })], {
        today: '2026-10-09',
      });
      const res = await call(hook, (h) => h.updateBooking('b1', input()));
      expect(res.errors.form).toMatch(/non si può più modificare/);
    }
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
  it('il giorno del check-out si può ancora modificare, il giorno dopo no', async () => {
    const lastDay = booking({ status: 'checkedIn', checkOut: '2026-10-08' });
    const hook = await setup([lastDay], { today: '2026-10-08' });
    service.getBookingsInRange.mockResolvedValue([]);
    const res = await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-09' }))
    );
    expect(res.ok).toBe(true);

    const nextDay = await setup([lastDay], { today: '2026-10-09' });
    const refused = await call(nextDay, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-09' }))
    );
    expect(refused.errors.form).toMatch(/non si può più modificare/);
  });
  it('un cliente che parte prima: accorciando il check-out la camera si libera', async () => {
    const hook = await setup([booking({ status: 'checkedIn' })]);
    service.getBookingsInRange.mockResolvedValue([]);
    const shortened = await call(hook, (h) =>
      h.updateBooking('b1', input({ checkIn: '2026-10-05', checkOut: '2026-10-06' }))
    );
    expect(shortened.ok).toBe(true);
    expect(service.updateBooking).toHaveBeenCalledWith(
      true,
      'b1',
      expect.objectContaining({ checkOut: '2026-10-06', nights: 1, total: 95, status: 'checkedIn' })
    );
    expect(hook.result.current.bookings[0].checkOut).toBe('2026-10-06');

    // Dal database ora risulta il soggiorno accorciato: la camera è libera dal 6.
    service.getBookingsInRange.mockResolvedValue([
      booking({ status: 'checkedIn', checkOut: '2026-10-06', nights: 1, total: 95 }),
    ]);
    service.addBooking.mockImplementation(async (demo, data) => ({ id: 'nuova', ...data }));
    const created = await call(hook, (h) =>
      h.createBooking(input({ checkIn: '2026-10-06', checkOut: '2026-10-08' }))
    );
    expect(created.ok).toBe(true);
  });
});

describe('changeStatus', () => {
  it('registra l’arrivo con un aggiornamento del solo stato', async () => {
    const hook = await setup([booking()]);
    expect((await call(hook, (h) => h.changeStatus('b1', 'checkedIn'))).ok).toBe(true);
    expect(service.updateBooking).toHaveBeenLastCalledWith(true, 'b1', { status: 'checkedIn' });
    expect(hook.result.current.bookings[0].status).toBe('checkedIn');
  });
  it('dopo l’arrivo non ci sono altri passaggi: la partenza si gestisce con il check-out', async () => {
    const hook = await setup([booking({ status: 'checkedIn' })]);
    for (const next of ['checkedOut', 'cancelled', 'booked']) {
      const res = await call(hook, (h) => h.changeStatus('b1', next));
      expect(res.errors.form).toMatch(/non è consentito/);
    }
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
  it('un soggiorno già finito non cambia più stato', async () => {
    const hook = await setup([booking({ checkOut: '2026-10-07' })], { today: '2026-10-09' });
    for (const next of ['checkedIn', 'cancelled']) {
      const res = await call(hook, (h) => h.changeStatus('b1', next));
      expect(res.errors.form).toMatch(/non è consentito/);
    }
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
  it('rifiuta i passaggi non ammessi', async () => {
    const hook = await setup([booking()]);
    const res = await call(hook, (h) => h.changeStatus('b1', 'checkedOut'));
    expect(res.errors.form).toMatch(/non è consentito/);
    expect(service.updateBooking).not.toHaveBeenCalled();
  });
});

describe('removeBooking', () => {
  it('elimina solo le prenotazioni annullate', async () => {
    const hook = await setup([booking({ id: 'a' }), booking({ id: 'c', status: 'cancelled' })]);
    const refused = await call(hook, (h) => h.removeBooking('a'));
    expect(refused.errors.form).toMatch(/solo una prenotazione annullata/);
    expect(service.deleteBooking).not.toHaveBeenCalled();

    const done = await call(hook, (h) => h.removeBooking('c'));
    expect(done.ok).toBe(true);
    expect(service.deleteBooking).toHaveBeenCalledWith(true, 'c');
    expect(hook.result.current.bookings.map((b) => b.id)).toEqual(['a']);
  });
});
