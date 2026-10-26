import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from './App.jsx';
import { useAuth } from './hooks/useAuth.js';

const { DashboardMock } = vi.hoisted(() => ({
  DashboardMock: vi.fn(() => 'Schermata principale'),
}));

vi.mock('./hooks/useAuth.js', () => ({ useAuth: vi.fn() }));
vi.mock('./components/Dashboard.jsx', () => ({ default: DashboardMock }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const auth = (overrides = {}) => ({
  user: null,
  loading: false,
  error: null,
  isDemo: false,
  login: vi.fn(),
  loginDemo: vi.fn(),
  logout: vi.fn(),
  ...overrides,
});

describe('App', () => {
  it('mostra "Caricamento" finché Firebase non ha letto la sessione', () => {
    useAuth.mockReturnValue(auth({ loading: true }));
    render(<App />);
    expect(screen.getByRole('status').textContent).toBe('Caricamento...');
    expect(screen.queryByRole('button', { name: 'Accedi' })).toBeNull();
    expect(DashboardMock).not.toHaveBeenCalled();
  });

  it('senza utente mostra il login e non carica i dati', () => {
    useAuth.mockReturnValue(auth());
    render(<App />);
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accedi in demo' })).toBeTruthy();
    expect(DashboardMock).not.toHaveBeenCalled();
  });

  it('passa l’errore di accesso al login', () => {
    useAuth.mockReturnValue(auth({ error: 'Email o password non corrette.' }));
    render(<App />);
    expect(screen.getByRole('alert').textContent).toBe('Email o password non corrette.');
  });

  it('con un utente mostra la schermata principale e le passa utente, modalità e uscita', () => {
    const logout = vi.fn();
    const user = { email: 'demo@example.com' };
    useAuth.mockReturnValue(auth({ user, isDemo: true, logout }));
    render(<App />);
    expect(screen.getByText('Schermata principale')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accedi' })).toBeNull();
    expect(DashboardMock.mock.calls[0][0]).toEqual({ user, isDemo: true, onLogout: logout });
  });
});
