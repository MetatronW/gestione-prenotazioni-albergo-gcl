import { describe, it, expect } from 'vitest';
import { buildRoomData, validateRoom } from './roomUtils.js';

const rooms = [
  { id: 'r1', name: '101', type: 'standard', capacity: 2, pricePerNight: 85, active: true },
  { id: 'r2', name: '102', type: 'standard', capacity: 2, pricePerNight: 85, active: true },
];

const input = (overrides) => ({
  name: '103',
  type: 'standard',
  capacity: 2,
  pricePerNight: 85,
  active: true,
  ...overrides,
});

describe('validateRoom', () => {
  it('accetta una camera corretta', () => {
    expect(validateRoom(input(), rooms)).toEqual({ valid: true, errors: {} });
  });
  it('richiede il nome e ne limita la lunghezza', () => {
    expect(validateRoom(input({ name: '   ' }), rooms).errors.name).toBeDefined();
    expect(validateRoom(input({ name: 'x'.repeat(21) }), rooms).errors.name).toMatch(
      /troppo lungo/
    );
    expect(validateRoom(input({ name: 'x'.repeat(20) }), rooms).valid).toBe(true);
  });
  it('non ammette due camere con lo stesso nome, senza distinguere maiuscole', () => {
    expect(validateRoom(input({ name: '101' }), rooms).errors.name).toMatch(/già una camera/);
    const suites = [{ ...rooms[0], id: 's1', name: 'Suite A' }];
    expect(validateRoom(input({ name: 'suite a' }), suites).errors.name).toBeDefined();
  });
  it('in modifica una camera può tenere il proprio nome', () => {
    expect(validateRoom(input({ name: '101' }), rooms, 'r1').valid).toBe(true);
    expect(validateRoom(input({ name: '102' }), rooms, 'r1').errors.name).toBeDefined();
  });
  it('controlla la tipologia', () => {
    expect(validateRoom(input({ type: 'villa' }), rooms).errors.type).toBeDefined();
    expect(validateRoom(input({ type: 'suite' }), rooms).valid).toBe(true);
  });
  it('controlla la capienza (intero da 1 a 10)', () => {
    for (const capacity of [0, 11, 2.5, NaN, '2']) {
      expect(validateRoom(input({ capacity }), rooms).errors.capacity).toBeDefined();
    }
    expect(validateRoom(input({ capacity: 10 }), rooms).valid).toBe(true);
  });
  it('controlla il prezzo (intero in euro da 1 a 10000)', () => {
    for (const pricePerNight of [0, -5, 10001, 85.5, NaN, '85']) {
      expect(validateRoom(input({ pricePerNight }), rooms).errors.pricePerNight).toBeDefined();
    }
    expect(validateRoom(input({ pricePerNight: 10000 }), rooms).valid).toBe(true);
  });
});

describe('buildRoomData', () => {
  it('produce esattamente i 5 campi ammessi dalle regole', () => {
    expect(Object.keys(buildRoomData(input())).sort()).toEqual([
      'active',
      'capacity',
      'name',
      'pricePerNight',
      'type',
    ]);
  });
  it('pulisce il nome e, se manca, la camera è attiva', () => {
    const data = buildRoomData({ name: ' 103 ', type: 'standard', capacity: 2, pricePerNight: 85 });
    expect(data.name).toBe('103');
    expect(data.active).toBe(true);
  });
  it('mantiene lo stato fuori servizio', () => {
    expect(buildRoomData(input({ active: false })).active).toBe(false);
  });
});
