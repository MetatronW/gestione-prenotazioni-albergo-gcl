import { useId, useRef, useState } from 'react';
import {
  STATUS_LABELS,
  canDelete,
  getDisplayStatus,
  getNextStatuses,
  isEditable,
} from '../utils/bookingUtils.js';
import { formatShortDate, getWeekdayLabel } from '../utils/dateUtils.js';

const euro = (n) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
const fullDate = (iso) => `${getWeekdayLabel(iso)} ${formatShortDate(iso)} ${iso.slice(0, 4)}`;

const PRIMARY =
  'rounded-full bg-ink px-5 py-2 font-bold text-sand focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60';
const SECONDARY =
  'rounded-full border-2 border-ink px-5 py-2 font-bold focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60';
const DANGER =
  'rounded-full border-2 border-red-700 px-5 py-2 font-bold text-red-800 focus:ring-4 focus:ring-red-700 focus:outline-none disabled:opacity-60';

function Row({ label, children }) {
  return (
    <>
      <dt className="text-sm text-ink/70">{label}</dt>
      <dd className="font-bold break-words">{children}</dd>
    </>
  );
}

// Dettaglio di una prenotazione con le azioni consentite dal suo stato.
// onChangeStatus(stato) e onDelete() restituiscono { ok, errors } come gli hook;
// onEdit() apre il modulo di modifica. Annullare ed eliminare chiedono sempre conferma.
// today: la data di oggi. Un soggiorno con il check-out già passato è "Partito": sola lettura.
// La partenza non si registra: se il cliente parte prima o dopo, si modifica il check-out.
export default function BookingDetail({ booking, room, today, onChangeStatus, onEdit, onDelete }) {
  const questionId = useId();
  const cancelRef = useRef(null);
  const deleteRef = useRef(null);
  const [confirming, setConfirming] = useState(null); // null | 'cancel' | 'delete'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const next = getNextStatuses(booking, today);
  const nights = booking.nights;

  const run = async (action) => {
    setBusy(true);
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.errors.form ?? 'Operazione non riuscita. Riprova.');
      setConfirming(null);
    }
    setBusy(false);
  };

  const goBack = () => {
    const opener = confirming === 'cancel' ? cancelRef : deleteRef;
    setConfirming(null);
    opener.current?.focus();
  };

  return (
    <div className="mt-4">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2">
        <Row label="Stato">{STATUS_LABELS[getDisplayStatus(booking, today)]}</Row>
        <Row label="Camera">{room ? room.name : '—'}</Row>
        <Row label="Check-in">{fullDate(booking.checkIn)}</Row>
        <Row label="Check-out">{fullDate(booking.checkOut)}</Row>
        <Row label="Notti">
          {nights} {nights === 1 ? 'notte' : 'notti'} × {euro(booking.pricePerNight)}
        </Row>
        <Row label="Totale">{euro(booking.total)}</Row>
        <Row label="Persone">{booking.guestsCount}</Row>
        <Row label="Telefono">{booking.phone}</Row>
        {booking.email && (
          <Row label="Email">
            <a href={`mailto:${booking.email}`} className="text-clay underline">
              {booking.email}
            </a>
          </Row>
        )}
        {booking.notes && <Row label="Note">{booking.notes}</Row>}
      </dl>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {next.includes('checkedIn') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onChangeStatus('checkedIn'))}
            className={PRIMARY}
          >
            Registra arrivo
          </button>
        )}
        {isEditable(booking, today) && (
          <button type="button" disabled={busy} onClick={onEdit} className={SECONDARY}>
            Modifica
          </button>
        )}
        {next.includes('cancelled') && (
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            aria-expanded={confirming === 'cancel'}
            onClick={() => setConfirming('cancel')}
            className={DANGER}
          >
            Annulla prenotazione
          </button>
        )}
        {canDelete(booking.status) && (
          <button
            ref={deleteRef}
            type="button"
            disabled={busy}
            aria-expanded={confirming === 'delete'}
            onClick={() => setConfirming('delete')}
            className={DANGER}
          >
            Elimina
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-4 rounded-xl border-2 border-red-700 bg-red-50 p-4">
          <p id={questionId}>
            {confirming === 'cancel' ? (
              <>
                Annullare la prenotazione di <strong>{booking.guestName}</strong>? La camera tornerà
                libera.
              </>
            ) : (
              <>
                Eliminare definitivamente la prenotazione di <strong>{booking.guestName}</strong>?
                L’operazione non si può annullare.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              autoFocus
              disabled={busy}
              aria-describedby={questionId}
              onClick={goBack}
              className={SECONDARY}
            >
              No, torna indietro
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => (confirming === 'cancel' ? onChangeStatus('cancelled') : onDelete()))
              }
              className={DANGER}
            >
              {confirming === 'cancel' ? 'Sì, annulla la prenotazione' : 'Sì, elimina'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
