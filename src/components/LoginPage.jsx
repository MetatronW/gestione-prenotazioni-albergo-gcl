import { useState } from 'react';
import { Hotel } from 'lucide-react';
import ContactInfo from './ContactInfo.jsx';

const field =
  'w-full rounded-lg border border-ink/60 bg-card px-3 py-2 focus:ring-2 focus:ring-clay focus:outline-none';

export default function LoginPage({ onLogin, onDemoLogin, error, contactEmail }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    run(() => onLogin(email, password));
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-sm">
        <Hotel size={32} className="mb-4 text-clay" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold">Hotel California</h1>
        <p className="mt-1 mb-6 text-ink/80">Accedi per gestire le prenotazioni.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full rounded-full bg-ink py-3 font-bold text-sand focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60"
          >
            {busy ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-sm text-ink/70">
          <span className="h-px flex-1 bg-line" />
          oppure
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(onDemoLogin)}
          className="w-full rounded-full border-2 border-ink py-3 font-bold focus:ring-4 focus:ring-clay focus:outline-none disabled:opacity-60"
        >
          Accedi in demo
        </button>
        <p className="mt-2 text-center text-xs text-ink/70">
          La demo usa dati di esempio già pronti.
        </p>
      </div>
      <div className="absolute top-4 right-4">
        <ContactInfo email={contactEmail} />
      </div>
    </main>
  );
}
