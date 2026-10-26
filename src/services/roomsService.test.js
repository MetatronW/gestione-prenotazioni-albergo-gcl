import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { addRoom, deleteRoom, getRooms, updateRoom } from './roomsService.js';

vi.mock('../firebase.js', () => ({ db: { fake: true } }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, name) => ({ kind: 'collection', name })),
  doc: vi.fn((db, name, id) => ({ kind: 'doc', name, id })),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

const snap = (id, data) => ({ id, data: () => data });

describe('roomsService', () => {
  it('legge le camere demo dalla collezione roomsDemo e aggiunge l’id', async () => {
    getDocs.mockResolvedValue({ docs: [snap('a', { name: '101' }), snap('b', { name: '102' })] });
    const rooms = await getRooms(true);
    expect(getDocs.mock.calls[0][0]).toEqual({ kind: 'collection', name: 'roomsDemo' });
    expect(rooms).toEqual([
      { id: 'a', name: '101' },
      { id: 'b', name: '102' },
    ]);
  });
  it('legge le camere reali dalla collezione rooms', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await getRooms(false);
    expect(getDocs.mock.calls[0][0]).toEqual({ kind: 'collection', name: 'rooms' });
  });
  it('crea una camera e restituisce i dati con l’id assegnato', async () => {
    addDoc.mockResolvedValue({ id: 'nuovo' });
    const created = await addRoom(true, { name: '103' });
    expect(addDoc).toHaveBeenCalledWith({ kind: 'collection', name: 'roomsDemo' }, { name: '103' });
    expect(created).toEqual({ id: 'nuovo', name: '103' });
  });
  it('modifica e cancella sul documento giusto', async () => {
    await updateRoom(false, 'x', { active: false });
    await deleteRoom(false, 'x');
    expect(updateDoc).toHaveBeenCalledWith(
      { kind: 'doc', name: 'rooms', id: 'x' },
      { active: false }
    );
    expect(deleteDoc).toHaveBeenCalledWith({ kind: 'doc', name: 'rooms', id: 'x' });
  });
});
