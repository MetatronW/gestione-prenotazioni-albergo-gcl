import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingDetail from './BookingDetail.jsx';

afterEach(cleanup);

const TODAY = '2026-10-07';
const room = {
  id: 'r101',
  name: '101',
  type: 'standard',
  capacity: 2,
  pricePerNight: 85,
  active: true,
};

const booking = (overrides) => ({
  id: 'b1',
  guestName: 'Marco Bianchi',
  phone: '333 000 1000',
  email: 'marco@example.com',
  roomId: 'r101',
  checkIn: '2026-10-06',
  checkOut: '2026-10-09',
  guestsCount: 2,
  nights: 3,
  pricePerNight: 80,
  total: 240,
  status: 'booked',
  notes: 'Colazione in camera',
  ...overrides,
});

// Un soggiorno già finito a TODAY.
const FINISHED = { checkIn: '2026-10-04', checkOut: '2026-10-06', nights: 2 };

function setup(overrides = {}, props = {}) {
  const handlers = {
    onChangeStatus: vi.fn().mockResolvedValue({ ok: true }),
    onEdit: vi.fn(),
    onDelete: vi.fn().mockResolvedValue({ ok: true }),
  };
  render(
    <BookingDetail
      booking={booking(overrides)}
      room={room}
      today={TODAY}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, user: userEvent.setup() };
}

const buttonNames = () => screen.queryAllByRole('button').map((b) => b.textContent);

describe('dati', () => {
  it('mostra tutti i dati della prenotazione', () => {
    setup();
    const text = document.body.textContent;
    expect(text).toMatch(/StatoPrenotata/);
    expect(text).toMatch(/Camera101/);
    expect(text).toMatch(/Check-inMar 6 ott 2026/);
    expect(text).toMatch(/Check-outVen 9 ott 2026/);
    expect(text).toMatch(/Notti3 notti × 80\s€/);
    expect(text).toMatch(/Totale240\s€/);
    expect(text).toMatch(/Persone2/);
    expect(text).toMatch(/Telefono333 000 1000/);
    expect(text).toMatch(/NoteColazione in camera/);
    expect(screen.getByRole('link', { name: 'marco@example.com' }).getAttribute('href')).toBe(
      'mailto:marco@example.com'
    );
  });
  it('omette email e note se vuote', () => {
    setup({ email: '', notes: '' });
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('Note')).toBeNull();
  });
  it('usa il singolare per una notte', () => {
    setup({ nights: 1, checkOut: '2026-10-07', total: 80 });
    expect(document.body.textContent).toMatch(/1 notte × 80/);
  });
  it('se la camera non è disponibile mostra un trattino', () => {
    render(
      <BookingDetail
        booking={booking()}
        room={undefined}
        today={TODAY}
        onChangeStatus={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(document.body.textContent).toMatch(/Camera—/);
  });
});

describe('azioni per stato', () => {
  it('prenotata: registra arrivo, modifica, annulla', () => {
    setup({ status: 'booked' });
    expect(buttonNames()).toEqual(['Registra arrivo', 'Modifica', 'Annulla prenotazione']);
  });
  it('arrivato: solo modifica, la partenza si gestisce con il check-out', () => {
    setup({ status: 'checkedIn' });
    expect(buttonNames()).toEqual(['Modifica']);
    expect(document.body.textContent).toMatch(/StatoArrivato/);
  });
  it('non esiste "Registra partenza" in nessuno stato', () => {
    for (const status of ['booked', 'checkedIn', 'cancelled']) {
      setup({ status });
      expect(screen.queryByRole('button', { name: /partenza/i })).toBeNull();
      cleanup();
    }
  });
  it('il giorno del check-out la prenotazione è ancora aperta', () => {
    setup({ status: 'checkedIn', checkOut: TODAY });
    expect(buttonNames()).toEqual(['Modifica']);
    expect(document.body.textContent).toMatch(/StatoArrivato/);
  });
  it('dal giorno dopo il check-out è "Partito": sola lettura, nessuna azione', () => {
    setup({ status: 'checkedIn', ...FINISHED });
    expect(buttonNames()).toEqual([]);
    expect(document.body.textContent).toMatch(/StatoPartito/);
  });
  it('anche una prenotazione mai arrivata, con il check-out passato, è "Partito"', () => {
    setup({ status: 'booked', ...FINISHED });
    expect(buttonNames()).toEqual([]);
    expect(document.body.textContent).toMatch(/StatoPartito/);
  });
  it('annullata: si può solo eliminare, anche se le date sono passate', () => {
    setup({ status: 'cancelled' });
    expect(buttonNames()).toEqual(['Elimina']);
    cleanup();
    setup({ status: 'cancelled', ...FINISHED });
    expect(buttonNames()).toEqual(['Elimina']);
    expect(document.body.textContent).toMatch(/StatoAnnullata/);
  });
});

describe('azioni semplici', () => {
  it('registra l’arrivo con il passaggio di stato giusto', async () => {
    const { onChangeStatus, user } = setup({ status: 'booked' });
    await user.click(screen.getByRole('button', { name: 'Registra arrivo' }));
    expect(onChangeStatus).toHaveBeenCalledTimes(1);
    expect(onChangeStatus).toHaveBeenCalledWith('checkedIn');
  });
  it('"Modifica" chiama onEdit senza altre scritture', async () => {
    const { onEdit, onChangeStatus, onDelete, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('annullare', () => {
  it('chiede conferma prima di annullare, con il focus sulla scelta sicura', async () => {
    const { onChangeStatus, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));
    expect(onChangeStatus).not.toHaveBeenCalled();
    const question = screen.getByText(/Annullare la prenotazione di/);
    expect(question.textContent).toMatch(/Marco Bianchi.*camera tornerà libera/);
    const back = screen.getByRole('button', { name: 'No, torna indietro' });
    expect(document.activeElement).toBe(back);
    expect(back.getAttribute('aria-describedby')).toBe(question.id);
    expect(
      screen.getByRole('button', { name: 'Annulla prenotazione' }).getAttribute('aria-expanded')
    ).toBe('true');
  });
  it('"No, torna indietro" non scrive nulla e riporta il focus sul pulsante', async () => {
    const { onChangeStatus, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));
    await user.click(screen.getByRole('button', { name: 'No, torna indietro' }));
    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(screen.queryByText(/Annullare la prenotazione di/)).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Annulla prenotazione' })
    );
  });
  it('dopo la conferma annulla la prenotazione', async () => {
    const { onChangeStatus, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));
    await user.click(screen.getByRole('button', { name: 'Sì, annulla la prenotazione' }));
    expect(onChangeStatus).toHaveBeenCalledTimes(1);
    expect(onChangeStatus).toHaveBeenCalledWith('cancelled');
  });
});

describe('eliminare', () => {
  it('chiede conferma e avverte che non si torna indietro', async () => {
    const { onDelete, user } = setup({ status: 'cancelled' });
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/Eliminare definitivamente/).textContent).toMatch(
      /non si può annullare/
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'No, torna indietro' }));
  });
  it('"No, torna indietro" non elimina e riporta il focus su "Elimina"', async () => {
    const { onDelete, user } = setup({ status: 'cancelled' });
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    await user.click(screen.getByRole('button', { name: 'No, torna indietro' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elimina' }));
  });
  it('dopo la conferma elimina', async () => {
    const { onDelete, onChangeStatus, user } = setup({ status: 'cancelled' });
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    await user.click(screen.getByRole('button', { name: 'Sì, elimina' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onChangeStatus).not.toHaveBeenCalled();
  });
});

describe('errori e attesa', () => {
  it('mostra l’errore, chiude la conferma e riabilita i pulsanti', async () => {
    const onChangeStatus = vi
      .fn()
      .mockResolvedValue({ ok: false, errors: { form: 'Operazione non riuscita.' } });
    const { user } = setup({}, { onChangeStatus });
    await user.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));
    await user.click(screen.getByRole('button', { name: 'Sì, annulla la prenotazione' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Operazione non riuscita.');
    expect(screen.queryByText(/Annullare la prenotazione di/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Registra arrivo' }).disabled).toBe(false);
  });
  it('senza messaggio specifico ne usa uno generico', async () => {
    const onChangeStatus = vi.fn().mockResolvedValue({ ok: false, errors: {} });
    const { user } = setup({}, { onChangeStatus });
    await user.click(screen.getByRole('button', { name: 'Registra arrivo' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/non riuscita/);
  });
  it('blocca tutti i pulsanti mentre l’operazione è in corso', async () => {
    let finish;
    const onChangeStatus = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { user } = setup({}, { onChangeStatus });
    await user.click(screen.getByRole('button', { name: 'Registra arrivo' }));
    for (const b of screen.getAllByRole('button')) expect(b.disabled).toBe(true);
    await act(async () => finish({ ok: false, errors: { form: 'Errore.' } }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Registra arrivo' }).disabled).toBe(false)
    );
  });
});
