import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calendar from './Calendar.jsx';

afterEach(cleanup);

const START = '2026-10-05';

const room = (id, name, type = 'standard', active = true) => ({
  id,
  name,
  type,
  capacity: 2,
  pricePerNight: 85,
  active,
});
const stay = (id, roomId, guestName, checkIn, checkOut, status = 'booked') => ({
  id,
  roomId,
  guestName,
  checkIn,
  checkOut,
  status,
});

const rooms = [
  room('r301', '301', 'suite'),
  room('r102', '102'),
  room('r101', '101'),
  room('r204', '204', 'superior', false),
];

function setup(props = {}) {
  const handlers = { onPrev: vi.fn(), onNext: vi.fn(), onToday: vi.fn() };
  const view = render(
    <Calendar
      startDate={START}
      today={START}
      rooms={rooms}
      bookings={[]}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, ...view, user: userEvent.setup() };
}

describe('intestazione', () => {
  it('mostra l’intervallo e i sette giorni a partire dalla data iniziale', () => {
    const { container } = setup();
    expect(screen.getByRole('heading', { name: '5 ott – 11 ott 2026' })).toBeTruthy();
    const header = container.querySelector('.grid.grid-cols-7');
    expect(header.textContent).toBe('Lun5Mar6Mer7Gio8Ven9Sab10Dom11');
  });
  it('evidenzia soltanto la colonna di oggi', () => {
    const { container } = setup({ today: '2026-10-07' });
    const current = container.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Mer7');
  });
  it('non evidenzia nulla se oggi è fuori dalla settimana', () => {
    const { container } = setup({ today: '2026-10-20' });
    expect(container.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
  });
  it('i pulsanti di navigazione chiamano le funzioni ricevute', async () => {
    const { onPrev, onNext, onToday, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settimana precedente' }));
    await user.click(screen.getByRole('button', { name: 'Oggi' }));
    await user.click(screen.getByRole('button', { name: 'Settimana successiva' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('camere', () => {
  it('le raggruppa per tipologia e le ordina per nome', () => {
    const { container } = setup();
    const text = container.textContent;
    const order = ['Standard', '101', '102', 'Superior', '204', 'Suite', '301'].map((s) =>
      text.indexOf(s)
    );
    expect(order.every((pos) => pos >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('segnala la camera fuori servizio nella sua riga e nella legenda', () => {
    setup();
    expect(screen.getAllByText('Fuori servizio')).toHaveLength(2);
  });
  it('mostra la legenda degli stati con il testo', () => {
    setup();
    for (const label of ['Prenotata', 'Arrivato', 'Partito']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});

describe('prenotazioni', () => {
  it('disegna la barra dal mezzo del check-in al mezzo del check-out', () => {
    setup({ bookings: [stay('b1', 'r101', 'Marco Bianchi', '2026-10-06', '2026-10-08')] });
    const bar = screen.getByText('Marco Bianchi').parentElement;
    expect(parseFloat(bar.style.left)).toBeCloseTo((1.5 / 7) * 100);
    expect(bar.style.width).toMatch(/^calc\(28\.57\d*% - 2px\)$/);
  });
  it('la barra nasce nella riga della camera giusta', () => {
    setup({ bookings: [stay('b1', 'r102', 'Anna Verdi', '2026-10-06', '2026-10-08')] });
    const row = screen.getByText('Anna Verdi').closest('.grid.grid-cols-\\[4\\.5rem_1fr\\]');
    expect(within(row).getByText('102')).toBeTruthy();
  });
  it('nasconde le annullate e quelle fuori dalla settimana', () => {
    setup({
      bookings: [
        stay('a', 'r101', 'Annullata Rossi', '2026-10-06', '2026-10-08', 'cancelled'),
        stay('b', 'r101', 'Prima Neri', '2026-09-28', '2026-10-04'),
        stay('c', 'r101', 'Dopo Gallo', '2026-10-12', '2026-10-14'),
        stay('d', 'r101', 'Visibile Conti', '2026-10-09', '2026-10-13'),
      ],
    });
    expect(screen.queryByText('Annullata Rossi')).toBeNull();
    expect(screen.queryByText('Prima Neri')).toBeNull();
    expect(screen.queryByText('Dopo Gallo')).toBeNull();
    expect(screen.getByText('Visibile Conti')).toBeTruthy();
  });
  it('mostra il soggiorno iniziato prima della settimana', () => {
    setup({
      bookings: [stay('a', 'r101', 'Lunga Ferri', '2026-10-01', '2026-10-07', 'checkedIn')],
    });
    const bar = screen.getByText('Lunga Ferri').parentElement;
    expect(bar.style.left).toBe('0%');
  });
  it('lo stato si legge anche a parole, non solo dal colore', () => {
    setup({
      bookings: [
        stay('a', 'r101', 'Anna Verdi', '2026-10-06', '2026-10-08', 'checkedIn'),
        stay('b', 'r102', 'Luca Neri', '2026-10-06', '2026-10-08', 'booked'),
      ],
    });
    expect(screen.getByText(/Anna Verdi/).parentElement.textContent).toMatch(
      /camera 101, dal 6 ott al 8 ott, Arrivato/
    );
    expect(screen.getByText(/Luca Neri/).parentElement.textContent).toMatch(/Prenotata/);
  });
  it('più prenotazioni nella stessa camera restano distinte', () => {
    setup({
      bookings: [
        stay('a', 'r101', 'Primo Ospite', '2026-10-05', '2026-10-08'),
        stay('b', 'r101', 'Secondo Ospite', '2026-10-08', '2026-10-10'),
      ],
    });
    const first = screen.getByText('Primo Ospite').parentElement;
    const second = screen.getByText('Secondo Ospite').parentElement;
    const end = parseFloat(first.style.left) + (3 / 7) * 100;
    expect(parseFloat(second.style.left)).toBeCloseTo(end);
  });
});

describe('stato mostrato', () => {
  it('un soggiorno finito risulta "Partito" e ha l’aspetto spento', () => {
    setup({
      today: '2026-10-08',
      bookings: [stay('a', 'r101', 'Ospite Finito', '2026-10-05', '2026-10-07', 'checkedIn')],
    });
    const bar = screen.getByText('Ospite Finito').parentElement;
    expect(bar.className).toMatch(/bg-ink\/10/);
    expect(bar.textContent).toMatch(/Partito/);
  });
  it('il giorno del check-out il soggiorno è ancora "Arrivato"', () => {
    setup({
      today: '2026-10-07',
      bookings: [stay('a', 'r101', 'Ospite Oggi', '2026-10-05', '2026-10-07', 'checkedIn')],
    });
    const bar = screen.getByText('Ospite Oggi').parentElement;
    expect(bar.className).toMatch(/bg-clay/);
    expect(bar.className).not.toMatch(/bg-ink\/10/);
    expect(bar.textContent).toMatch(/Arrivato/);
  });
  it('anche una prenotazione mai arrivata, con il check-out passato, risulta "Partito"', () => {
    setup({
      today: '2026-10-08',
      bookings: [stay('a', 'r101', 'Mai Arrivato', '2026-10-05', '2026-10-07', 'booked')],
    });
    expect(screen.getByText('Mai Arrivato').parentElement.textContent).toMatch(/Partito/);
  });
});

describe('prenotazioni annullate', () => {
  const cancelled = stay('c', 'r101', 'Ospite Annullato', '2026-10-06', '2026-10-08', 'cancelled');
  const active = stay('a', 'r101', 'Ospite Attivo', '2026-10-06', '2026-10-08');

  it('per default non si vedono e la casella non è spuntata', () => {
    setup({ bookings: [cancelled, active], onToggleCancelled: vi.fn() });
    expect(screen.queryByText('Ospite Annullato')).toBeNull();
    expect(screen.getByLabelText('Mostra annullate').checked).toBe(false);
    expect(screen.queryByText('Annullata')).toBeNull();
  });
  it('con showCancelled compaiono tratteggiate e barrate, sotto le altre, e si leggono a parole', () => {
    setup({ bookings: [cancelled, active], showCancelled: true, onToggleCancelled: vi.fn() });
    const bar = screen.getByText('Ospite Annullato').parentElement;
    expect(bar.className).toMatch(/border-dashed/);
    expect(bar.className).toMatch(/line-through/);
    expect(bar.className).toMatch(/z-0/);
    expect(bar.textContent).toMatch(/Annullata/);
    expect(screen.getByText('Ospite Attivo').parentElement.className).toMatch(/z-10/);
    expect(screen.getByLabelText('Mostra annullate').checked).toBe(true);
  });
  it('la voce "Annullata" nella legenda compare solo quando sono visibili', () => {
    setup({ bookings: [], showCancelled: true });
    expect(screen.getByText('Annullata')).toBeTruthy();
  });
  it('la casella compare solo se c’è la funzione per cambiarla, e la chiama', async () => {
    setup();
    expect(screen.queryByLabelText('Mostra annullate')).toBeNull();
    cleanup();

    const onToggleCancelled = vi.fn();
    const second = setup({ onToggleCancelled });
    await second.user.click(screen.getByLabelText('Mostra annullate'));
    expect(onToggleCancelled).toHaveBeenLastCalledWith(true);
    cleanup();

    const third = setup({ showCancelled: true, onToggleCancelled });
    await third.user.click(screen.getByLabelText('Mostra annullate'));
    expect(onToggleCancelled).toHaveBeenLastCalledWith(false);
  });
  it('un’annullata visibile si può aprire, per poterla eliminare', async () => {
    const onSelectBooking = vi.fn();
    const { user } = setup({ bookings: [cancelled], showCancelled: true, onSelectBooking });
    await user.click(screen.getByRole('button', { name: /Ospite Annullato.*Annullata/ }));
    expect(onSelectBooking).toHaveBeenCalledWith(cancelled);
  });
});

describe('interazione', () => {
  it('senza onSelectBooking le barre non sono pulsanti', () => {
    setup({ bookings: [stay('a', 'r101', 'Anna Verdi', '2026-10-06', '2026-10-08')] });
    expect(screen.queryByRole('button', { name: /Anna Verdi/ })).toBeNull();
  });
  it('con onSelectBooking cliccare una barra passa la prenotazione', async () => {
    const booking = stay('a', 'r101', 'Anna Verdi', '2026-10-06', '2026-10-08');
    const onSelectBooking = vi.fn();
    const { user } = setup({ bookings: [booking], onSelectBooking });
    await user.click(screen.getByRole('button', { name: /Anna Verdi.*camera 101.*Prenotata/ }));
    expect(onSelectBooking).toHaveBeenCalledWith(booking);
  });
  it('senza onSelectCell le celle libere non sono pulsanti', () => {
    setup();
    expect(screen.queryByLabelText(/nuova prenotazione/)).toBeNull();
  });
  it('con onSelectCell si può cliccare una cella libera di una camera attiva', async () => {
    const onSelectCell = vi.fn();
    const { user } = setup({ onSelectCell });
    await user.click(screen.getByLabelText('Camera 101, 7 ott: nuova prenotazione'));
    expect(onSelectCell).toHaveBeenCalledWith({ roomId: 'r101', date: '2026-10-07' });
  });
  it('le celle libere non sono nel giro di Tab né negli strumenti di lettura', () => {
    setup({ onSelectCell: vi.fn() });
    const cell = screen.getByLabelText('Camera 101, 7 ott: nuova prenotazione');
    expect(cell.getAttribute('tabindex')).toBe('-1');
    expect(cell.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryAllByRole('button', { name: /nuova prenotazione/ })).toHaveLength(0);
  });
  it('al passaggio del mouse una cella libera mostra un "+" e un suggerimento', () => {
    setup({ onSelectCell: vi.fn() });
    const cell = screen.getByLabelText('Camera 101, 7 ott: nuova prenotazione');
    expect(cell.getAttribute('title')).toBe('Nuova prenotazione: camera 101, 7 ott');
    const icon = cell.querySelector('svg');
    expect(icon.getAttribute('class')).toMatch(/opacity-0/);
    expect(icon.getAttribute('class')).toMatch(/group-hover:opacity-100/);
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });
  it('spiega come usare le celle, e indica la strada per la tastiera', () => {
    setup({ onSelectCell: vi.fn() });
    const hint = screen.getByText(/Clicca una cella libera/);
    expect(hint.textContent).toMatch(/Da tastiera usa “Nuova prenotazione”/);
  });
  it('senza celle cliccabili non compare il suggerimento', () => {
    setup();
    expect(screen.queryByText(/Clicca una cella libera/)).toBeNull();
  });
  it('le barre restano raggiungibili da tastiera', () => {
    setup({
      onSelectBooking: vi.fn(),
      bookings: [stay('a', 'r101', 'Anna Verdi', '2026-10-06', '2026-10-08')],
    });
    expect(screen.getByRole('button', { name: /Anna Verdi/ }).getAttribute('tabindex')).toBeNull();
  });
  it('le camere fuori servizio non hanno celle cliccabili', () => {
    setup({ onSelectCell: vi.fn() });
    expect(screen.queryByLabelText(/Camera 204/)).toBeNull();
    expect(screen.getAllByLabelText(/nuova prenotazione/)).toHaveLength(3 * 7);
  });
});
