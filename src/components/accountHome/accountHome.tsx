import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../../services/auth';
import { LoadingState } from '../loadingState/loadingState';
import { Workouts } from '../workouts/workouts';
import './accountHome.css';

type Profile = { id: string; display_name: string; timezone: string };
function storedSidebarPreference() {
  try {
    return localStorage.getItem('gymlog:sidebar-collapsed') === 'true';
  } catch {
    return false;
  }
}
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
  const [workoutsReady, setWorkoutsReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(storedSidebarPreference);
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
  const handleWorkoutsReady = useCallback(() => setWorkoutsReady(true), []);
  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      try {
        localStorage.setItem('gymlog:sidebar-collapsed', String(!collapsed));
      } catch {
        /* The layout preference is optional. */
      }
      return !collapsed;
    });
  }
  const appLoading = (!profile && !error) || (Boolean(profile) && !workoutsReady);
  return (
    <>
      {appLoading && (
        <main className="loading-page loading-page--global">
          <LoadingState label="Preparando seu GymLog…" delayMs={0} />
        </main>
      )}
      <main
        className={`account-shell${appLoading ? ' account-shell--loading' : ''}${sidebarCollapsed ? ' account-shell--sidebar-collapsed' : ''}`}
      >
        <aside className="app-sidebar" data-collapsed={sidebarCollapsed || undefined}>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!sidebarCollapsed}
            onClick={toggleSidebar}
          >
            <span aria-hidden="true">{sidebarCollapsed ? '›' : '‹'}</span>
          </button>
          <a
            className="brand"
            href="/app"
            aria-label="GymLog"
            title={sidebarCollapsed ? 'GymLog' : undefined}
            onClick={(event) => navigate(event, '/app')}
          >
            <span className="brand-full">
              GYM<strong>LOG</strong>
            </span>
          </a>
          <nav aria-label="Menu principal">
            <a
              className="sidebar-tab sidebar-tab--active"
              href="/app"
              aria-label="Minhas fichas"
              aria-current="page"
              onClick={(event) => navigate(event, '/app')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                ▤
              </span>
              <span className="sidebar-label">Minhas fichas</span>
            </a>
          </nav>
          <button
            className="secondary-button"
            aria-label="Sair da conta"
            onClick={() =>
              navigationGuard.current ? navigationGuard.current(() => void logout()) : void logout()
            }
            disabled={busy}
          >
            <span className="sidebar-icon" aria-hidden="true">
              ↪
            </span>
            <span className="sidebar-label">{busy ? 'Saindo…' : 'Sair da conta'}</span>
            {busy && <LoadingState label="Saindo…" />}
          </button>
        </aside>
        <section className="account-content">
          <p className="eyebrow">SEU ESPAÇO</p>
          {profile && <h1>Olá, {profile.display_name}.</h1>}
          {error && (
            <div className="message error" role="alert">
              {error} <button onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button>
            </div>
          )}
          {profile && (
            <Workouts
              userId={profile.id}
              onInitialLoadComplete={handleWorkoutsReady}
              registerNavigationGuard={(guard) => {
                navigationGuard.current = guard;
              }}
            />
          )}
        </section>
      </main>
    </>
  );
}
