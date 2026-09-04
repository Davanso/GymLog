import { auth } from './lib/auth';
import { AuthPage } from './features/auth/AuthPage';
import { AccountHome } from './features/auth/AccountHome';
import { LoadingState } from './components/LoadingState';

export default function App() {
  const session = auth.useSession();
  const publicAction = ['/recuperar-senha', '/redefinir-senha', '/verificar-email'].includes(
    window.location.pathname,
  );
  if (publicAction) return <AuthPage />;
  if (session.isPending)
    return (
      <main className="loading-page">
        <LoadingState label="Preparando seu GymLog…" delayMs={0} />
      </main>
    );
  if (!session.data) return <AuthPage serviceError={Boolean(session.error)} />;
  return <AccountHome />;
}
