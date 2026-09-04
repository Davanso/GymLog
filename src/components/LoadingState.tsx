import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import './LoadingState.css';

type LoadingStateProps = { label?: string };

export function LoadingState({ label = 'Abrindo seu GymLog…' }: LoadingStateProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return createPortal(
    <span className="gym-loading" role="status" aria-live="polite">
      <span className="gym-loading__stage" aria-hidden="true">
        <span className="gym-loading__shadow" />
        <span className="gym-loading__jump">
          <svg className="gym-loading__weight" viewBox="0 0 80 48" fill="none" focusable="false">
            <rect x="18" y="20" width="44" height="8" rx="3" fill="currentColor" />
            <rect x="6" y="12" width="9" height="24" rx="3" fill="currentColor" />
            <rect x="15" y="5" width="13" height="38" rx="4" fill="currentColor" />
            <rect x="52" y="5" width="13" height="38" rx="4" fill="currentColor" />
            <rect x="65" y="12" width="9" height="24" rx="3" fill="currentColor" />
            <path d="M34 22v4m6-4v4m6-4v4" stroke="var(--paper)" strokeWidth="1.5" opacity=".6" />
          </svg>
        </span>
      </span>
      <span className="gym-loading__label">{label}</span>
    </span>,
    document.body,
  );
}
