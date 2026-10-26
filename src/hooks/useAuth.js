import { useState, useEffect } from 'react';
import { login, loginDemo, logout, subscribeToAuth, isDemoUser } from '../services/authService.js';

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Email o password non corrette.',
  'auth/invalid-email': "L'indirizzo email non è valido.",
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/network-request-failed': 'Connessione assente. Controlla la rete e riprova.',
};

const toMessage = (err) => ERROR_MESSAGES[err.code] || 'Accesso non riuscito. Riprova.';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true finché Firebase non ha letto la sessione
  const [error, setError] = useState(null);

  useEffect(() => {
    return subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  const run = async (action) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(toMessage(err));
    }
  };

  return {
    user,
    loading,
    error,
    isDemo: isDemoUser(user),
    login: (email, password) => run(() => login(email, password)),
    loginDemo: () => run(loginDemo),
    logout: () => run(logout),
  };
}
