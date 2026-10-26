import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from './Modal.jsx';
import { ROOM_TYPES, groupRoomsByType } from '../utils/calendarUtils.js';

const euro = (n) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

const INPUT =
  'mt-1 w-full rounded-lg border border-ink/60 bg-card px-3 py-2 focus:ring-2 focus:ring-clay focus:outline-none aria-invalid:border-red-700';
const PRIMARY =
  'rounded-full bg-ink px-5 py-2 font-bold text-sand focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60';
const SECONDARY =
  'rounded-full border-2 border-ink px-5 py-2 font-bold focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60';
const DANGER =
  'rounded-full border-2 border-red-700 px-5 py-2 font-bold text-red-800 focus:ring-4 focus:ring-red-700 focus:outline-none disabled:opacity-60';
const SMALL =
  'rounded-full border border-ink/60 px-3 py-1 text-sm font-bold focus:ring-2 focus:ring-clay focus:outline-none disabled:opacity-60';
const SMALL_DANGER =
  'rounded-full border border-red-700 px-3 py-1 text-sm font-bold text-red-800 focus:ring-2 focus:ring-red-700 focus:outline-none disabled:opacity-60';

// Ordine in cui si porta il focus sul primo campo con un errore.
const FIELD_ORDER = ['name', 'type', 'capacity', 'pricePerNight', 'active'];

const firstMessage = (errors) =>
  errors.form ?? Object.values(errors)[0] ?? 'Operazione non riuscita.';

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// Modulo per creare (room assente) o modificare una camera.
// onSubmit(input) restituisce { ok, errors } come useRooms.
function RoomForm({ room, onSubmit, onCancel }) {
  const uid = useId();
  const [values, setValues] = useState({
    name: room?.name ?? '',
    type: room?.type ?? 'standard',
    capacity: String(room?.capacity ?? 2),
    pricePerNight: room ? String(room.pricePerNight) : '',
    active: room ? room.active : true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const idOf = (name) => `${uid}-${name}`;
  const change = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };
  const bind = (name) => ({
    id: idOf(name),
    onChange: (event) => change(name, event.target.value),
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${idOf(name)}-error` : undefined,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const result = await onSubmit({
      name: values.name,
      type: values.type,
      capacity: values.capacity === '' ? NaN : Number(values.capacity),
      pricePerNight: values.pricePerNight === '' ? NaN : Number(values.pricePerNight),
      active: values.active,
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors);
      const firstInvalid = FIELD_ORDER.find((name) => result.errors[name]);
      if (firstInvalid) document.getElementById(idOf(firstInvalid))?.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
      {errors.form && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
          {errors.form}
        </p>
      )}

      <Field id={idOf('name')} label="Nome o numero" error={errors.name}>
        <input
          type="text"
          autoComplete="off"
          {...bind('name')}
          value={values.name}
          data-autofocus=""
          className={INPUT}
        />
      </Field>

      <Field id={idOf('type')} label="Tipologia" error={errors.type}>
        <select {...bind('type')} value={values.type} className={INPUT}>
          {ROOM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id={idOf('capacity')} label="Capienza (persone)" error={errors.capacity}>
          <input
            type="number"
            inputMode="numeric"
            {...bind('capacity')}
            value={values.capacity}
            className={INPUT}
          />
        </Field>
        <Field id={idOf('pricePerNight')} label="Prezzo per notte (€)" error={errors.pricePerNight}>
          <input
            type="number"
            inputMode="numeric"
            {...bind('pricePerNight')}
            value={values.pricePerNight}
            className={INPUT}
          />
        </Field>
      </div>

      <div>
        <label className="flex items-center gap-2 font-bold">
          <input
            type="checkbox"
            id={idOf('active')}
            checked={values.active}
            aria-invalid={errors.active ? 'true' : undefined}
            aria-describedby={errors.active ? `${idOf('active')}-error` : undefined}
            onChange={(event) => change('active', event.target.checked)}
            className="size-4 accent-clay"
          />
          Camera in servizio
        </label>
        {errors.active && (
          <p id={`${idOf('active')}-error`} className="mt-1 text-sm text-red-700">
            {errors.active}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={SECONDARY}>
          Annulla
        </button>
        <button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? 'Salvataggio...' : room ? 'Salva modifiche' : 'Aggiungi camera'}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ room, onConfirm, onCancel }) {
  const questionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await onConfirm();
    if (!result.ok) setError(firstMessage(result.errors));
    setBusy(false);
  };

  return (
    <div className="mt-4">
      <p id={questionId}>
        Eliminare definitivamente la camera <strong>{room.name}</strong>? L’operazione non si può
        annullare, e non è possibile se la camera ha delle prenotazioni.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          data-autofocus=""
          disabled={busy}
          aria-describedby={questionId}
          onClick={onCancel}
          className={SECONDARY}
        >
          No, torna indietro
        </button>
        <button type="button" disabled={busy} onClick={confirm} className={DANGER}>
          Sì, elimina
        </button>
      </div>
    </div>
  );
}

// Elenco delle camere con aggiunta, modifica, fuori servizio ed eliminazione.
// Riceve tutto dalle props: onAdd(input), onUpdate(id, input) e onRemove(id) restituiscono
// { ok, errors } come useRooms, che fa anche i controlli sulle prenotazioni.
export default function RoomManager({ rooms, onAdd, onUpdate, onRemove }) {
  const headingId = useId();
  const [dialog, setDialog] = useState(null); // null | { type: 'form', room? } | { type: 'delete', room }
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const sorted = groupRoomsByType(rooms).flatMap((group) =>
    group.rooms.map((room) => ({ room, typeLabel: group.label }))
  );

  const openDialog = (next) => {
    setNotice(null);
    setError(null);
    setDialog(next);
  };

  const handleSubmit = async (input) => {
    const editing = dialog.room;
    const result = editing ? await onUpdate(editing.id, input) : await onAdd(input);
    if (result.ok) {
      setNotice(
        editing ? `Camera ${result.room.name} aggiornata.` : `Camera ${result.room.name} aggiunta.`
      );
      setDialog(null);
    }
    return result;
  };

  const handleDelete = async () => {
    const { room } = dialog;
    const result = await onRemove(room.id);
    if (result.ok) {
      setNotice(`Camera ${room.name} eliminata.`);
      // Il pulsante premuto sparisce con la riga: il focus passa al titolo della pagina.
      document.getElementById(headingId)?.focus();
      setDialog(null);
    }
    return result;
  };

  const toggleService = async (room) => {
    setNotice(null);
    setError(null);
    setBusyId(room.id);
    const result = await onUpdate(room.id, {
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      pricePerNight: room.pricePerNight,
      active: !room.active,
    });
    setBusyId(null);
    if (result.ok) {
      setNotice(
        room.active
          ? `Camera ${room.name} messa fuori servizio.`
          : `Camera ${room.name} rimessa in servizio.`
      );
    } else {
      setError(firstMessage(result.errors));
    }
  };

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} tabIndex={-1} className="font-display text-2xl font-bold">
          Gestione camere
        </h2>
        <button
          type="button"
          onClick={() => openDialog({ type: 'form' })}
          className={`${PRIMARY} flex items-center gap-2`}
        >
          <Plus size={18} aria-hidden="true" />
          Nuova camera
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-3 font-bold text-clay">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      {rooms.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-ink/80 shadow-sm">
          Non ci sono ancora camere. Aggiungi la prima con “Nuova camera”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Elenco delle camere</caption>
            <thead className="bg-section text-xs text-ink/70 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Camera
                </th>
                <th scope="col" className="px-3 py-2">
                  Tipologia
                </th>
                <th scope="col" className="px-3 py-2">
                  Capienza
                </th>
                <th scope="col" className="px-3 py-2">
                  Prezzo per notte
                </th>
                <th scope="col" className="px-3 py-2">
                  Stato
                </th>
                <th scope="col" className="px-3 py-2">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ room, typeLabel }) => (
                <tr key={room.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 font-bold">
                    {room.name}
                  </th>
                  <td className="px-3 py-2">{typeLabel}</td>
                  <td className="px-3 py-2">
                    {room.capacity} {room.capacity === 1 ? 'persona' : 'persone'}
                  </td>
                  <td className="px-3 py-2">{euro(room.pricePerNight)}</td>
                  <td className="px-3 py-2">{room.active ? 'In servizio' : 'Fuori servizio'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`Modifica camera ${room.name}`}
                        onClick={() => openDialog({ type: 'form', room })}
                        className={SMALL}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        aria-label={
                          room.active
                            ? `Metti fuori servizio la camera ${room.name}`
                            : `Rimetti in servizio la camera ${room.name}`
                        }
                        disabled={busyId === room.id}
                        onClick={() => toggleService(room)}
                        className={SMALL}
                      >
                        {room.active ? 'Metti fuori servizio' : 'Rimetti in servizio'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Elimina camera ${room.name}`}
                        onClick={() => openDialog({ type: 'delete', room })}
                        className={SMALL_DANGER}
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <Modal
          title={
            dialog.type === 'delete'
              ? `Elimina camera ${dialog.room.name}`
              : dialog.room
                ? `Modifica camera ${dialog.room.name}`
                : 'Nuova camera'
          }
          onClose={() => setDialog(null)}
        >
          {dialog.type === 'delete' ? (
            <DeleteConfirm
              room={dialog.room}
              onConfirm={handleDelete}
              onCancel={() => setDialog(null)}
            />
          ) : (
            <RoomForm room={dialog.room} onSubmit={handleSubmit} onCancel={() => setDialog(null)} />
          )}
        </Modal>
      )}
    </section>
  );
}
