import { buildBookingData } from '../src/utils/bookingUtils.js';
import { DEMO_TODAY } from '../src/utils/dateUtils.js';

// Dati di esempio dell'albergo: camere e prenotazioni inventate (nomi e telefoni non reali).
// "Oggi" per la demo è DEMO_TODAY (lunedì 5 ottobre 2026): le prenotazioni vanno dal
// 27 settembre al 22 ottobre, così spostandosi avanti e indietro c'è sempre qualcosa.

const room = (name, type, capacity, pricePerNight, active = true) => ({
  id: `room_${name}`,
  data: { name, type, capacity, pricePerNight, active },
});

export const DEMO_ROOMS = [
  room('101', 'standard', 2, 85),
  room('102', 'standard', 2, 85),
  room('103', 'standard', 2, 85),
  room('104', 'standard', 2, 85),
  room('105', 'standard', 2, 85),
  room('106', 'standard', 2, 85),
  room('107', 'standard', 3, 95),
  room('108', 'standard', 3, 95),
  room('201', 'superior', 2, 120),
  room('202', 'superior', 2, 120),
  room('203', 'superior', 2, 120),
  room('204', 'superior', 2, 120, false),
  room('205', 'superior', 2, 120),
  room('206', 'superior', 2, 120),
  room('207', 'superior', 3, 135),
  room('208', 'superior', 3, 135),
  room('301', 'suite', 4, 190),
  room('302', 'suite', 4, 190),
  room('303', 'suite', 4, 190),
  room('304', 'suite', 4, 190),
];

// [camera, check-in, check-out, intestatario, persone, extra]
// Le date sono MM-GG del 2026. Lo stato si ricava dalla data demo, salvo `status` in extra.
const STAYS = [
  ['101', '09-27', '10-01', 'Marco Rossi', 2],
  ['101', '10-02', '10-06', 'Luca Bianchi', 2, { notes: 'Colazione in camera' }],
  ['101', '10-06', '10-09', 'Paolo Greco', 1],
  ['101', '10-12', '10-15', 'Chiara Fabbri', 2],
  ['102', '09-29', '10-05', 'Elena Conti', 2],
  ['102', '10-05', '10-08', 'Andrea Moretti', 2, { status: 'booked' }],
  ['102', '10-10', '10-12', 'Sara Ferri', 1],
  ['102', '10-16', '10-19', 'Giorgio Rizzo', 2],
  ['103', '10-01', '10-04', 'Davide Neri', 2],
  ['103', '10-06', '10-10', 'Giulia Longo', 2, { notes: 'Camera tranquilla' }],
  ['103', '10-11', '10-13', 'Matteo Serra', 2],
  ['104', '09-30', '10-03', 'Franco Gallo', 2],
  ['104', '10-04', '10-07', 'Laura Marino', 2],
  ['104', '10-08', '10-11', 'Roberto Pace', 2],
  ['105', '10-05', '10-09', 'Anna Esposito', 2],
  ['105', '10-12', '10-17', 'Silvia Villa', 2],
  ['106', '10-01', '10-03', 'Pietro Orsini', 2, { status: 'cancelled' }],
  ['106', '10-07', '10-09', 'Carlo Sala', 2],
  ['106', '10-14', '10-16', 'Marta Donati', 1],
  ['107', '10-03', '10-08', 'Giovanni Parisi', 3],
  ['107', '10-09', '10-12', 'Irene Basile', 3],
  [
    '108',
    '10-05',
    '10-07',
    'Simone Orlando',
    3,
    { status: 'booked', notes: 'Famiglia con bambini' },
  ],
  ['108', '10-18', '10-22', 'Fabio Monti', 3],
  ['201', '09-28', '10-03', 'Claudia Testa', 2],
  ['201', '10-03', '10-07', 'Stefano Barone', 2],
  ['201', '10-07', '10-11', 'Monica Valentini', 2],
  ['201', '10-13', '10-16', 'Enrico Bianco', 2],
  ['202', '10-01', '10-05', 'Alberto Caruso', 2],
  ['202', '10-08', '10-12', 'Federica Silvestri', 2],
  ['202', '10-12', '10-14', 'Gianni Santoro', 2, { status: 'cancelled' }],
  ['203', '10-04', '10-09', 'Valeria Amato', 2],
  ['203', '10-09', '10-13', 'Nicola Leone', 2],
  ['205', '09-30', '10-02', 'Tommaso Coppola', 1],
  ['205', '10-05', '10-08', 'Paola Guidi', 2],
  ['205', '10-10', '10-14', 'Lorenzo Martini', 2],
  ['206', '10-02', '10-06', 'Alessia Gatti', 2],
  ['206', '10-08', '10-10', 'Daniele Riva', 2],
  ['206', '10-15', '10-19', 'Cristina Vitale', 2],
  [
    '207',
    '10-05',
    '10-12',
    'Massimo Sanna',
    3,
    { status: 'booked', notes: 'Arrivo previsto in serata' },
  ],
  ['208', '10-01', '10-05', 'Rita Mele', 2],
  ['208', '10-06', '10-09', 'Fabrizio Costa', 3],
  ['301', '09-29', '10-04', 'Ilaria De Luca', 2],
  ['301', '10-04', '10-10', 'Bruno Ricci', 2],
  ['301', '10-12', '10-18', 'Sofia Ferretti', 4, { notes: 'Richiesta culla' }],
  ['302', '10-06', '10-11', 'Michele Pellegrini', 2],
  ['302', '10-14', '10-17', 'Beatrice Carbone', 3],
  ['303', '10-02', '10-05', 'Ugo Messina', 2],
  ['303', '10-05', '10-08', 'Elisa Fiore', 2, { status: 'booked' }],
  ['303', '10-10', '10-14', 'Mario Farina', 4],
  ['303', '10-16', '10-18', 'Chiara Fontana', 2, { status: 'cancelled' }],
  ['304', '10-08', '10-13', 'Giacomo Gentile', 2],
  ['304', '10-17', '10-20', 'Veronica Bellini', 2],
];

// Chi è già arrivato è "Arrivato" (anche i soggiorni finiti: "Partito" non si salva,
// l'app lo ricava dalla data di check-out).
function statusFor(checkIn) {
  return checkIn <= DEMO_TODAY ? 'checkedIn' : 'booked';
}

export const DEMO_BOOKINGS = STAYS.map(
  ([roomName, inMD, outMD, guestName, guestsCount, extra], i) => {
    const roomId = `room_${roomName}`;
    const { data: roomData } = DEMO_ROOMS.find((r) => r.id === roomId);
    const checkIn = `2026-${inMD}`;
    const checkOut = `2026-${outMD}`;
    const input = {
      guestName,
      phone: `333 000 ${1001 + i}`,
      email: i % 4 === 0 ? `ospite${i + 1}@example.com` : '',
      roomId,
      checkIn,
      checkOut,
      guestsCount,
      notes: extra?.notes ?? '',
    };
    const status = extra?.status ?? statusFor(checkIn);
    return {
      id: `booking_${String(i + 1).padStart(3, '0')}`,
      data: buildBookingData(input, roomData.pricePerNight, status),
    };
  }
);
