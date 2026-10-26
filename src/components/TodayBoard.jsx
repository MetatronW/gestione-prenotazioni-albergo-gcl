import { useState } from 'react';
import { Ban, BedDouble, DoorOpen, LogIn, LogOut } from 'lucide-react';
import {
  ROOM_STATE,
  ROOM_STATE_LABELS,
  getDaySummary,
  getRoomDayStatus,
} from '../utils/bookingUtils.js';
import { groupRoomsByType } from '../utils/calendarUtils.js';
import { formatShortDate } from '../utils/dateUtils.js';

// Ogni stato ha un'icona e un'etichetta scritta, oltre al colore.
const STATE_STYLES = {
  free: { icon: DoorOpen, card: 'border-line bg-card', badge: 'bg-paper text-ink' },
  occupied: { icon: BedDouble, card: 'border-clay/40 bg-card', badge: 'bg-clay text-white' },
  arrival: { icon: LogIn, card: 'border-clay bg-clay/10', badge: 'bg-clay text-white' },
  departure: { icon: LogOut, card: 'border-ink/40 bg-card', badge: 'bg-ink text-sand' },
  outOfService: {
    icon: Ban,
    card: 'border-dashed border-ink/30 bg-weekend',
    badge: 'bg-ink/10 text-ink',
  },
};

function RoomCard({ room, typeLabel, status }) {
  const { state, current, arriving, departing } = status;
  const { icon: Icon, card, badge } = STATE_STYLES[state];

  return (
    <li className={`rounded-xl border p-3 ${card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg leading-tight font-bold">{room.name}</p>
          <p className="text-xs text-ink/70">{typeLabel}</p>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${badge}`}
        >
          <Icon size={14} aria-hidden="true" />
          {ROOM_STATE_LABELS[state]}
        </span>
      </div>
      <div className="mt-2 space-y-0.5 text-sm">
        {arriving && (
          <p>
            Arriva: <strong>{arriving.guestName}</strong> · fino al{' '}
            {formatShortDate(arriving.checkOut)}
          </p>
        )}
        {departing && (
          <p>
            Parte: <strong>{departing.guestName}</strong>
          </p>
        )}
        {state === ROOM_STATE.OCCUPIED && current && (
          <p>
            <strong>{current.guestName}</strong> · fino al {formatShortDate(current.checkOut)}
          </p>
        )}
      </div>
    </li>
  );
}

// Cruscotto di oggi: numeri riassuntivi e una scheda per ogni camera, con lo stato a parole.
// Riceve tutto dalle props. "Libere stanotte" sono le camere attive senza arrivi né ospiti
// in casa: libere, oppure con una partenza oggi e nessun arrivo.
export default function TodayBoard({ today, rooms, bookings }) {
  const [onlyFree, setOnlyFree] = useState(false);
  const summary = getDaySummary(rooms, bookings, today);

  const cards = groupRoomsByType(rooms)
    .flatMap((group) => group.rooms.map((room) => ({ room, typeLabel: group.label })))
    .map((card) => ({ ...card, status: getRoomDayStatus(card.room, bookings, today) }));
  const shown = onlyFree
    ? cards.filter(({ status }) => status.state === 'free' || status.state === 'departure')
    : cards;

  const stats = [
    ['Arrivi oggi', summary.arrivals],
    ['Partenze oggi', summary.departures],
    ['Occupate stanotte', `${summary.occupiedTonight} su ${summary.activeRooms}`],
    ['Libere stanotte', summary.freeTonight],
    ['Occupazione', `${summary.occupancyPercent}%`],
  ];

  return (
    <section aria-labelledby="today-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="today-title" className="font-display text-lg font-bold">
          Oggi · {formatShortDate(today)}
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(event) => setOnlyFree(event.target.checked)}
            className="size-4 accent-clay"
          />
          Solo libere stanotte
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-card p-3 shadow-sm">
            <dt className="text-xs text-ink/70">{label}</dt>
            <dd className="font-display text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      {rooms.length === 0 ? (
        <p className="mt-4 text-ink/70">Non ci sono ancora camere.</p>
      ) : (
        <>
          <p aria-live="polite" className="mt-4 text-sm text-ink/70">
            Mostrate {shown.length} di {cards.length} camere
          </p>
          {shown.length === 0 ? (
            <p className="mt-2 font-bold">Nessuna camera libera stanotte.</p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {shown.map(({ room, typeLabel, status }) => (
                <RoomCard key={room.id} room={room} typeLabel={typeLabel} status={status} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
