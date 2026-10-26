import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingForm from './BookingForm.jsx';

afterEach(cleanup);

const rooms = [
  { id: 'r101', name: '101', type: 'standard', capacity: 2, pricePerNight: 85, active: true },
  { id: 'r102', name: '102', type: 'standard', capacity: 3, pricePerNight: 95, active: true },
  { id: 'r204', name: '204', type: 'superior', capacity: 2, pricePerNight: 120, active: false },
];

const existing = {
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
};

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue({ ok: true });
  const onCancel = vi.fn();
  render(<BookingForm rooms={rooms} onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { onSubmit, onCancel, user: userEvent.setup() };
}

const setDate = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('creazione', () => {
  it('parte dai valori ricevuti: camera, date e due persone', () => {
    setup({ initial: { roomId: 'r102', checkIn: '2026-10-07', checkOut: '2026-10-08' } });
    expect(screen.getByLabelText('Camera').value).toBe('r102');
    expect(screen.getByLabelText('Check-in').value).toBe('2026-10-07');
    expect(screen.getByLabelText('Check-out').value).toBe('2026-10-08');
    expect(screen.getByLabelText('Numero di persone').value).toBe('2');
    expect(screen.getByLabelText('Intestatario').value).toBe('');
    expect(screen.getByRole('button', { name: 'Crea prenotazione' })).toBeTruthy();
  });

  it('offre solo le camere attive, raggruppate per tipologia', () => {
    setup();
    const labels = [...screen.getByLabelText('Camera').querySelectorAll('option')].map(
      (o) => o.textContent
    );
    expect(labels).toHaveLength(3);
    expect(labels[1]).toMatch(/^101 · 2 pers\. · 85\s€\/notte$/);
    expect(labels.join('')).not.toMatch(/204/);
    expect(screen.getByLabelText('Camera').querySelectorAll('optgroup')).toHaveLength(1);
  });

  it('manda i valori digitati, con le persone come numero', async () => {
    const { onSubmit, user } = setup({
      initial: { roomId: 'r101', checkIn: '2026-10-10', checkOut: '2026-10-12' },
    });
    await user.type(screen.getByLabelText('Intestatario'), 'Anna Verdi');
    await user.type(screen.getByLabelText('Telefono'), '333 000 2000');
    await user.type(screen.getByLabelText('Note (facoltative)'), 'Arrivo in serata');
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(onSubmit).toHaveBeenCalledWith({
      roomId: 'r101',
      checkIn: '2026-10-10',
      checkOut: '2026-10-12',
      guestsCount: 2,
      guestName: 'Anna Verdi',
      phone: '333 000 2000',
      email: '',
      notes: 'Arrivo in serata',
    });
  });

  it('le persone vuote arrivano come NaN, per far rispondere i controlli', async () => {
    const { onSubmit, user } = setup();
    await user.clear(screen.getByLabelText('Numero di persone'));
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(Number.isNaN(onSubmit.mock.calls[0][0].guestsCount)).toBe(true);
  });

  it('non blocca l’invio con i controlli del browser: i messaggi sono quelli dell’app', async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('annulla senza inviare', async () => {
    const { onSubmit, onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('anteprima di notti e totale', () => {
  it('calcola le notti con la tariffa della camera', () => {
    setup({ initial: { roomId: 'r101', checkIn: '2026-10-10', checkOut: '2026-10-12' } });
    expect(screen.getByText(/2 notti/).textContent).toMatch(/2 notti × 85\s€ = 170\s€/);
  });
  it('usa "notte" al singolare e si aggiorna con le date', () => {
    setup({ initial: { roomId: 'r101', checkIn: '2026-10-10', checkOut: '2026-10-12' } });
    setDate('Check-out', '2026-10-11');
    expect(screen.getByText(/1 notte/).textContent).toMatch(/1 notte × 85\s€ = 85\s€/);
  });
  it('non compare senza camera o con date non valide', () => {
    setup({ initial: { checkIn: '2026-10-10', checkOut: '2026-10-12' } });
    expect(screen.queryByText(/notti/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Camera'), { target: { value: 'r101' } });
    expect(screen.getByText(/2 notti/)).toBeTruthy();
    setDate('Check-out', '2026-10-10');
    expect(screen.queryByText(/notti? ×/)).toBeNull();
  });
});

describe('errori', () => {
  it('mostra ogni errore accanto al suo campo e porta il focus sul primo', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      errors: {
        guestName: 'Inserisci il nome dell’intestatario.',
        checkOut: 'Il check-out deve essere dopo il check-in.',
        roomId: 'La camera 101 è occupata dal 9 ott al 12 ott.',
      },
    });
    const { user } = setup({ onSubmit });
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));

    const room = screen.getByLabelText('Camera');
    expect(room.getAttribute('aria-invalid')).toBe('true');
    expect(room.getAttribute('aria-describedby')).toBe(`${room.id}-error`);
    expect(document.getElementById(`${room.id}-error`).textContent).toMatch(/occupata dal 9 ott/);
    expect(screen.getByLabelText('Check-out').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Intestatario').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Telefono').getAttribute('aria-invalid')).toBeNull();
    expect(document.activeElement).toBe(room);
  });

  it('l’errore di un campo sparisce quando lo si modifica', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: false, errors: { guestName: 'Inserisci il nome.' } });
    const { user } = setup({ onSubmit });
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(screen.getByText('Inserisci il nome.')).toBeTruthy();
    await user.type(screen.getByLabelText('Intestatario'), 'A');
    expect(screen.queryByText('Inserisci il nome.')).toBeNull();
    expect(screen.getByLabelText('Intestatario').getAttribute('aria-invalid')).toBeNull();
  });

  it('un errore generale compare come avviso', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: false, errors: { form: 'Operazione non riuscita.' } });
    const { user } = setup({ onSubmit });
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(screen.getByRole('alert').textContent).toBe('Operazione non riuscita.');
  });
});

describe('invio in corso', () => {
  it('disabilita il pulsante finché la risposta non arriva', async () => {
    let finish;
    const onSubmit = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { user } = setup({ onSubmit });
    await user.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(screen.getByRole('button', { name: 'Salvataggio...' }).disabled).toBe(true);
    await act(async () => finish({ ok: false, errors: { form: 'Errore.' } }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Crea prenotazione' }).disabled).toBe(false)
    );
  });
});

describe('modifica', () => {
  it('parte dai dati della prenotazione', () => {
    setup({ booking: existing });
    expect(screen.getByLabelText('Intestatario').value).toBe('Marco Bianchi');
    expect(screen.getByLabelText('Telefono').value).toBe('333 000 1000');
    expect(screen.getByLabelText('Email (facoltativa)').value).toBe('marco@example.com');
    expect(screen.getByLabelText('Camera').value).toBe('r101');
    expect(screen.getByLabelText('Check-in').value).toBe('2026-10-06');
    expect(screen.getByLabelText('Note (facoltative)').value).toBe('Colazione in camera');
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeTruthy();
  });

  it('mantiene la tariffa bloccata nella stessa camera e usa quella nuova se si cambia camera', () => {
    setup({ booking: existing });
    expect(screen.getByText(/3 notti/).textContent).toMatch(/3 notti × 80\s€ = 240\s€/);
    fireEvent.change(screen.getByLabelText('Camera'), { target: { value: 'r102' } });
    expect(screen.getByText(/3 notti/).textContent).toMatch(/3 notti × 95\s€ = 285\s€/);
    fireEvent.change(screen.getByLabelText('Camera'), { target: { value: 'r101' } });
    expect(screen.getByText(/3 notti/).textContent).toMatch(/× 80\s€ = 240\s€/);
  });

  it('dopo l’arrivo il check-in è bloccato e lo si spiega', () => {
    setup({ booking: { ...existing, status: 'checkedIn' } });
    expect(screen.getByLabelText('Check-in').disabled).toBe(true);
    expect(screen.getByText('Dopo l’arrivo il check-in non si può cambiare.')).toBeTruthy();
    expect(screen.getByLabelText('Check-out').disabled).toBe(false);
  });

  it('prima dell’arrivo il check-in si può cambiare', () => {
    setup({ booking: existing });
    expect(screen.getByLabelText('Check-in').disabled).toBe(false);
  });

  it('la camera attuale resta scelta anche se nel frattempo è fuori servizio', () => {
    setup({ booking: { ...existing, roomId: 'r204' } });
    const select = screen.getByLabelText('Camera');
    expect(select.value).toBe('r204');
    expect(select.querySelector('option[value="r204"]').textContent).toMatch(/fuori servizio/);
  });

  it('invia i dati modificati', async () => {
    const { onSubmit, user } = setup({ booking: existing });
    setDate('Check-out', '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r101',
        checkIn: '2026-10-06',
        checkOut: '2026-10-10',
        guestsCount: 2,
      })
    );
  });
});
