import { auth } from './lib/auth';
import { AuthPage } from './features/auth/AuthPage';
import { AccountHome } from './features/auth/AccountHome';

export default function App() {
  const session = auth.useSession();
  const publicAction = ['/recuperar-senha', '/redefinir-senha', '/verificar-email'].includes(
    window.location.pathname,
  );
  if (publicAction) return <AuthPage />;
  if (session.isPending)
    return (
      <main className="loading-page" role="status">
        Abrindo seu GymLog…
      </main>
    );
  if (!session.data) return <AuthPage serviceError={Boolean(session.error)} />;
  return <AccountHome />;
}
