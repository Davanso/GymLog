import { auth } from '../../services/auth';
import { AccountHome } from '../accountHome/accountHome';
import { AuthPage } from '../authPage/authPage';
import { LoadingState } from '../loadingState/loadingState';
import './app.css';

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
