import { useState } from 'react';
import { Mail } from 'lucide-react';

export default function ContactInfo({ email }) {
  const [open, setOpen] = useState(false);

  if (!email) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="contact-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-ink/50 bg-white px-4 py-2 text-sm font-bold focus:ring-4 focus:ring-clay focus:outline-none"
      >
        <Mail size={16} aria-hidden="true" />
        Contatti
      </button>
      {open && (
        <div
          id="contact-panel"
          className="absolute right-0 mt-2 w-64 rounded-xl bg-white p-4 text-sm shadow-lg"
        >
          <p className="text-ink/80">Per informazioni o collaborazioni:</p>
          <a
            href={`mailto:${email}`}
            className="mt-1 block font-bold break-all text-clay underline focus:ring-2 focus:ring-clay focus:outline-none"
          >
            {email}
          </a>
        </div>
      )}
    </div>
  );
}
