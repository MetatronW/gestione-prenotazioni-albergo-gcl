import { useState } from 'react';
import { CalendarDays, Plus, Settings } from 'lucide-react';
import BookingDetail from './BookingDetail.jsx';
import BookingForm from './BookingForm.jsx';
import Calendar from './Calendar.jsx';
import Modal from './Modal.jsx';
import RoomManager from './RoomManager.jsx';
import TodayBoard from './TodayBoard.jsx';
import { useBookings } from '../hooks/useBookings.js';
import { useRooms } from '../hooks/useRooms.js';
import { WINDOW_DAYS } from '../utils/calendarUtils.js';
import { addDays, formatShortDate, getToday } from '../utils/dateUtils.js';

// Data per esteso, per esempio "lunedì 5 ottobre 2026".
const formatLongDate = (iso) =>
  new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

const STATUS_NOTICES = {
  checkedIn: (name) => `Arrivo registrato per ${name}.`,
  cancelled: (name) => `Prenotazione di ${name} annullata.`,
};

// Contenitore: usa gli hook, tiene la settimana mostrata e la finestra aperta,
// e passa i dati ai componenti.
export default function Dashboard({ user, isDemo, onLogout }) {
  const today = getToday(isDemo ? 'demo' : 'real');
  const [startDate, setStartDate] = useState(today);
  const [showCancelled, setShowCancelled] = useState(false);
  // null | { type: 'create', initial } | { type: 'detail', booking } | { type: 'edit', booking }
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const [view, setView] = useState('planner'); // 'planner' (cruscotto e calendario) | 'rooms'
  const roomsData = useRooms(isDemo, today);
  const bookingsData = useBookings(isDemo, startDate, roomsData.rooms, today);
  // Seconda lettura, sempre su "oggi": il cruscotto resta corretto anche quando il calendario
  // mostra un'altra settimana.
  const todayData = useBookings(isDemo, today, roomsData.rooms, today);

  const loading = roomsData.loading || bookingsData.loading || todayData.loading;
  const error = roomsData.error || bookingsData.error || todayData.error;

  const open = (next) => {
    setNotice(null);
    setDialog(next);
  };
  const openCreate = ({ roomId = '', date = startDate } = {}) =>
    open({ type: 'create', initial: { roomId, checkIn: date, checkOut: addDays(date, 1) } });
  const openDetail = (booking) => open({ type: 'detail', booking });
  const close = () => setDialog(null);

  const switchView = () => {
    setDialog(null);
    setNotice(null);
    setView((current) => (current === 'rooms' ? 'planner' : 'rooms'));
  };

  const finish = (message) => {
    setNotice(message);
    setDialog(null);
    todayData.reload();
  };

  const handleSubmit = async (input) => {
    const editing = dialog.type === 'edit';
    const result = editing
      ? await bookingsData.updateBooking(dialog.booking.id, input)
      : await bookingsData.createBooking(input);
    if (result.ok) {
      const name = result.booking.guestName;
      finish(editing ? `Prenotazione di ${name} aggiornata.` : `Prenotazione creata per ${name}.`);
    }
    return result;
  };

  const handleStatus = async (status) => {
    const { booking } = dialog;
    const result = await bookingsData.changeStatus(booking.id, status);
    if (result.ok) finish(STATUS_NOTICES[status](booking.guestName));
    return result;
  };

  const handleDelete = async () => {
    const { booking } = dialog;
    const result = await bookingsData.removeBooking(booking.id);
    if (result.ok) finish(`Prenotazione di ${booking.guestName} eliminata.`);
    return result;
  };

  const titles = {
    create: 'Nuova prenotazione',
    edit: 'Modifica prenotazione',
    detail: dialog?.booking ? `Prenotazione di ${dialog.booking.guestName}` : '',
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Hotel California</h1>
          <p className="mt-1 text-ink/80">
            {user.email} ({isDemo ? 'account demo' : 'personale'}) · Oggi: {formatShortDate(today)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {view === 'planner' && (
            <button
              type="button"
              disabled={roomsData.loading}
              onClick={() => openCreate()}
              className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 font-bold text-sand focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60"
            >
              <Plus size={18} aria-hidden="true" />
              Nuova prenotazione
            </button>
          )}
          <button
            type="button"
            onClick={switchView}
            className="flex items-center gap-2 rounded-full border-2 border-ink px-5 py-2 font-bold focus:ring-4 focus:ring-clay focus:outline-none"
          >
            {view === 'rooms' ? (
              <CalendarDays size={18} aria-hidden="true" />
            ) : (
              <Settings size={18} aria-hidden="true" />
            )}
            {view === 'rooms' ? 'Torna alle prenotazioni' : 'Gestione camere'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border-2 border-ink px-6 py-2 font-bold focus:ring-4 focus:ring-clay focus:outline-none"
          >
            Esci
          </button>
        </div>
      </header>

      <div className="mt-6">
        {loading && (
          <p role="status" className="mb-3 text-ink/70">
            Caricamento dati...
          </p>
        )}
        {notice && (
          <p role="status" className="mb-3 font-bold text-clay">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-3 text-red-700">
            {error}
          </p>
        )}
        {view === 'rooms' ? (
          <RoomManager
            rooms={roomsData.rooms}
            onAdd={roomsData.addRoom}
            onUpdate={roomsData.updateRoom}
            onRemove={roomsData.removeRoom}
          />
        ) : (
          <>
            <TodayBoard today={today} rooms={roomsData.rooms} bookings={todayData.bookings} />
            <div className="mt-8">
              <Calendar
                startDate={startDate}
                today={today}
                rooms={roomsData.rooms}
                bookings={bookingsData.bookings}
                onPrev={() => setStartDate((d) => addDays(d, -WINDOW_DAYS))}
                onNext={() => setStartDate((d) => addDays(d, WINDOW_DAYS))}
                onToday={() => setStartDate(today)}
                onSelectBooking={openDetail}
                onSelectCell={openCreate}
                showCancelled={showCancelled}
                onToggleCancelled={setShowCancelled}
              />
            </div>
          </>
        )}
      </div>

      {dialog && (
        <Modal key={dialog.type} title={titles[dialog.type]} onClose={close}>
          {dialog.type === 'detail' ? (
            <BookingDetail
              booking={dialog.booking}
              room={roomsData.rooms.find((r) => r.id === dialog.booking.roomId)}
              today={today}
              onChangeStatus={handleStatus}
              onEdit={() => setDialog({ type: 'edit', booking: dialog.booking })}
              onDelete={handleDelete}
            />
          ) : (
            <BookingForm
              rooms={roomsData.rooms}
              booking={dialog.booking}
              initial={dialog.initial}
              onSubmit={handleSubmit}
              onCancel={close}
            />
          )}
        </Modal>
      )}

      {isDemo && (
        <footer className="mt-10 border-t border-line pt-4 text-sm text-ink/70">
          <p>
            <strong>Modalità demo.</strong> I dati sono di esempio e la data di oggi è sempre
            fissata a {formatLongDate(today)}, così la settimana demo resta piena. Il pulsante
            “Oggi” del calendario riporta a questa data. Le modifiche restano visibili agli altri
            visitatori finché i dati non vengono ripristinati.
          </p>
        </footer>
      )}
    </main>
  );
}
