import { useEffect, useRef, useState } from 'react';
import { auth } from '../../lib/auth';
import { LoadingState } from '../../components/LoadingState';
import { Workouts } from '../workouts/Workouts';

type Profile = { id: string; display_name: string; timezone: string };
export function AccountHome() {
  const navigationGuard = useRef<((action: () => void) => void) | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('gymlog:profile') || 'null');
    } catch {
      return null;
    }
  });
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
        try {
          sessionStorage.setItem('gymlog:profile', JSON.stringify(result.user.profile));
        } catch {
          /* The profile cache is optional. */
        }
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
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith('gymlog:')) sessionStorage.removeItem(key);
      window.location.assign('/entrar');
    } catch {
      setError('Não foi possível sair. Tente novamente.');
      setBusy(false);
    }
  }
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, destination: string) {
    if (!navigationGuard.current) return;
    event.preventDefault();
    navigationGuard.current(() => window.location.assign(destination));
  }
  return (
    <main className="account-shell">
      <aside className="app-sidebar">
        <a className="brand" href="/app" onClick={(event) => navigate(event, '/app')}>
          GYM<span>LOG</span>
        </a>
        <nav aria-label="Menu principal">
          <a
            className="sidebar-tab sidebar-tab--active"
            href="/app"
            aria-current="page"
            onClick={(event) => navigate(event, '/app')}
          >
            <span aria-hidden="true">▤</span> Minhas fichas
          </a>
        </nav>
        <button
          className="secondary-button"
          onClick={() =>
            navigationGuard.current ? navigationGuard.current(() => void logout()) : void logout()
          }
          disabled={busy}
        >
          {busy ? (
            <>
              Saindo…
              <LoadingState label="Saindo…" />
            </>
          ) : (
            'Sair da conta'
          )}
        </button>
      </aside>
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
          <Workouts
            userId={profile.id}
            registerNavigationGuard={(guard) => {
              navigationGuard.current = guard;
            }}
          />
        )}
      </section>
    </main>
  );
}
