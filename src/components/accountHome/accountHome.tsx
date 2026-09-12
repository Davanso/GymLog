import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarDays, LogOut } from 'lucide-react';
import { auth } from '../../services/auth';
import { CoachPanel } from '../coachPanel/coachPanel';
import { CalendarPanel } from '../calendarPanel/calendarPanel';
import { LoadingState } from '../loadingState/loadingState';
import { ReportsPanel } from '../reportsPanel/reportsPanel';
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
  const touchStartX = useRef<number | null>(null);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [section, setSection] = useState<'workouts' | 'calendar' | 'reports' | 'coach'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('convite')
      ? 'coach'
      : params.get('secao') === 'relatorios'
        ? 'reports'
        : params.get('secao') === 'calendario'
          ? 'calendar'
          : 'workouts';
  });
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
  function changeSection(next: 'workouts' | 'calendar' | 'reports' | 'coach') {
    const change = () => {
      setSection(next);
      setMobileMenuOpen(false);
    };
    if (!navigationGuard.current) return change();
    navigationGuard.current(change);
  }
  function finishMenuSwipe(clientX: number) {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45) return;
    setMobileMenuOpen(distance > 0);
  }
  const appLoading = (!profile && !error) || (Boolean(profile) && !workoutsReady);
  return (
    <>
      {appLoading && (
        <main className="loading-page loading-page--global">
          <LoadingState label="Preparando seu GymLog…" delayMs={0} fullScreen />
        </main>
      )}
      <main
        className={`account-shell${appLoading ? ' account-shell--loading' : ''}${sidebarCollapsed ? ' account-shell--sidebar-collapsed' : ''}`}
      >
        <aside
          className="app-sidebar"
          data-collapsed={sidebarCollapsed || undefined}
          data-mobile-open={mobileMenuOpen || undefined}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => finishMenuSwipe(event.changedTouches[0]?.clientX ?? 0)}
          onTouchCancel={() => {
            touchStartX.current = null;
          }}
        >
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
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Recolher menu' : 'Expandir menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
          </button>
          <nav aria-label="Menu principal">
            <button
              type="button"
              className={`sidebar-tab${section === 'reports' ? ' sidebar-tab--active' : ''}`}
              aria-label="Relatórios"
              aria-current={section === 'reports' ? 'page' : undefined}
              onClick={() => changeSection('reports')}
            >
              <BarChart3 className="sidebar-icon" aria-hidden="true" size={19} />
              <span className="sidebar-label">Relatórios</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab${section === 'calendar' ? ' sidebar-tab--active' : ''}`}
              aria-label="Calendário"
              aria-current={section === 'calendar' ? 'page' : undefined}
              onClick={() => changeSection('calendar')}
            >
              <CalendarDays className="sidebar-icon" aria-hidden="true" size={19} />
              <span className="sidebar-label">Calendário</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab${section === 'workouts' ? ' sidebar-tab--active' : ''}`}
              aria-label="Minhas fichas"
              aria-current={section === 'workouts' ? 'page' : undefined}
              onClick={() => changeSection('workouts')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                ▤
              </span>
              <span className="sidebar-label">Minhas fichas</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab${section === 'coach' ? ' sidebar-tab--active' : ''}`}
              aria-label="Coach e alunos"
              aria-current={section === 'coach' ? 'page' : undefined}
              onClick={() => changeSection('coach')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                ◉
              </span>
              <span className="sidebar-label">Coach e alunos</span>
            </button>
          </nav>
          <button
            className="secondary-button"
            aria-label="Sair da conta"
            onClick={() =>
              navigationGuard.current ? navigationGuard.current(() => void logout()) : void logout()
            }
            disabled={busy}
          >
            <LogOut className="sidebar-icon" aria-hidden="true" size={19} strokeWidth={2.25} />
            <span className="sidebar-label">{busy ? 'Saindo…' : 'Sair da conta'}</span>
            {busy && <LoadingState label="Saindo…" compact />}
          </button>
        </aside>
        <section className="account-content">
          {profile && <h1>Olá, {profile.display_name}.</h1>}
          {error && (
            <div className="message error" role="alert">
              {error} <button onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button>
            </div>
          )}
          {profile && (
            <>
              <div hidden={section !== 'workouts'}>
                <Workouts
                  userId={profile.id}
                  onInitialLoadComplete={handleWorkoutsReady}
                  registerNavigationGuard={(guard) => {
                    navigationGuard.current = guard;
                  }}
                />
              </div>
              {section === 'coach' && <CoachPanel />}
              {section === 'calendar' && <CalendarPanel />}
              {section === 'reports' && <ReportsPanel />}
            </>
          )}
        </section>
      </main>
    </>
  );
}
