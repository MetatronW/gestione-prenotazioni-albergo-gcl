import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import RoomManager from './RoomManager.jsx';

afterEach(cleanup);

const rooms = [
  { id: 'r301', name: '301', type: 'suite', capacity: 4, pricePerNight: 190, active: true },
  { id: 'r204', name: '204', type: 'superior', capacity: 2, pricePerNight: 120, active: false },
  { id: 'r102', name: '102', type: 'standard', capacity: 3, pricePerNight: 95, active: true },
  { id: 'r101', name: '101', type: 'standard', capacity: 1, pricePerNight: 85, active: true },
];

function setup(props = {}) {
  const handlers = {
    onAdd: vi
      .fn()
      .mockImplementation(async (input) => ({ ok: true, room: { id: 'nuova', ...input } })),
    onUpdate: vi
      .fn()
      .mockImplementation(async (id, input) => ({ ok: true, room: { id, ...input } })),
    onRemove: vi.fn().mockResolvedValue({ ok: true }),
  };
  render(<RoomManager rooms={rooms} {...handlers} {...props} />);
  return { ...handlers, user: userEvent.setup() };
}

const rowOf = (name) => screen.getByRole('rowheader', { name }).closest('tr');
const typeInto = async (user, label, text) => {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (text) await user.type(field, text);
};

describe('elenco', () => {
  it('mostra le camere per tipologia e per nome, con i dati a parole', () => {
    setup();
    const table = screen.getByRole('table', { name: 'Elenco delle camere' });
    const names = within(table)
      .getAllByRole('rowheader')
      .map((h) => h.textContent);
    expect(names).toEqual(['101', '102', '204', '301']);
    expect(rowOf('101').textContent).toMatch(/^101Standard1 persona85\s€In servizio/);
    expect(rowOf('102').textContent).toMatch(/Standard3 persone95\s€In servizio/);
    expect(rowOf('204').textContent).toMatch(/Superior2 persone120\s€Fuori servizio/);
    expect(rowOf('301').textContent).toMatch(/Suite4 persone190\s€In servizio/);
  });
  it('ogni pulsante dice a quale camera si riferisce', () => {
    setup();
    for (const label of [
      'Modifica camera 101',
      'Metti fuori servizio la camera 101',
      'Elimina camera 101',
      'Rimetti in servizio la camera 204',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Rimetti in servizio la camera 101' })).toBeNull();
  });
  it('senza camere spiega come aggiungerne', () => {
    setup({ rooms: [] });
    expect(screen.getByText(/Non ci sono ancora camere/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nuova camera' })).toBeTruthy();
  });
});

describe('nuova camera', () => {
  it('apre il modulo con i valori di partenza e il focus sul nome', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    expect(screen.getByRole('dialog', { name: 'Nuova camera' })).toBeTruthy();
    expect(screen.getByLabelText('Nome o numero').value).toBe('');
    expect(screen.getByLabelText('Tipologia').value).toBe('standard');
    expect(screen.getByLabelText('Capienza (persone)').value).toBe('2');
    expect(screen.getByLabelText('Prezzo per notte (€)').value).toBe('');
    expect(screen.getByLabelText('Camera in servizio').checked).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Nome o numero'));
  });

  it('manda i valori con capienza e prezzo come numeri, chiude e conferma', async () => {
    const { onAdd, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.type(screen.getByLabelText('Nome o numero'), '109');
    await user.selectOptions(screen.getByLabelText('Tipologia'), 'suite');
    await typeInto(user, 'Capienza (persone)', '4');
    await typeInto(user, 'Prezzo per notte (€)', '210');
    await user.click(screen.getByRole('button', { name: 'Aggiungi camera' }));

    expect(onAdd).toHaveBeenCalledWith({
      name: '109',
      type: 'suite',
      capacity: 4,
      pricePerNight: 210,
      active: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Camera 109 aggiunta.');
  });

  it('un campo numerico vuoto arriva come NaN, per far rispondere i controlli', async () => {
    const { onAdd, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi camera' }));
    expect(Number.isNaN(onAdd.mock.calls[0][0].pricePerNight)).toBe(true);
  });

  it('mostra gli errori accanto ai campi e porta il focus sul primo', async () => {
    const onAdd = vi.fn().mockResolvedValue({
      ok: false,
      errors: {
        name: 'Esiste già una camera chiamata 101.',
        pricePerNight: 'Il prezzo per notte è un numero intero di euro, da 1 a 10000.',
      },
    });
    const { user } = setup({ onAdd });
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi camera' }));

    const name = screen.getByLabelText('Nome o numero');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe(`${name.id}-error`);
    expect(screen.getByText('Esiste già una camera chiamata 101.')).toBeTruthy();
    expect(screen.getByLabelText('Prezzo per notte (€)').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Capienza (persone)').getAttribute('aria-invalid')).toBeNull();
    expect(document.activeElement).toBe(name);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/aggiunta/)).toBeNull();
  });

  it('l’errore di un campo sparisce quando lo si modifica', async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: false, errors: { name: 'Inserisci il nome.' } });
    const { user } = setup({ onAdd });
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi camera' }));
    expect(screen.getByText('Inserisci il nome.')).toBeTruthy();
    await user.type(screen.getByLabelText('Nome o numero'), '1');
    expect(screen.queryByText('Inserisci il nome.')).toBeNull();
  });

  it('un errore generale compare come avviso nel modulo', async () => {
    const onAdd = vi
      .fn()
      .mockResolvedValue({ ok: false, errors: { form: 'Operazione non riuscita.' } });
    const { user } = setup({ onAdd });
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi camera' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
      'Operazione non riuscita.'
    );
  });

  it('annullando non scrive nulla', async () => {
    const { onAdd, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('modifica', () => {
  it('apre il modulo con i dati della camera', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Modifica camera 102' }));
    expect(screen.getByRole('dialog', { name: 'Modifica camera 102' })).toBeTruthy();
    expect(screen.getByLabelText('Nome o numero').value).toBe('102');
    expect(screen.getByLabelText('Tipologia').value).toBe('standard');
    expect(screen.getByLabelText('Capienza (persone)').value).toBe('3');
    expect(screen.getByLabelText('Prezzo per notte (€)').value).toBe('95');
    expect(screen.getByLabelText('Camera in servizio').checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeTruthy();
  });

  it('una camera fuori servizio si apre con la casella non spuntata', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Modifica camera 204' }));
    expect(screen.getByLabelText('Camera in servizio').checked).toBe(false);
  });

  it('salva sulla camera giusta e conferma', async () => {
    const { onUpdate, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Modifica camera 102' }));
    await typeInto(user, 'Prezzo per notte (€)', '99');
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));

    expect(onUpdate).toHaveBeenCalledWith('r102', {
      name: '102',
      type: 'standard',
      capacity: 3,
      pricePerNight: 99,
      active: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Camera 102 aggiornata.');
  });

  it('se ci sono prenotazioni mostra l’errore accanto alla casella del servizio', async () => {
    const onUpdate = vi.fn().mockResolvedValue({
      ok: false,
      errors: { active: 'La camera ha 1 prenotazione in corso o future: spostale prima.' },
    });
    const { user } = setup({ onUpdate });
    await user.click(screen.getByRole('button', { name: 'Modifica camera 101' }));
    await user.click(screen.getByLabelText('Camera in servizio'));
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));

    expect(screen.getByText(/1 prenotazione in corso o future/)).toBeTruthy();
    expect(screen.getByLabelText('Camera in servizio').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Camera in servizio'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('blocca il pulsante mentre salva', async () => {
    let finish;
    const onUpdate = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { user } = setup({ onUpdate });
    await user.click(screen.getByRole('button', { name: 'Modifica camera 101' }));
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(screen.getByRole('button', { name: 'Salvataggio...' }).disabled).toBe(true);
    await act(async () => finish({ ok: false, errors: { form: 'Errore.' } }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Salva modifiche' }).disabled).toBe(false)
    );
  });
});

describe('fuori servizio', () => {
  it('mette fuori servizio una camera con un solo clic, mantenendo gli altri dati', async () => {
    const { onUpdate, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Metti fuori servizio la camera 101' }));
    expect(onUpdate).toHaveBeenCalledWith('r101', {
      name: '101',
      type: 'standard',
      capacity: 1,
      pricePerNight: 85,
      active: false,
    });
    expect((await screen.findByRole('status')).textContent).toBe(
      'Camera 101 messa fuori servizio.'
    );
  });

  it('rimette in servizio una camera', async () => {
    const { onUpdate, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Rimetti in servizio la camera 204' }));
    expect(onUpdate).toHaveBeenCalledWith('r204', expect.objectContaining({ active: true }));
    expect((await screen.findByRole('status')).textContent).toBe('Camera 204 rimessa in servizio.');
  });

  it('se ci sono prenotazioni mostra il motivo e non conferma nulla', async () => {
    const onUpdate = vi.fn().mockResolvedValue({
      ok: false,
      errors: { active: 'La camera ha 2 prenotazioni in corso o future: spostale prima.' },
    });
    const { user } = setup({ onUpdate });
    await user.click(screen.getByRole('button', { name: 'Metti fuori servizio la camera 101' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /2 prenotazioni in corso o future/
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('blocca il pulsante della camera mentre salva', async () => {
    let finish;
    const onUpdate = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { user } = setup({ onUpdate });
    await user.click(screen.getByRole('button', { name: 'Metti fuori servizio la camera 101' }));
    expect(
      screen.getByRole('button', { name: 'Metti fuori servizio la camera 101' }).disabled
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Metti fuori servizio la camera 102' }).disabled
    ).toBe(false);
    await act(async () => finish({ ok: true, room: rooms[3] }));
  });
});

describe('eliminazione', () => {
  it('chiede conferma con il focus sulla scelta sicura e non scrive nulla', async () => {
    const { onRemove, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Elimina camera 101' }));
    const dialog = screen.getByRole('dialog', { name: 'Elimina camera 101' });
    expect(dialog.textContent).toMatch(/Eliminare definitivamente la camera 101/);
    expect(dialog.textContent).toMatch(/non si può annullare/);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'No, torna indietro' }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('"No, torna indietro" chiude senza eliminare', async () => {
    const { onRemove, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Elimina camera 101' }));
    await user.click(screen.getByRole('button', { name: 'No, torna indietro' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('dopo la conferma elimina e conferma a parole', async () => {
    const { onRemove, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Elimina camera 102' }));
    await user.click(screen.getByRole('button', { name: 'Sì, elimina' }));
    expect(onRemove).toHaveBeenCalledWith('r102');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Camera 102 eliminata.');
  });

  it('se la camera ha prenotazioni mostra il motivo e la finestra resta aperta', async () => {
    const onRemove = vi.fn().mockResolvedValue({
      ok: false,
      errors: {
        form: 'La camera ha delle prenotazioni: mettila fuori servizio invece di eliminarla.',
      },
    });
    const { user } = setup({ onRemove });
    await user.click(screen.getByRole('button', { name: 'Elimina camera 101' }));
    await user.click(screen.getByRole('button', { name: 'Sì, elimina' }));
    expect(await screen.findByText(/mettila fuori servizio invece di eliminarla/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sì, elimina' }).disabled).toBe(false);
    expect(screen.queryByText(/eliminata\./)).toBeNull();
  });

  it('eliminata la camera, il focus passa al titolo della pagina', async () => {
    function Harness() {
      const [list, setList] = useState(rooms);
      return (
        <RoomManager
          rooms={list}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onRemove={async (id) => {
            setList((prev) => prev.filter((r) => r.id !== id));
            return { ok: true };
          }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Elimina camera 102' }));
    await user.click(screen.getByRole('button', { name: 'Sì, elimina' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('rowheader', { name: '102' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Gestione camere' }));
  });
});

describe('finestre', () => {
  it('Esc chiude la finestra senza salvare', async () => {
    const { onAdd, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });
  it('aprire una finestra cancella la conferma precedente', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Metti fuori servizio la camera 101' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Nuova camera' }));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
