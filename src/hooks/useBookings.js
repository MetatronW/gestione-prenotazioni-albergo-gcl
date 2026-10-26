import { useEffect, useState } from 'react';
import * as bookingsService from '../services/bookingsService.js';
import { getQueryRange } from '../utils/calendarUtils.js';
import { addDays } from '../utils/dateUtils.js';
import {
  MAX_NIGHTS,
  buildBookingData,
  canDelete,
  getNextStatuses,
  isCheckInLocked,
  isEditable,
  validateBooking,
} from '../utils/bookingUtils.js';

const LOAD_ERROR = 'Non è stato possibile caricare le prenotazioni.';
const FORM_ERROR = 'Operazione non riuscita. Controlla la connessione e riprova.';

const failure = (errors) => ({ ok: false, errors });
const formFailure = (message = FORM_ERROR) => failure({ form: message });

// Stato e controlli per le prenotazioni della settimana che inizia il giorno `startDate`.
// Si carica con una sola query e dopo ogni modifica si aggiorna lo stato in locale.
// rooms: le camere (da useRooms), servono per capienza, tariffa e stato.
// today: la data di oggi (AAAA-MM-GG), serve per sapere quali soggiorni sono già finiti.
export function useBookings(demo, startDate, rooms, today) {
  const [reloadCount, setReloadCount] = useState(0);
  const key = `${demo}|${startDate}|${reloadCount}`;
  const [state, setState] = useState({ key: null, bookings: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const { from, to } = getQueryRange(startDate);
    bookingsService
      .getBookingsInRange(demo, from, to)
      .then((data) => {
        // Si caricano anche i soggiorni iniziati prima; quelli già finiti prima della settimana si scartano.
        const bookings = data.filter((b) => b.checkOut >= startDate);
        if (!cancelled) setState({ key, bookings, error: null });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, key, error: LOAD_ERROR }));
      });
    return () => {
      cancelled = true;
    };
  }, [demo, startDate, key]);

  const { bookings } = state;
  const setBookings = (update) =>
    setState((prev) => ({ ...prev, bookings: update(prev.bookings) }));
  const findRoom = (id) => rooms.find((r) => r.id === id);

  // Controllo in due tempi: prima i campi (senza toccare il database), poi la sovrapposizione
  // leggendo dal database tutte le prenotazioni che potrebbero toccare quelle date,
  // anche se fuori dalla settimana mostrata.
  const findErrors = async (input, room, ignoreId) => {
    const fields = validateBooking(input, room, [], ignoreId);
    if (!fields.valid) return fields.errors;
    const candidates = await bookingsService.getBookingsInRange(
      demo,
      addDays(input.checkIn, -MAX_NIGHTS),
      addDays(input.checkOut, -1)
    );
    const full = validateBooking(input, room, candidates, ignoreId);
    return full.valid ? null : full.errors;
  };

  const createBooking = async (input) => {
    const room = findRoom(input.roomId);
    try {
      const errors = await findErrors(input, room, null);
      if (errors) return failure(errors);
      const data = buildBookingData(input, room.pricePerNight);
      const created = await bookingsService.addBooking(demo, data);
      setBookings((list) => [...list, created]);
      return { ok: true, booking: created };
    } catch {
      return formFailure();
    }
  };

  const updateBooking = async (id, input) => {
    const existing = bookings.find((b) => b.id === id);
    if (!existing) return formFailure('Prenotazione non trovata.');
    if (!isEditable(existing, today)) {
      return formFailure('Questa prenotazione non si può più modificare.');
    }
    if (isCheckInLocked(existing.status) && input.checkIn !== existing.checkIn) {
      return failure({ checkIn: 'Dopo l’arrivo il check-in non si può cambiare.' });
    }
    const room = findRoom(input.roomId);
    try {
      const errors = await findErrors(input, room, id);
      if (errors) return failure(errors);
      // La tariffa resta quella bloccata; cambia solo se si sposta il cliente in un’altra camera.
      const price = input.roomId === existing.roomId ? existing.pricePerNight : room.pricePerNight;
      const data = buildBookingData(input, price, existing.status);
      await bookingsService.updateBooking(demo, id, data);
      const updated = { id, ...data };
      setBookings((list) => list.map((b) => (b.id === id ? updated : b)));
      return { ok: true, booking: updated };
    } catch {
      return formFailure();
    }
  };

  const changeStatus = async (id, nextStatus) => {
    const existing = bookings.find((b) => b.id === id);
    if (!existing) return formFailure('Prenotazione non trovata.');
    if (!getNextStatuses(existing, today).includes(nextStatus)) {
      return formFailure('Questo passaggio di stato non è consentito.');
    }
    try {
      await bookingsService.updateBooking(demo, id, { status: nextStatus });
      const updated = { ...existing, status: nextStatus };
      setBookings((list) => list.map((b) => (b.id === id ? updated : b)));
      return { ok: true, booking: updated };
    } catch {
      return formFailure();
    }
  };

  const removeBooking = async (id) => {
    const existing = bookings.find((b) => b.id === id);
    if (!existing) return formFailure('Prenotazione non trovata.');
    if (!canDelete(existing.status)) {
      return formFailure('Si può eliminare solo una prenotazione annullata.');
    }
    try {
      await bookingsService.deleteBooking(demo, id);
      setBookings((list) => list.filter((b) => b.id !== id));
      return { ok: true };
    } catch {
      return formFailure();
    }
  };

  return {
    bookings,
    loading: state.key !== key,
    error: state.error,
    createBooking,
    updateBooking,
    changeStatus,
    removeBooking,
    reload: () => setReloadCount((n) => n + 1),
  };
}
