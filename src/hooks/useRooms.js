import { useEffect, useState } from 'react';
import * as roomsService from '../services/roomsService.js';
import * as bookingsService from '../services/bookingsService.js';
import { BOOKING_STATUS } from '../utils/bookingUtils.js';
import { buildRoomData, validateRoom } from '../utils/roomUtils.js';

const LOAD_ERROR = 'Non è stato possibile caricare le camere.';
const FORM_ERROR = 'Operazione non riuscita. Controlla la connessione e riprova.';

const failure = (errors) => ({ ok: false, errors });
const formFailure = (message = FORM_ERROR) => failure({ form: message });
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isLive = (b) => b.status === BOOKING_STATUS.BOOKED || b.status === BOOKING_STATUS.CHECKED_IN;

// Stato e controlli per le camere. Le camere si leggono una volta sola e poi si aggiornano
// in locale dopo ogni modifica: ogni scrittura costa una sola operazione.
// demo: true per l'account demo. today: "oggi" (AAAA-MM-GG) per i controlli sulle prenotazioni future.
export function useRooms(demo, today) {
  const [reloadCount, setReloadCount] = useState(0);
  const key = `${demo}|${reloadCount}`;
  const [state, setState] = useState({ key: null, rooms: [], error: null });

  useEffect(() => {
    let cancelled = false;
    roomsService
      .getRooms(demo)
      .then((rooms) => {
        if (!cancelled) setState({ key, rooms, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ key, rooms: [], error: LOAD_ERROR });
      });
    return () => {
      cancelled = true;
    };
  }, [demo, key]);

  const { rooms } = state;
  const setRooms = (update) => setState((prev) => ({ ...prev, rooms: update(prev.rooms) }));

  const addRoom = async (input) => {
    const { valid, errors } = validateRoom(input, rooms);
    if (!valid) return failure(errors);
    try {
      const created = await roomsService.addRoom(demo, buildRoomData(input));
      setRooms((list) => [...list, created]);
      return { ok: true, room: created };
    } catch {
      return formFailure();
    }
  };

  const updateRoom = async (id, input) => {
    const existing = rooms.find((r) => r.id === id);
    if (!existing) return formFailure('Camera non trovata.');
    const { valid, errors } = validateRoom(input, rooms, id);
    if (!valid) return failure(errors);

    const data = buildRoomData(input);
    try {
      const goingOut = existing.active && !data.active;
      const shrinking = data.capacity < existing.capacity;
      if (goingOut || shrinking) {
        const all = await bookingsService.getBookingsForRoom(demo, id);
        const upcoming = all.filter((b) => isLive(b) && b.checkOut > today);
        if (goingOut && upcoming.length > 0) {
          return failure({
            active: `La camera ha ${count(upcoming.length, 'prenotazione', 'prenotazioni')} in corso o future: spostale prima di metterla fuori servizio.`,
          });
        }
        const tooMany = upcoming.filter((b) => b.guestsCount > data.capacity);
        if (shrinking && tooMany.length > 0) {
          return failure({
            capacity: `${count(tooMany.length, 'prenotazione ha', 'prenotazioni hanno')} più di ${data.capacity} persone: modificale prima.`,
          });
        }
      }
      await roomsService.updateRoom(demo, id, data);
      const updated = { id, ...data };
      setRooms((list) => list.map((r) => (r.id === id ? updated : r)));
      return { ok: true, room: updated };
    } catch {
      return formFailure();
    }
  };

  const removeRoom = async (id) => {
    try {
      if (await bookingsService.hasBookingsForRoom(demo, id)) {
        return formFailure(
          'La camera ha delle prenotazioni: mettila fuori servizio invece di eliminarla.'
        );
      }
      await roomsService.deleteRoom(demo, id);
      setRooms((list) => list.filter((r) => r.id !== id));
      return { ok: true };
    } catch {
      return formFailure();
    }
  };

  return {
    rooms,
    loading: state.key !== key,
    error: state.error,
    addRoom,
    updateRoom,
    removeRoom,
    reload: () => setReloadCount((n) => n + 1),
  };
}
