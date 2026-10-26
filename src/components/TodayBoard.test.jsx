import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodayBoard from './TodayBoard.jsx';
import { DEMO_BOOKINGS, DEMO_ROOMS } from '../../scripts/demoData.js';
import { DEMO_TODAY } from '../utils/dateUtils.js';

afterEach(cleanup);

const TODAY = '2026-10-05';

const room = (id, name, type = 'standard', active = true) => ({
  id,
  name,
  type,
  capacity: 2,
  pricePerNight: 85,
  active,
});
const stay = (id, roomId, guestName, checkIn, checkOut, status = 'checkedIn') => ({
  id,
  roomId,
  guestName,
  checkIn,
  checkOut,
  status,
});

const rooms = [
  room('r101', '101'),
  room('r102', '102'),
  room('r103', '103'),
  room('r204', '204', 'superior', false),
  room('r301', '301', 'suite'),
];
const bookings = [
  stay('a', 'r101', 'Marco Bianchi', '2026-10-03', '2026-10-08'),
  stay('b', 'r102', 'Elena Conti', '2026-10-01', '2026-10-05'),
  stay('c', 'r102', 'Anna Verdi', '2026-10-05', '2026-10-07', 'booked'),
  stay('d', 'r103', 'Luca Neri', '2026-10-02', '2026-10-05'),
  stay('e', 'r301', 'Pietro Annullato', '2026-10-04', '2026-10-09', 'cancelled'),
];

const setup = (props = {}) => {
  render(<TodayBoard today={TODAY} rooms={rooms} bookings={bookings} {...props} />);
  return userEvent.setup();
};

const card = (name) => screen.getByText(name, { selector: 'p' }).closest('li');
const tile = (label) => screen.getByText(label).parentElement.textContent;

describe('numeri riassuntivi', () => {
  it('mostra la data di oggi e i conteggi della giornata', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Oggi · 5 ott' })).toBeTruthy();
    expect(tile('Arrivi oggi')).toBe('Arrivi oggi1');
    expect(tile('Partenze oggi')).toBe('Partenze oggi2');
    expect(tile('Occupate stanotte')).toBe('Occupate stanotte2 su 4');
    expect(tile('Libere stanotte')).toBe('Libere stanotte2');
    expect(tile('Occupazione')).toBe('Occupazione50%');
  });
});

describe('schede delle camere', () => {
  it('una scheda per camera, con lo stato scritto a parole', () => {
    setup();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(within(card('101')).getByText('Occupata')).toBeTruthy();
    expect(within(card('102')).getByText('Arrivo oggi')).toBeTruthy();
    expect(within(card('103')).getByText('Partenza oggi')).toBeTruthy();
    expect(within(card('204')).getByText('Fuori servizio')).toBeTruthy();
    expect(within(card('301')).getByText('Libera')).toBeTruthy();
  });
  it('indica la tipologia di ogni camera', () => {
    setup();
    expect(within(card('101')).getByText('Standard')).toBeTruthy();
    expect(within(card('204')).getByText('Superior')).toBeTruthy();
    expect(within(card('301')).getByText('Suite')).toBeTruthy();
  });
  it('una camera occupata mostra l’ospite e fino a quando resta', () => {
    setup();
    expect(card('101').textContent).toMatch(/Marco Bianchi · fino al 8 ott/);
  });
  it('un arrivo mostra chi arriva e, nello stesso giorno, chi parte', () => {
    setup();
    const text = card('102').textContent;
    expect(text).toMatch(/Arriva: Anna Verdi · fino al 7 ott/);
    expect(text).toMatch(/Parte: Elena Conti/);
  });
  it('una sola partenza mostra chi parte', () => {
    setup();
    expect(card('103').textContent).toMatch(/Parte: Luca Neri/);
    expect(card('103').textContent).not.toMatch(/Arriva/);
  });
  it('ignora le prenotazioni annullate', () => {
    setup();
    expect(card('301').textContent).not.toMatch(/Pietro Annullato/);
  });
  it('ordina le camere per tipologia e per nome', () => {
    setup();
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('p').textContent);
    expect(names).toEqual(['101', '102', '103', '204', '301']);
  });
});

describe('filtro "Solo libere stanotte"', () => {
  it('per default mostra tutte le camere', () => {
    setup();
    expect(screen.getByLabelText('Solo libere stanotte').checked).toBe(false);
    expect(screen.getByText('Mostrate 5 di 5 camere')).toBeTruthy();
  });
  it('mostra le camere libere e quelle con la sola partenza, non le occupate né gli arrivi', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('Solo libere stanotte'));
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('p').textContent);
    expect(names).toEqual(['103', '301']);
    expect(screen.getByText('Mostrate 2 di 5 camere')).toBeTruthy();
  });
  it('il numero delle schede coincide con "Libere stanotte"', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('Solo libere stanotte'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(tile('Libere stanotte')).toBe('Libere stanotte2');
  });
  it('si può togliere il filtro', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('Solo libere stanotte'));
    await user.click(screen.getByLabelText('Solo libere stanotte'));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
  it('se non ce ne sono lo dice', async () => {
    const user = setup({ rooms: [room('r101', '101')], bookings: [bookings[0]] });
    await user.click(screen.getByLabelText('Solo libere stanotte'));
    expect(screen.getByText('Nessuna camera libera stanotte.')).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

describe('senza dati', () => {
  it('senza camere lo dice e i numeri sono a zero', () => {
    setup({ rooms: [], bookings: [] });
    expect(screen.getByText('Non ci sono ancora camere.')).toBeTruthy();
    expect(tile('Occupate stanotte')).toBe('Occupate stanotte0 su 0');
    expect(tile('Occupazione')).toBe('Occupazione0%');
  });
  it('senza prenotazioni tutte le camere attive sono libere', () => {
    setup({ bookings: [] });
    expect(tile('Libere stanotte')).toBe('Libere stanotte4');
    expect(tile('Occupazione')).toBe('Occupazione0%');
  });
});

describe('con i dati demo (5 ottobre)', () => {
  const demoRooms = DEMO_ROOMS.map((r) => ({ id: r.id, ...r.data }));
  const demoBookings = DEMO_BOOKINGS.map((b) => ({ id: b.id, ...b.data }));
  const demo = () => setup({ today: DEMO_TODAY, rooms: demoRooms, bookings: demoBookings });

  it('mostra i numeri che si vedono nella demo', () => {
    demo();
    expect(tile('Arrivi oggi')).toBe('Arrivi oggi6');
    expect(tile('Partenze oggi')).toBe('Partenze oggi4');
    expect(tile('Occupate stanotte')).toBe('Occupate stanotte13 su 19');
    expect(tile('Libere stanotte')).toBe('Libere stanotte6');
    expect(tile('Occupazione')).toBe('Occupazione68%');
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
  });
  it('la 102 ha il cambio nello stesso giorno: parte Elena Conti, arriva Andrea Moretti', () => {
    demo();
    const text = card('102').textContent;
    expect(text).toMatch(/Arrivo oggi/);
    expect(text).toMatch(/Arriva: Andrea Moretti/);
    expect(text).toMatch(/Parte: Elena Conti/);
  });
  it('la 204 è fuori servizio', () => {
    demo();
    expect(within(card('204')).getByText('Fuori servizio')).toBeTruthy();
  });
  it('il filtro mostra 6 camere, quante "Libere stanotte"', async () => {
    const user = demo();
    await user.click(screen.getByLabelText('Solo libere stanotte'));
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});
