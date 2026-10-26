import { ROOM_TYPES } from './calendarUtils.js';

export const MAX_ROOM_NAME = 20;
export const MAX_CAPACITY = 10;
export const MAX_ROOM_PRICE = 10000;

// input: { name, type, capacity (intero), pricePerNight (intero, in euro), active }
// rooms: camere già esistenti. ignoreId: la camera che si sta modificando.
export function validateRoom(input, rooms, ignoreId = null) {
  const errors = {};
  const name = (input.name ?? '').trim();

  if (!name) {
    errors.name = 'Inserisci il nome o il numero della camera.';
  } else if (name.length > MAX_ROOM_NAME) {
    errors.name = `Il nome è troppo lungo (massimo ${MAX_ROOM_NAME} caratteri).`;
  } else if (rooms.some((r) => r.id !== ignoreId && r.name.toLowerCase() === name.toLowerCase())) {
    errors.name = `Esiste già una camera chiamata ${name}.`;
  }

  if (!ROOM_TYPES.some((t) => t.value === input.type)) {
    errors.type = 'Scegli la tipologia.';
  }

  const { capacity, pricePerNight } = input;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
    errors.capacity = `La capienza va da 1 a ${MAX_CAPACITY} persone.`;
  }
  if (!Number.isInteger(pricePerNight) || pricePerNight < 1 || pricePerNight > MAX_ROOM_PRICE) {
    errors.pricePerNight = `Il prezzo per notte è un numero intero di euro, da 1 a ${MAX_ROOM_PRICE}.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Esattamente i 5 campi ammessi dalle regole per una camera.
export function buildRoomData(input) {
  return {
    name: input.name.trim(),
    type: input.type,
    capacity: input.capacity,
    pricePerNight: input.pricePerNight,
    active: input.active !== false,
  };
}
