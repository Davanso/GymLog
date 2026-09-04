import { useEffect, useState } from 'react';
import { auth } from '../../lib/auth';
import { LoadingState } from '../../components/LoadingState';

type Profile = { display_name: string; timezone: string };
export function AccountHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError('');
      try {
        const response = await fetch('/api/me', {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.replace('/entrar');
          return;
        }
        if (!response.ok) throw new Error();
        const result = await response.json();
        setProfile(result.user.profile);
      } catch {
        if (!controller.signal.aborted) setError('Não foi possível carregar seu perfil.');
      }
    }
    void load();
    return () => controller.abort();
  }, [retry]);
  async function logout() {
    setBusy(true);
    setError('');
    try {
      const result = await auth.signOut();
      if (result.error) throw new Error();
      window.location.assign('/entrar');
    } catch {
      setError('Não foi possível sair. Tente novamente.');
      setBusy(false);
    }
  }
  return (
    <main className="account-shell">
      <header>
        <a className="brand" href="/app">
          GYM<span>LOG</span>
        </a>
        <button className="secondary-button" onClick={logout} disabled={busy}>
          {busy ? (
            <>
              Saindo…
              <LoadingState label="Saindo…" />
            </>
          ) : (
            'Sair da conta'
          )}
        </button>
      </header>
      <section className="account-content">
        <p className="eyebrow">SEU ESPAÇO</p>
        {profile ? (
          <h1>Olá, {profile.display_name}.</h1>
        ) : (
          !error && <LoadingState label="Preparando seu espaço…" />
        )}
        {error && (
          <div className="message error" role="alert">
            {error} <button onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button>
          </div>
        )}
        {profile && (
          <>
            <p>Sua conta está pronta para o próximo passo.</p>
            <div className="empty-workouts">
              <span className="empty-icon" aria-hidden="true">
                ＋
              </span>
              <h2>Vamos começar pela sua ficha.</h2>
              <p>
                A criação de treinos será a próxima funcionalidade do GymLog. Seu perfil já está
                salvo para acompanhar essa evolução.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
