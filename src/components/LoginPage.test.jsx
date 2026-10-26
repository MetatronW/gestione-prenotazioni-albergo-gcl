import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage.jsx';

afterEach(cleanup);

function setup(props = {}) {
  const onLogin = vi.fn().mockResolvedValue(undefined);
  const onDemoLogin = vi.fn().mockResolvedValue(undefined);
  render(
    <LoginPage
      onLogin={onLogin}
      onDemoLogin={onDemoLogin}
      error={null}
      contactEmail="info@example.com"
      {...props}
    />
  );
  return { onLogin, onDemoLogin, user: userEvent.setup() };
}

describe('LoginPage', () => {
  it('mostra il titolo e i due modi di accedere', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Hotel California' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accedi in demo' })).toBeTruthy();
  });

  it('invia email e password digitate', async () => {
    const { onLogin, user } = setup();
    await user.type(screen.getByLabelText('Email'), 'staff@example.com');
    await user.type(screen.getByLabelText('Password'), 'segreta123');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));
    expect(onLogin).toHaveBeenCalledWith('staff@example.com', 'segreta123');
  });

  it('non invia il modulo se i campi sono vuoti', async () => {
    const { onLogin, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Accedi' }));
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('il pulsante demo chiama l’accesso demo', async () => {
    const { onDemoLogin, onLogin, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Accedi in demo' }));
    expect(onDemoLogin).toHaveBeenCalledTimes(1);
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('mostra l’errore come avviso', () => {
    setup({ error: 'Email o password non corrette.' });
    expect(screen.getByRole('alert').textContent).toBe('Email o password non corrette.');
  });

  it('non mostra avvisi se non ci sono errori', () => {
    setup();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blocca i pulsanti mentre l’accesso è in corso', async () => {
    let finish;
    const onLogin = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { user } = setup({ onLogin });
    await user.type(screen.getByLabelText('Email'), 'staff@example.com');
    await user.type(screen.getByLabelText('Password'), 'segreta123');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(screen.getByRole('button', { name: 'Accesso in corso...' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Accedi in demo' }).disabled).toBe(true);

    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accedi' }).disabled).toBe(false)
    );
  });
});

describe('Contatti', () => {
  it('apre e chiude il pannello con il link email', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: 'Contatti' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link')).toBeNull();

    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'info@example.com' }).getAttribute('href')).toBe(
      'mailto:info@example.com'
    );

    await user.click(button);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('non compare se manca l’email di contatto', () => {
    setup({ contactEmail: '' });
    expect(screen.queryByRole('button', { name: 'Contatti' })).toBeNull();
  });
});
