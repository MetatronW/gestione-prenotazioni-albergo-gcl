import { useAuth } from './hooks/useAuth.js';
import LoginPage from './components/LoginPage.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const { user, loading, error, isDemo, login, loginDemo, logout } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-ink/70">
          Caricamento...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={login}
        onDemoLogin={loginDemo}
        error={error}
        contactEmail={import.meta.env.VITE_CONTACT_EMAIL}
      />
    );
  }

  return <Dashboard user={user} isDemo={isDemo} onLogout={logout} />;
}
