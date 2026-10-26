import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as roomsService from '../services/roomsService.js';
import * as bookingsService from '../services/bookingsService.js';
import { useRooms } from './useRooms.js';

vi.mock('../services/roomsService.js', () => ({
  getRooms: vi.fn(),
  addRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
}));
vi.mock('../services/bookingsService.js', () => ({
  getBookingsForRoom: vi.fn(),
  hasBookingsForRoom: vi.fn(),
}));

const TODAY = '2026-10-05';
const room = (overrides) => ({
  id: 'r1',
  name: '101',
  type: 'standard',
  capacity: 3,
  pricePerNight: 85,
  active: true,
  ...overrides,
});
const stay = (overrides) => ({
  id: 'b1',
  roomId: 'r1',
  checkIn: '2026-10-06',
  checkOut: '2026-10-09',
  guestsCount: 2,
  status: 'booked',
  ...overrides,
});
const input = (overrides) => ({
  name: '101',
  type: 'standard',
  capacity: 3,
  pricePerNight: 85,
  active: true,
  ...overrides,
});

async function setup(rooms = [room()], demo = true) {
  roomsService.getRooms.mockResolvedValue(rooms);
  const hook = renderHook(() => useRooms(demo, TODAY));
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
  it('legge le camere una volta, dalla collezione giusta', async () => {
    const { result } = await setup([room(), room({ id: 'r2', name: '102' })], true);
    expect(roomsService.getRooms).toHaveBeenCalledTimes(1);
    expect(roomsService.getRooms).toHaveBeenCalledWith(true);
    expect(result.current.rooms).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });
  it('parte in caricamento', async () => {
    roomsService.getRooms.mockResolvedValue([]);
    const { result } = renderHook(() => useRooms(true, TODAY));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
  it('segnala l’errore di caricamento', async () => {
    roomsService.getRooms.mockRejectedValue(new Error('rete'));
    const { result } = renderHook(() => useRooms(true, TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/caricare le camere/);
    expect(result.current.rooms).toEqual([]);
  });
});

describe('addRoom', () => {
  it('rifiuta una camera non valida senza scrivere', async () => {
    const hook = await setup();
    const res = await call(hook, (h) => h.addRoom(input({ name: '101' })));
    expect(res.ok).toBe(false);
    expect(res.errors.name).toMatch(/già una camera/);
    expect(roomsService.addRoom).not.toHaveBeenCalled();
  });
  it('crea la camera e la aggiunge allo stato senza ricaricare', async () => {
    const hook = await setup();
    roomsService.addRoom.mockImplementation(async (demo, data) => ({ id: 'nuova', ...data }));
    const res = await call(hook, (h) => h.addRoom(input({ name: ' 102 ' })));
    expect(res.ok).toBe(true);
    expect(roomsService.addRoom).toHaveBeenCalledWith(true, {
      name: '102',
      type: 'standard',
      capacity: 3,
      pricePerNight: 85,
      active: true,
    });
    expect(hook.result.current.rooms.map((r) => r.id)).toEqual(['r1', 'nuova']);
    expect(roomsService.getRooms).toHaveBeenCalledTimes(1);
  });
  it('segnala un errore di rete come errore del modulo', async () => {
    const hook = await setup();
    roomsService.addRoom.mockRejectedValue(new Error('rete'));
    const res = await call(hook, (h) => h.addRoom(input({ name: '102' })));
    expect(res).toEqual({ ok: false, errors: { form: expect.stringMatching(/riprova/) } });
    expect(hook.result.current.rooms).toHaveLength(1);
  });
});

describe('updateRoom', () => {
  it('modifica il prezzo senza leggere le prenotazioni', async () => {
    const hook = await setup();
    const res = await call(hook, (h) => h.updateRoom('r1', input({ pricePerNight: 99 })));
    expect(res.ok).toBe(true);
    expect(roomsService.updateRoom).toHaveBeenCalledWith(
      true,
      'r1',
      expect.objectContaining({ pricePerNight: 99 })
    );
    expect(bookingsService.getBookingsForRoom).not.toHaveBeenCalled();
    expect(hook.result.current.rooms[0].pricePerNight).toBe(99);
  });
  it('non mette fuori servizio una camera con prenotazioni future', async () => {
    const hook = await setup();
    bookingsService.getBookingsForRoom.mockResolvedValue([stay()]);
    const res = await call(hook, (h) => h.updateRoom('r1', input({ active: false })));
    expect(res.ok).toBe(false);
    expect(res.errors.active).toMatch(/1 prenotazione in corso o future/);
    expect(roomsService.updateRoom).not.toHaveBeenCalled();
  });
  it('ignora i soggiorni già finiti e quelli annullati', async () => {
    const hook = await setup();
    bookingsService.getBookingsForRoom.mockResolvedValue([
      stay({ id: 'a', status: 'checkedIn', checkIn: '2026-10-02', checkOut: '2026-10-05' }),
      stay({ id: 'b', status: 'cancelled' }),
    ]);
    const res = await call(hook, (h) => h.updateRoom('r1', input({ active: false })));
    expect(res.ok).toBe(true);
    expect(hook.result.current.rooms[0].active).toBe(false);
  });
  it('non riduce la capienza sotto le persone già prenotate', async () => {
    const hook = await setup();
    bookingsService.getBookingsForRoom.mockResolvedValue([stay({ guestsCount: 3 })]);
    const res = await call(hook, (h) => h.updateRoom('r1', input({ capacity: 2 })));
    expect(res.ok).toBe(false);
    expect(res.errors.capacity).toMatch(/più di 2 persone/);
    expect(roomsService.updateRoom).not.toHaveBeenCalled();
  });
  it('permette di tenere il proprio nome e rifiuta quello di un’altra camera', async () => {
    const hook = await setup([room(), room({ id: 'r2', name: '102' })]);
    expect((await call(hook, (h) => h.updateRoom('r1', input()))).ok).toBe(true);
    const res = await call(hook, (h) => h.updateRoom('r1', input({ name: '102' })));
    expect(res.errors.name).toBeDefined();
  });
  it('segnala una camera inesistente', async () => {
    const hook = await setup();
    const res = await call(hook, (h) => h.updateRoom('zzz', input()));
    expect(res.errors.form).toMatch(/non trovata/);
  });
});

describe('removeRoom', () => {
  it('non elimina una camera con prenotazioni', async () => {
    const hook = await setup();
    bookingsService.hasBookingsForRoom.mockResolvedValue(true);
    const res = await call(hook, (h) => h.removeRoom('r1'));
    expect(res.ok).toBe(false);
    expect(res.errors.form).toMatch(/fuori servizio/);
    expect(roomsService.deleteRoom).not.toHaveBeenCalled();
    expect(hook.result.current.rooms).toHaveLength(1);
  });
  it('elimina una camera senza prenotazioni', async () => {
    const hook = await setup();
    bookingsService.hasBookingsForRoom.mockResolvedValue(false);
    const res = await call(hook, (h) => h.removeRoom('r1'));
    expect(res.ok).toBe(true);
    expect(roomsService.deleteRoom).toHaveBeenCalledWith(true, 'r1');
    expect(hook.result.current.rooms).toEqual([]);
  });
});
