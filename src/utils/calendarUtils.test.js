import { describe, it, expect } from 'vitest';
import { WINDOW_DAYS, getBarPosition, getQueryRange, groupRoomsByType } from './calendarUtils.js';

const START = '2026-10-05';
const b = (checkIn, checkOut) => ({ checkIn, checkOut });

describe('getQueryRange', () => {
  it('parte 30 giorni prima e finisce con l’ultimo giorno della settimana', () => {
    expect(WINDOW_DAYS).toBe(7);
    expect(getQueryRange(START)).toEqual({ from: '2026-09-05', to: '2026-10-11' });
  });
});

describe('getBarPosition', () => {
  it('prenotazione interna: da metà del check-in a metà del check-out', () => {
    const pos = getBarPosition(b('2026-10-06', '2026-10-08'), START);
    expect(pos.left).toBeCloseTo((1.5 / 7) * 100);
    expect(pos.width).toBeCloseTo((2 / 7) * 100);
    expect(pos.continuesBefore).toBe(false);
    expect(pos.continuesAfter).toBe(false);
  });
  it('iniziata prima della settimana: la barra parte dal bordo sinistro', () => {
    const pos = getBarPosition(b('2026-10-02', '2026-10-06'), START);
    expect(pos.left).toBe(0);
    expect(pos.width).toBeCloseTo((1.5 / 7) * 100);
    expect(pos.continuesBefore).toBe(true);
  });
  it('che finisce dopo la settimana: la barra arriva al bordo destro', () => {
    const pos = getBarPosition(b('2026-10-10', '2026-10-14'), START);
    expect(pos.left).toBeCloseTo((5.5 / 7) * 100);
    expect(pos.left + pos.width).toBeCloseTo(100);
    expect(pos.continuesAfter).toBe(true);
  });
  it('che copre tutta la settimana', () => {
    const pos = getBarPosition(b('2026-10-01', '2026-10-20'), START);
    expect(pos.left).toBe(0);
    expect(pos.width).toBeCloseTo(100);
    expect(pos.continuesBefore).toBe(true);
    expect(pos.continuesAfter).toBe(true);
  });
  it('con check-out il primo giorno si vede solo la mattina', () => {
    const pos = getBarPosition(b('2026-10-02', START), START);
    expect(pos.left).toBe(0);
    expect(pos.width).toBeCloseTo((0.5 / 7) * 100);
  });
  it('con check-in l’ultimo giorno si vede solo il pomeriggio', () => {
    const pos = getBarPosition(b('2026-10-11', '2026-10-13'), START);
    expect(pos.left).toBeCloseTo((6.5 / 7) * 100);
    expect(pos.width).toBeCloseTo((0.5 / 7) * 100);
  });
  it('fuori dalla settimana restituisce null', () => {
    expect(getBarPosition(b('2026-09-28', '2026-10-04'), START)).toBeNull();
    expect(getBarPosition(b('2026-10-12', '2026-10-15'), START)).toBeNull();
  });
  it('due prenotazioni consecutive nella stessa camera non si toccano', () => {
    const first = getBarPosition(b('2026-10-05', '2026-10-08'), START);
    const second = getBarPosition(b('2026-10-08', '2026-10-10'), START);
    expect(first.left + first.width).toBeCloseTo(second.left);
  });
});

describe('groupRoomsByType', () => {
  const rooms = [
    { id: '1', name: '301', type: 'suite' },
    { id: '2', name: '102', type: 'standard' },
    { id: '3', name: '2', type: 'superior' },
    { id: '4', name: '101', type: 'standard' },
    { id: '5', name: '10', type: 'superior' },
  ];

  it('raggruppa per tipologia nell’ordine standard, superior, suite', () => {
    const groups = groupRoomsByType(rooms);
    expect(groups.map((g) => g.type)).toEqual(['standard', 'superior', 'suite']);
    expect(groups.map((g) => g.label)).toEqual(['Standard', 'Superior', 'Suite']);
  });
  it('ordina le camere per nome, anche numericamente', () => {
    const groups = groupRoomsByType(rooms);
    expect(groups[0].rooms.map((r) => r.name)).toEqual(['101', '102']);
    expect(groups[1].rooms.map((r) => r.name)).toEqual(['2', '10']);
  });
  it('omette le tipologie senza camere', () => {
    expect(groupRoomsByType([rooms[1]]).map((g) => g.type)).toEqual(['standard']);
  });
});
