import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import {
  addBooking,
  deleteBooking,
  getBookingsForRoom,
  getBookingsInRange,
  hasBookingsForRoom,
  updateBooking,
} from './bookingsService.js';

vi.mock('../firebase.js', () => ({ db: { fake: true } }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, name) => ({ kind: 'collection', name })),
  doc: vi.fn((db, name, id) => ({ kind: 'doc', name, id })),
  query: vi.fn((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
  where: vi.fn((field, op, value) => ({ where: [field, op, value] })),
  orderBy: vi.fn((field) => ({ orderBy: field })),
  limit: vi.fn((n) => ({ limit: n })),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

const snap = (id, data) => ({ id, data: () => data });

describe('getBookingsInRange', () => {
  it('filtra e ordina per checkIn, con un solo campo di intervallo', async () => {
    getDocs.mockResolvedValue({ docs: [snap('b1', { guestName: 'Rossi' })] });
    const result = await getBookingsInRange(true, '2026-09-05', '2026-10-11');
    const q = getDocs.mock.calls[0][0];
    expect(q.ref).toEqual({ kind: 'collection', name: 'bookingsDemo' });
    expect(q.constraints).toEqual([
      { where: ['checkIn', '>=', '2026-09-05'] },
      { where: ['checkIn', '<=', '2026-10-11'] },
      { orderBy: 'checkIn' },
    ]);
    expect(result).toEqual([{ id: 'b1', guestName: 'Rossi' }]);
  });
  it('per i dati reali usa la collezione bookings', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await getBookingsInRange(false, '2026-09-05', '2026-10-11');
    expect(getDocs.mock.calls[0][0].ref.name).toBe('bookings');
  });
});

describe('prenotazioni di una camera', () => {
  it('le legge con un filtro di uguaglianza su roomId', async () => {
    getDocs.mockResolvedValue({ docs: [snap('b1', { roomId: 'r1' })] });
    const result = await getBookingsForRoom(true, 'r1');
    expect(getDocs.mock.calls[0][0].constraints).toEqual([{ where: ['roomId', '==', 'r1'] }]);
    expect(result).toEqual([{ id: 'b1', roomId: 'r1' }]);
  });
  it('controlla se ne esistono leggendone al massimo una', async () => {
    getDocs.mockResolvedValue({ empty: false });
    expect(await hasBookingsForRoom(true, 'r1')).toBe(true);
    expect(getDocs.mock.calls[0][0].constraints).toEqual([
      { where: ['roomId', '==', 'r1'] },
      { limit: 1 },
    ]);
    getDocs.mockResolvedValue({ empty: true });
    expect(await hasBookingsForRoom(true, 'r2')).toBe(false);
  });
});

describe('scritture', () => {
  it('crea e restituisce i dati con l’id assegnato', async () => {
    addDoc.mockResolvedValue({ id: 'nuovo' });
    const created = await addBooking(true, { guestName: 'Verdi' });
    expect(addDoc).toHaveBeenCalledWith(
      { kind: 'collection', name: 'bookingsDemo' },
      { guestName: 'Verdi' }
    );
    expect(created).toEqual({ id: 'nuovo', guestName: 'Verdi' });
  });
  it('modifica e cancella sul documento giusto della collezione giusta', async () => {
    await updateBooking(false, 'x', { status: 'checkedIn' });
    await deleteBooking(true, 'y');
    expect(updateDoc).toHaveBeenCalledWith(
      { kind: 'doc', name: 'bookings', id: 'x' },
      { status: 'checkedIn' }
    );
    expect(deleteDoc).toHaveBeenCalledWith({ kind: 'doc', name: 'bookingsDemo', id: 'y' });
  });
});
