import { useId, useState } from 'react';
import { calcNights, isCheckInLocked } from '../utils/bookingUtils.js';
import { groupRoomsByType } from '../utils/calendarUtils.js';
import { isValidISODate } from '../utils/dateUtils.js';

const INPUT =
  'mt-1 w-full rounded-lg border border-ink/60 bg-card px-3 py-2 focus:ring-2 focus:ring-clay focus:outline-none disabled:bg-weekend disabled:text-ink/70 aria-invalid:border-red-700';

// Ordine in cui si porta il focus sul primo campo con un errore.
const FIELD_ORDER = [
  'roomId',
  'checkIn',
  'checkOut',
  'guestsCount',
  'guestName',
  'phone',
  'email',
  'notes',
];

const euro = (n) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink/70">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// Modulo per creare (booking assente, `initial` con i valori di partenza) o modificare una
// prenotazione. Non conosce Firebase: onSubmit(input) restituisce { ok, errors } come gli hook.
export default function BookingForm({ rooms, booking = null, initial = {}, onSubmit, onCancel }) {
  const uid = useId();
  const source = booking ?? initial;
  const [values, setValues] = useState({
    roomId: source.roomId ?? '',
    checkIn: source.checkIn ?? '',
    checkOut: source.checkOut ?? '',
    guestsCount: String(booking?.guestsCount ?? 2),
    guestName: booking?.guestName ?? '',
    phone: booking?.phone ?? '',
    email: booking?.email ?? '',
    notes: booking?.notes ?? '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const idOf = (name) => `${uid}-${name}`;
  const bind = (name) => ({
    id: idOf(name),
    value: values[name],
    onChange: (event) => {
      setValues((prev) => ({ ...prev, [name]: event.target.value }));
      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${idOf(name)}-error` : undefined,
  });

  const selectable = rooms.filter((r) => r.active || r.id === booking?.roomId);
  const room = rooms.find((r) => r.id === values.roomId);
  const lockedCheckIn = booking ? isCheckInLocked(booking.status) : false;
  const focusName = booking || initial.roomId ? 'guestName' : 'roomId';

  // Anteprima di notti e totale. In modifica la tariffa resta quella bloccata,
  // finché non si cambia camera.
  const nights =
    isValidISODate(values.checkIn) && isValidISODate(values.checkOut)
      ? calcNights(values.checkIn, values.checkOut)
      : 0;
  const price = room
    ? booking?.roomId === room.id
      ? booking.pricePerNight
      : room.pricePerNight
    : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const result = await onSubmit({
      roomId: values.roomId,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guestsCount: values.guestsCount === '' ? NaN : Number(values.guestsCount),
      guestName: values.guestName,
      phone: values.phone,
      email: values.email,
      notes: values.notes,
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

      <Field id={idOf('roomId')} label="Camera" error={errors.roomId}>
        <select
          {...bind('roomId')}
          data-autofocus={focusName === 'roomId' ? '' : undefined}
          className={INPUT}
        >
          <option value="">Scegli la camera</option>
          {groupRoomsByType(selectable).map((group) => (
            <optgroup key={group.type} label={group.label}>
              {group.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {`${r.name} · ${r.capacity} pers. · ${euro(r.pricePerNight)}/notte${r.active ? '' : ' (fuori servizio)'}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          id={idOf('checkIn')}
          label="Check-in"
          error={errors.checkIn}
          hint={lockedCheckIn ? 'Dopo l’arrivo il check-in non si può cambiare.' : undefined}
        >
          <input type="date" {...bind('checkIn')} disabled={lockedCheckIn} className={INPUT} />
        </Field>
        <Field id={idOf('checkOut')} label="Check-out" error={errors.checkOut}>
          <input type="date" {...bind('checkOut')} className={INPUT} />
        </Field>
      </div>

      <Field id={idOf('guestsCount')} label="Numero di persone" error={errors.guestsCount}>
        <input type="number" inputMode="numeric" {...bind('guestsCount')} className={INPUT} />
      </Field>

      {nights >= 1 && price !== null && (
        <p className="rounded-lg bg-paper px-3 py-2 text-sm">
          {nights} {nights === 1 ? 'notte' : 'notti'} × {euro(price)} ={' '}
          <strong>{euro(nights * price)}</strong>
        </p>
      )}

      <Field id={idOf('guestName')} label="Intestatario" error={errors.guestName}>
        <input
          type="text"
          autoComplete="off"
          {...bind('guestName')}
          data-autofocus={focusName === 'guestName' ? '' : undefined}
          className={INPUT}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id={idOf('phone')} label="Telefono" error={errors.phone}>
          <input type="tel" autoComplete="off" {...bind('phone')} className={INPUT} />
        </Field>
        <Field id={idOf('email')} label="Email (facoltativa)" error={errors.email}>
          <input type="email" autoComplete="off" {...bind('email')} className={INPUT} />
        </Field>
      </div>
      <Field id={idOf('notes')} label="Note (facoltative)" error={errors.notes}>
        <textarea rows={3} {...bind('notes')} className={INPUT} />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border-2 border-ink px-5 py-2 font-bold focus:ring-4 focus:ring-clay focus:outline-none"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-5 py-2 font-bold text-sand focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60"
        >
          {busy ? 'Salvataggio...' : booking ? 'Salva modifiche' : 'Crea prenotazione'}
        </button>
      </div>
    </form>
  );
}
