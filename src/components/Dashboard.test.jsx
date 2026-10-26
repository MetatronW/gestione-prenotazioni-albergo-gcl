import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard.jsx';
import { useBookings } from '../hooks/useBookings.js';
import { useRooms } from '../hooks/useRooms.js';

vi.mock('../hooks/useRooms.js', () => ({ useRooms: vi.fn() }));
vi.mock('../hooks/useBookings.js', () => ({ useBookings: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const rooms = [
  { id: 'r101', name: '101', type: 'standard', capacity: 2, pricePerNight: 85, active: true },
  { id: 'r102', name: '102', type: 'standard', capacity: 2, pricePerNight: 85, active: true },
  { id: 'r204', name: '204', type: 'superior', capacity: 2, pricePerNight: 120, active: false },
];

const stay = (overrides) => ({
  id: 'b1',
  roomId: 'r101',
  guestName: 'Marco Bianchi',
  phone: '333 000 1000',
  email: '',
  checkIn: '2026-10-06',
  checkOut: '2026-10-08',
  guestsCount: 2,
  nights: 2,
  pricePerNight: 85,
  total: 170,
  status: 'booked',
  notes: '',
  ...overrides,
});

const bookings = [
  stay(),
  stay({
    id: 'b2',
    roomId: 'r102',
    guestName: 'Luca Partito',
    checkIn: '2026-10-01',
    checkOut: '2026-10-04',
    status: 'checkedIn',
  }),
  stay({
    id: 'b4',
    roomId: 'r102',
    guestName: 'Ospite Arrivato',
    checkIn: '2026-10-04',
    checkOut: '2026-10-09',
    status: 'checkedIn',
  }),
  stay({
    id: 'b3',
    roomId: 'r102',
    guestName: 'Gianni Annullato',
    checkIn: '2026-10-08',
    checkOut: '2026-10-10',
    status: 'cancelled',
  }),
];

function mockData({ loading = false, roomsLoading = false, error = null } = {}) {
  const createBooking = vi
    .fn()
    .mockResolvedValue({ ok: true, booking: stay({ guestName: 'Anna Verdi' }) });
  const updateBooking = vi.fn().mockResolvedValue({ ok: true, booking: stay() });
  const changeStatus = vi.fn().mockResolvedValue({ ok: true, booking: stay() });
  const removeBooking = vi.fn().mockResolvedValue({ ok: true });
  const reload = vi.fn();
  const addRoom = vi
    .fn()
    .mockImplementation(async (input) => ({ ok: true, room: { id: 'nuova', ...input } }));
  const updateRoom = vi
    .fn()
    .mockImplementation(async (id, input) => ({ ok: true, room: { id, ...input } }));
  const removeRoom = vi.fn().mockResolvedValue({ ok: true });
  useRooms.mockReturnValue({
    rooms,
    loading: roomsLoading || loading,
    error: null,
    addRoom,
    updateRoom,
    removeRoom,
  });
  useBookings.mockReturnValue({
    bookings,
    loading,
    error,
    createBooking,
    updateBooking,
    changeStatus,
    removeBooking,
    reload,
  });
  return {
    createBooking,
    updateBooking,
    changeStatus,
    removeBooking,
    reload,
    addRoom,
    updateRoom,
    removeRoom,
  };
}

const demoUser = { email: 'demo@example.com' };
function setup(props = {}, data = {}) {
  const fns = mockData(data);
  render(<Dashboard user={demoUser} isDemo onLogout={vi.fn()} {...props} />);
  return { ...fns, user: userEvent.setup() };
}

const openFromHeader = (user) =>
  user.click(screen.getByRole('button', { name: 'Nuova prenotazione' }));
const clickBar = (user, name) => user.click(screen.getByRole('button', { name }));
const MARCO = /Marco Bianchi.*Prenotata/;

describe('pagina', () => {
  it('per la demo parte dalla settimana del 5 ottobre e usa le collezioni demo', () => {
    setup();
    expect(useRooms).toHaveBeenCalledWith(true, '2026-10-05');
    expect(useBookings).toHaveBeenCalledWith(true, '2026-10-05', rooms, '2026-10-05');
    expect(screen.getByText(/account demo/).textContent).toMatch(/Oggi: 5 ott/);
    expect(screen.getByRole('heading', { name: '5 ott – 11 ott 2026' })).toBeTruthy();
  });

  it('per il personale usa i dati reali', () => {
    setup({ user: { email: 'staff@example.com' }, isDemo: false });
    expect(useRooms.mock.calls[0][0]).toBe(false);
    expect(useBookings.mock.calls[0][0]).toBe(false);
    expect(screen.getByText(/personale/)).toBeTruthy();
  });

  it('mostra le camere e le prenotazioni nel calendario', () => {
    setup();
    const calendar = screen.getByRole('region', { name: 'Calendario delle prenotazioni' });
    expect(within(calendar).getByText('Marco Bianchi')).toBeTruthy();
    expect(within(calendar).getByText('102')).toBeTruthy();
  });

  it('le frecce spostano la settimana di 7 giorni e "Oggi" torna a quella corrente', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settimana successiva' }));
    expect(useBookings).toHaveBeenCalledWith(true, '2026-10-12', rooms, '2026-10-05');
    expect(screen.getByRole('heading', { name: '12 ott – 18 ott 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Settimana precedente' }));
    await user.click(screen.getByRole('button', { name: 'Settimana precedente' }));
    expect(useBookings).toHaveBeenCalledWith(true, '2026-09-28', rooms, '2026-10-05');
    expect(screen.getByRole('heading', { name: '28 set – 4 ott 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Oggi' }));
    expect(screen.getByRole('heading', { name: '5 ott – 11 ott 2026' })).toBeTruthy();
  });

  it('mostra il caricamento e blocca "Nuova prenotazione" finché mancano le camere', () => {
    setup({}, { roomsLoading: true });
    expect(screen.getByRole('status').textContent).toBe('Caricamento dati...');
    expect(screen.getByRole('button', { name: 'Nuova prenotazione' }).disabled).toBe(true);
  });

  it('mostra gli errori come avviso', () => {
    setup({}, { error: 'Non è stato possibile caricare le prenotazioni.' });
    expect(screen.getByRole('alert').textContent).toMatch(/caricare le prenotazioni/);
  });

  it('il pulsante Esci chiama il logout', async () => {
    const onLogout = vi.fn();
    const { user } = setup({ onLogout });
    await user.click(screen.getByRole('button', { name: 'Esci' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('nuova prenotazione', () => {
  it('dal pulsante in alto apre il modulo vuoto, con il focus sulla camera', async () => {
    const { user } = setup();
    await openFromHeader(user);
    expect(screen.getByRole('dialog', { name: 'Nuova prenotazione' })).toBeTruthy();
    expect(screen.getByLabelText('Camera').value).toBe('');
    expect(screen.getByLabelText('Check-in').value).toBe('2026-10-05');
    expect(screen.getByLabelText('Check-out').value).toBe('2026-10-06');
    expect(document.activeElement).toBe(screen.getByLabelText('Camera'));
  });

  it('cliccando una cella libera precompila camera e data, con il focus sull’intestatario', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    expect(screen.getByRole('dialog', { name: 'Nuova prenotazione' })).toBeTruthy();
    expect(screen.getByLabelText('Camera').value).toBe('r101');
    expect(screen.getByLabelText('Check-in').value).toBe('2026-10-09');
    expect(screen.getByLabelText('Check-out').value).toBe('2026-10-10');
    expect(document.activeElement).toBe(screen.getByLabelText('Intestatario'));
  });

  it('crea la prenotazione, chiude la finestra e conferma a parole', async () => {
    const { createBooking, user } = setup();
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    await user.type(screen.getByLabelText('Intestatario'), 'Anna Verdi');
    await user.type(screen.getByLabelText('Telefono'), '333 000 2000');
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r101',
        checkIn: '2026-10-09',
        checkOut: '2026-10-10',
        guestsCount: 2,
        guestName: 'Anna Verdi',
        phone: '333 000 2000',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Prenotazione creata per Anna Verdi.');
  });

  it('se i controlli falliscono la finestra resta aperta con l’errore accanto al campo', async () => {
    const { createBooking, user } = setup();
    createBooking.mockResolvedValue({
      ok: false,
      errors: { roomId: 'La camera 101 è occupata dal 9 ott al 12 ott.' },
    });
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));

    expect(await screen.findByText('La camera 101 è occupata dal 9 ott al 12 ott.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Prenotazione creata/)).toBeNull();
  });

  it('aprire un’altra finestra cancella la conferma precedente', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/creata/));
    await openFromHeader(user);
    expect(screen.queryByText(/Prenotazione creata/)).toBeNull();
  });
});

describe('dettaglio', () => {
  it('cliccando una barra si apre il dettaglio della prenotazione', async () => {
    const { user } = setup();
    await clickBar(user, MARCO);
    expect(screen.getByRole('dialog', { name: 'Prenotazione di Marco Bianchi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registra arrivo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modifica' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Annulla prenotazione' })).toBeTruthy();
  });

  it('un soggiorno già finito si apre in sola lettura, come "Partito"', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settimana precedente' }));
    await clickBar(user, /Luca Partito.*Partito/);
    const dialog = screen.getByRole('dialog', { name: 'Prenotazione di Luca Partito' });
    expect(dialog.textContent).toMatch(/StatoPartito/);
    expect(
      within(dialog).queryByRole('button', {
        name: /Registra|Modifica|Annulla prenotazione|Elimina/,
      })
    ).toBeNull();
  });

  it('chi è già arrivato si può solo modificare: non esiste più "Registra partenza"', async () => {
    const { user } = setup();
    await clickBar(user, /Ospite Arrivato.*Arrivato/);
    const dialog = screen.getByRole('dialog', { name: 'Prenotazione di Ospite Arrivato' });
    expect(within(dialog).getByRole('button', { name: 'Modifica' })).toBeTruthy();
    expect(
      within(dialog).queryByRole('button', { name: /Registra|Annulla prenotazione|Elimina/ })
    ).toBeNull();
  });

  it('per una partenza anticipata si accorcia il check-out dal modulo di modifica', async () => {
    const { updateBooking, user } = setup();
    await clickBar(user, /Ospite Arrivato.*Arrivato/);
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    expect(screen.getByLabelText('Check-in').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: '2026-10-07' } });
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(updateBooking).toHaveBeenCalledWith(
      'b4',
      expect.objectContaining({ checkIn: '2026-10-04', checkOut: '2026-10-07' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('registra l’arrivo, chiude la finestra e conferma', async () => {
    const { changeStatus, user } = setup();
    await clickBar(user, MARCO);
    await user.click(screen.getByRole('button', { name: 'Registra arrivo' }));
    expect(changeStatus).toHaveBeenCalledWith('b1', 'checkedIn');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Arrivo registrato per Marco Bianchi.');
  });

  it('annulla la prenotazione solo dopo la conferma', async () => {
    const { changeStatus, user } = setup();
    await clickBar(user, MARCO);
    await user.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));
    expect(changeStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sì, annulla la prenotazione' }));
    expect(changeStatus).toHaveBeenCalledWith('b1', 'cancelled');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Prenotazione di Marco Bianchi annullata.');
  });

  it('se il cambio di stato fallisce la finestra resta aperta con l’errore', async () => {
    const { changeStatus, user } = setup();
    changeStatus.mockResolvedValue({
      ok: false,
      errors: { form: 'Questo passaggio di stato non è consentito.' },
    });
    await clickBar(user, MARCO);
    await user.click(screen.getByRole('button', { name: 'Registra arrivo' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è consentito/);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Arrivo registrato/)).toBeNull();
  });
});

describe('modifica', () => {
  it('dal dettaglio "Modifica" apre il modulo con i dati, con il focus sull’intestatario', async () => {
    const { user } = setup();
    await clickBar(user, MARCO);
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    expect(screen.queryByRole('dialog', { name: 'Prenotazione di Marco Bianchi' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Modifica prenotazione' })).toBeTruthy();
    expect(screen.getByLabelText('Intestatario').value).toBe('Marco Bianchi');
    expect(screen.getByLabelText('Camera').value).toBe('r101');
    expect(document.activeElement).toBe(screen.getByLabelText('Intestatario'));
  });

  it('salva le modifiche sulla prenotazione giusta e conferma', async () => {
    const { updateBooking, user } = setup();
    await clickBar(user, MARCO);
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: '2026-10-09' } });
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));

    expect(updateBooking).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        checkIn: '2026-10-06',
        checkOut: '2026-10-09',
        guestName: 'Marco Bianchi',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe(
      'Prenotazione di Marco Bianchi aggiornata.'
    );
  });

  it('chiudendo il modulo il focus torna alla barra da cui si è partiti', async () => {
    const { user } = setup();
    await clickBar(user, MARCO);
    const bar = screen.getByRole('button', { name: MARCO });
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(bar);
  });
});

describe('prenotazioni annullate', () => {
  it('per default non si vedono', () => {
    setup();
    expect(screen.queryByText('Gianni Annullato')).toBeNull();
    expect(screen.getByLabelText('Mostra annullate').checked).toBe(false);
  });

  it('con "Mostra annullate" compaiono, anche nella legenda, e si possono nascondere di nuovo', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Mostra annullate'));
    expect(screen.getByText('Gianni Annullato')).toBeTruthy();
    expect(screen.getByText('Annullata')).toBeTruthy();
    await user.click(screen.getByLabelText('Mostra annullate'));
    expect(screen.queryByText('Gianni Annullato')).toBeNull();
  });

  it('una prenotazione annullata si può solo eliminare, dopo conferma', async () => {
    const { removeBooking, changeStatus, user } = setup();
    await user.click(screen.getByLabelText('Mostra annullate'));
    await clickBar(user, /Gianni Annullato.*Annullata/);
    const dialog = screen.getByRole('dialog', { name: 'Prenotazione di Gianni Annullato' });
    expect(within(dialog).queryByRole('button', { name: 'Modifica' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Registra/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(removeBooking).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sì, elimina' }));
    expect(removeBooking).toHaveBeenCalledWith('b3');
    expect(changeStatus).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe(
      'Prenotazione di Gianni Annullato eliminata.'
    );
  });
});

describe('finestra di dialogo', () => {
  it('si chiude con Esc, con Annulla, con la X e con un clic sullo sfondo', async () => {
    const { user } = setup();

    await openFromHeader(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await openFromHeader(user);
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await openFromHeader(user);
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await openFromHeader(user);
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un clic dentro la finestra non la chiude', async () => {
    const { user } = setup();
    await openFromHeader(user);
    fireEvent.mouseDown(screen.getByLabelText('Intestatario'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('chiudendo senza salvare non scrive nulla', async () => {
    const { createBooking, updateBooking, changeStatus, removeBooking, user } = setup();
    await openFromHeader(user);
    await user.keyboard('{Escape}');
    await clickBar(user, MARCO);
    await user.keyboard('{Escape}');
    for (const fn of [createBooking, updateBooking, changeStatus, removeBooking]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('il focus non esce: Tab dall’ultimo elemento torna al primo e Maiusc+Tab al contrario', async () => {
    const { user } = setup();
    await openFromHeader(user);
    const close = screen.getByRole('button', { name: 'Chiudi' });
    const submit = screen.getByRole('button', { name: 'Crea prenotazione' });

    submit.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(submit);
  });

  it('alla chiusura il focus torna al pulsante che l’ha aperta', async () => {
    const { user } = setup();
    await openFromHeader(user);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nuova prenotazione' }));
  });

  it('la pagina sotto non scorre mentre la finestra è aperta', async () => {
    const { user } = setup();
    expect(document.body.style.overflow).toBe('');
    await openFromHeader(user);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('cruscotto di oggi', () => {
  it('mostra i numeri e le schede di oggi sopra il calendario', () => {
    setup();
    const board = screen.getByRole('region', { name: 'Oggi · 5 ott' });
    expect(within(board).getByText('Occupate stanotte').parentElement.textContent).toBe(
      'Occupate stanotte1 su 2'
    );
    expect(within(board).getByText('Occupazione').parentElement.textContent).toBe('Occupazione50%');
    expect(within(board).getByText('Ospite Arrivato', { selector: 'strong' })).toBeTruthy();
  });

  it('resta su oggi anche quando il calendario mostra un’altra settimana', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settimana successiva' }));
    expect(screen.getByRole('heading', { name: '12 ott – 18 ott 2026' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Oggi · 5 ott' })).toBeTruthy();
    expect(useBookings).toHaveBeenCalledWith(true, '2026-10-05', rooms, '2026-10-05');
    expect(useBookings).toHaveBeenCalledWith(true, '2026-10-12', rooms, '2026-10-05');
  });

  it('dopo un salvataggio o un cambio di stato rilegge i dati di oggi', async () => {
    const { reload, user } = setup();
    expect(reload).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    await clickBar(user, MARCO);
    await user.click(screen.getByRole('button', { name: 'Registra arrivo' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it('se il salvataggio non riesce, o si chiude la finestra, non rilegge', async () => {
    const { createBooking, reload, user } = setup();
    createBooking.mockResolvedValue({ ok: false, errors: { roomId: 'Camera occupata.' } });
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(await screen.findByText('Camera occupata.')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('gestione camere', () => {
  const goToRooms = (user) => user.click(screen.getByRole('button', { name: 'Gestione camere' }));

  it('il pulsante in alto mostra le camere al posto di cruscotto e calendario', async () => {
    const { user } = setup();
    expect(screen.getByRole('region', { name: 'Calendario delle prenotazioni' })).toBeTruthy();
    await goToRooms(user);
    expect(screen.getByRole('heading', { name: 'Gestione camere' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Elenco delle camere' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Calendario delle prenotazioni' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Oggi · 5 ott' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nuova prenotazione' })).toBeNull();
  });

  it('si torna alle prenotazioni sulla stessa settimana', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settimana successiva' }));
    await goToRooms(user);
    await user.click(screen.getByRole('button', { name: 'Torna alle prenotazioni' }));
    expect(screen.getByRole('heading', { name: '12 ott – 18 ott 2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nuova prenotazione' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Oggi · 5 ott' })).toBeTruthy();
  });

  it('cambiando vista scompare la conferma di una prenotazione', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Camera 101, 9 ott: nuova prenotazione'));
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/creata/));
    await goToRooms(user);
    expect(screen.queryByText(/Prenotazione creata/)).toBeNull();
  });

  it('aggiungere una camera usa useRooms', async () => {
    const { addRoom, user } = setup();
    await goToRooms(user);
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.type(screen.getByLabelText('Nome o numero'), '109');
    await user.type(screen.getByLabelText('Prezzo per notte (€)'), '90');
    await user.click(screen.getByRole('button', { name: 'Aggiungi camera' }));
    expect(addRoom).toHaveBeenCalledWith({
      name: '109',
      type: 'standard',
      capacity: 2,
      pricePerNight: 90,
      active: true,
    });
    expect(await screen.findByText('Camera 109 aggiunta.')).toBeTruthy();
  });

  it('fuori servizio ed eliminazione usano useRooms', async () => {
    const { updateRoom, removeRoom, user } = setup();
    await goToRooms(user);
    await user.click(screen.getByRole('button', { name: 'Metti fuori servizio la camera 101' }));
    expect(updateRoom).toHaveBeenCalledWith('r101', expect.objectContaining({ active: false }));
    await user.click(screen.getByRole('button', { name: 'Elimina camera 102' }));
    await user.click(screen.getByRole('button', { name: 'Sì, elimina' }));
    expect(removeRoom).toHaveBeenCalledWith('r102');
  });
});

describe('footer della demo', () => {
  it('con l’account demo spiega che la data è fissa e a quale giorno', () => {
    setup();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toMatch(/Modalità demo/);
    expect(footer.textContent).toMatch(/fissata a lunedì 5 ottobre 2026/);
    expect(footer.textContent).toMatch(/pulsante “Oggi”/);
    expect(footer.textContent).toMatch(/dati sono di esempio/);
  });

  it('con l’account del personale non compare', () => {
    setup({ user: { email: 'staff@example.com' }, isDemo: false });
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(screen.queryByText(/Modalità demo/)).toBeNull();
  });

  it('resta visibile anche nella gestione delle camere', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Gestione camere' }));
    expect(screen.getByRole('contentinfo').textContent).toMatch(/Modalità demo/);
  });

  it('il pulsante "Oggi" del calendario riporta alla data indicata nel footer', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settimana successiva' }));
    expect(screen.getByRole('heading', { name: '12 ott – 18 ott 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Oggi' }));
    expect(screen.getByRole('heading', { name: '5 ott – 11 ott 2026' })).toBeTruthy();
  });
});
