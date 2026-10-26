import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { STATUS_LABELS, getDisplayStatus } from '../utils/bookingUtils.js';
import { getBarPosition, groupRoomsByType } from '../utils/calendarUtils.js';
import {
  formatRange,
  formatShortDate,
  getDayNumber,
  getWeekdayLabel,
  getWindowDays,
  isWeekend,
} from '../utils/dateUtils.js';

const BAR_STYLES = {
  booked: 'border-clay bg-card text-ink',
  checkedIn: 'border-clay bg-clay text-white',
  departed: 'border-ink/20 bg-ink/10 text-ink/70',
  cancelled: 'border-dashed border-ink/40 bg-card text-ink/70 line-through',
};

const ROW = 'grid grid-cols-[4.5rem_1fr] border-t border-line';
const NAV_BUTTON =
  'rounded-full border border-ink/60 bg-card focus:ring-4 focus:ring-clay focus:outline-none';

const dayShade = (day, today) => {
  if (day === today) return 'bg-clay/10';
  return isWeekend(day) ? 'bg-weekend' : '';
};

function Bar({ booking, room, position, today, onSelect }) {
  // "Partito" non è salvato: si ricava dalla data di check-out.
  const status = getDisplayStatus(booking, today);
  const className = [
    'absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-2 text-left text-xs',
    status === 'cancelled' ? 'z-0' : 'z-10',
    BAR_STYLES[status],
    position.continuesBefore ? 'rounded-l-none border-l-0' : '',
    position.continuesAfter ? 'rounded-r-none border-r-0' : '',
  ].join(' ');
  const style = { left: `${position.left}%`, width: `calc(${position.width}% - 2px)` };
  const details = `camera ${room.name}, dal ${formatShortDate(booking.checkIn)} al ${formatShortDate(booking.checkOut)}, ${STATUS_LABELS[status]}`;
  const content = (
    <>
      <span className="truncate font-bold">{booking.guestName}</span>
      <span className="sr-only">, {details}</span>
    </>
  );

  if (!onSelect) {
    return (
      <div className={className} style={style} title={`${booking.guestName}, ${details}`}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${className} focus:ring-2 focus:ring-ink focus:outline-none`}
      style={style}
      title={`${booking.guestName}, ${details}`}
      onClick={() => onSelect(booking)}
    >
      {content}
    </button>
  );
}

function RoomRow({ room, days, today, startDate, bookings, onSelectBooking, onSelectCell }) {
  const bars = bookings
    .map((booking) => ({ booking, position: getBarPosition(booking, startDate, days.length) }))
    .filter((bar) => bar.position !== null);

  return (
    <div className={ROW}>
      <div className="px-2 py-2 text-sm font-bold">{room.name}</div>
      <div className="relative grid grid-cols-7">
        {days.map((day) => {
          const cell = `h-9 border-l border-line ${dayShade(day, today)}`;
          if (onSelectCell && room.active) {
            return (
              // Scorciatoia per mouse e tocco: fuori dall'ordine di Tab e dagli screen reader
              // (sarebbero ~130 tappe). Da tastiera la stessa funzione è "Nuova prenotazione".
              <button
                key={day}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                aria-label={`Camera ${room.name}, ${formatShortDate(day)}: nuova prenotazione`}
                title={`Nuova prenotazione: camera ${room.name}, ${formatShortDate(day)}`}
                className={`${cell} group flex items-center justify-center hover:bg-clay/20`}
                onClick={() => onSelectCell({ roomId: room.id, date: day })}
              >
                <Plus
                  size={16}
                  aria-hidden="true"
                  className="text-clay opacity-0 group-hover:opacity-100"
                />
              </button>
            );
          }
          return <div key={day} className={cell} />;
        })}
        {!room.active && (
          <div className="absolute inset-x-0 inset-y-1 z-10 flex items-center justify-center rounded-md border border-dashed border-ink/40 bg-weekend text-xs text-ink/70">
            Fuori servizio
          </div>
        )}
        {bars.map(({ booking, position }) => (
          <Bar
            key={booking.id}
            booking={booking}
            room={room}
            position={position}
            today={today}
            onSelect={onSelectBooking}
          />
        ))}
      </div>
    </div>
  );
}

// Calendario settimanale: camere sulle righe, giorni sulle colonne, prenotazioni come barre
// dal check-in al check-out. Riceve tutto dalle props: non conosce Firebase né gli hook.
// onSelectBooking(booking) e onSelectCell({ roomId, date }) sono facoltative: senza, le barre
// e le celle non sono cliccabili.
export default function Calendar({
  startDate,
  today,
  rooms,
  bookings,
  onPrev,
  onNext,
  onToday,
  onSelectBooking,
  onSelectCell,
  showCancelled = false,
  onToggleCancelled,
}) {
  const days = getWindowDays(startDate);
  const groups = groupRoomsByType(rooms);
  const visible = showCancelled ? bookings : bookings.filter((b) => b.status !== 'cancelled');

  return (
    <section aria-label="Calendario delle prenotazioni">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Settimana precedente"
            onClick={onPrev}
            className={`${NAV_BUTTON} p-2`}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className={`${NAV_BUTTON} px-4 py-2 text-sm font-bold`}
          >
            Oggi
          </button>
          <button
            type="button"
            aria-label="Settimana successiva"
            onClick={onNext}
            className={`${NAV_BUTTON} p-2`}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          {onToggleCancelled && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(event) => onToggleCancelled(event.target.checked)}
                className="size-4 accent-clay"
              />
              Mostra annullate
            </label>
          )}
          <h2 className="font-display text-lg font-bold">{formatRange(startDate)}</h2>
        </div>
      </div>

      {onSelectCell && (
        <p className="mb-2 text-sm text-ink/70">
          Clicca una cella libera per prenotare quel giorno, o una barra per aprire la prenotazione.
          Da tastiera usa “Nuova prenotazione”.
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
        <div className="min-w-[640px]">
          <div className={`${ROW} border-t-0`}>
            <div className="px-2 py-2 text-xs text-ink/70">Camera</div>
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <div
                  key={day}
                  aria-current={day === today ? 'date' : undefined}
                  className={`flex flex-col items-center border-l border-line py-1 text-xs ${
                    day === today
                      ? 'bg-clay text-white'
                      : `${isWeekend(day) ? 'bg-weekend' : ''} text-ink/70`
                  }`}
                >
                  <span>{getWeekdayLabel(day)}</span>
                  <span className="text-base font-bold">{getDayNumber(day)}</span>
                </div>
              ))}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.type}>
              <div className="border-t border-line bg-section px-2 py-1 text-xs font-bold tracking-wide text-ink/70 uppercase">
                {group.label}
              </div>
              {group.rooms.map((room) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  days={days}
                  today={today}
                  startDate={startDate}
                  bookings={visible.filter((b) => b.roomId === room.id)}
                  onSelectBooking={onSelectBooking}
                  onSelectCell={onSelectCell}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/80">
        <li className="flex items-center gap-2">
          <span className={`h-3 w-5 rounded border ${BAR_STYLES.booked}`} aria-hidden="true" />
          Prenotata
        </li>
        <li className="flex items-center gap-2">
          <span className={`h-3 w-5 rounded border ${BAR_STYLES.checkedIn}`} aria-hidden="true" />
          Arrivato
        </li>
        <li className="flex items-center gap-2">
          <span className={`h-3 w-5 rounded border ${BAR_STYLES.departed}`} aria-hidden="true" />
          Partito
        </li>
        {showCancelled && (
          <li className="flex items-center gap-2">
            <span className={`h-3 w-5 rounded border ${BAR_STYLES.cancelled}`} aria-hidden="true" />
            Annullata
          </li>
        )}
        <li className="flex items-center gap-2">
          <span
            className="h-3 w-5 rounded border border-dashed border-ink/40 bg-weekend"
            aria-hidden="true"
          />
          Fuori servizio
        </li>
      </ul>
    </section>
  );
}
