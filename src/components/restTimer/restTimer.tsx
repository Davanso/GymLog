import { useEffect, useRef, useState } from 'react';
import {
  extendClock,
  pauseClock,
  remainingMs,
  resumeClock,
  type RestClock,
} from '../sessionRunner/restClock';
import './restTimer.css';

export function RestTimer({
  clock,
  onChange,
}: {
  clock: RestClock | null;
  onChange: (clock: RestClock | null) => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const announced = useRef<string | null>(null);
  const remaining = clock ? Math.min(clock.remaining, remainingMs(clock, now)) : 0;
  useEffect(() => {
    if (!clock) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [clock]);
  useEffect(() => {
    if (!clock || remaining > 0) {
      announced.current = null;
      return;
    }
    if (announced.current === clock.setId) return;
    announced.current = clock.setId;
    const context = audio.current;
    if (sound && context?.state === 'running') {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.5);
    }
    onChange(null);
  }, [remaining, clock, sound, onChange]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  async function toggleSound() {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setSound(true);
    } catch {
      setSound(false);
    }
  }
  const seconds = Math.ceil(remaining / 1000);
  return (
    <aside className="rest-timer" aria-label="Descanso entre séries">
      <div>
        <p className="eyebrow">DESCANSO</p>
        <p role="status">
          {!clock
            ? 'Pronto para a próxima série'
            : remaining === 0
              ? 'Descanso concluído!'
              : clock.deadline === null
                ? 'Cronômetro pausado'
                : 'Respire. Você está indo bem.'}
        </p>
      </div>
      <div
        className="rest-timer__time"
        aria-label={`${Math.floor(seconds / 60)} minutos e ${seconds % 60} segundos`}
      >
        {String(Math.floor(seconds / 60)).padStart(2, '0')}
        <span>:</span>
        {String(seconds % 60).padStart(2, '0')}
      </div>
      <div className="workout-actions">
        {clock && remaining > 0 && (
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setNow(Date.now());
                onChange(clock.deadline === null ? resumeClock(clock) : pauseClock(clock));
              }}
            >
              {clock.deadline === null ? 'Retomar' : 'Pausar'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setNow(Date.now());
                onChange(extendClock(clock));
              }}
            >
              +30 s
            </button>
            <button type="button" className="text-button" onClick={() => onChange(null)}>
              Pular descanso
            </button>
          </>
        )}
        <button
          type="button"
          className="text-button"
          aria-pressed={sound}
          onClick={() => void toggleSound()}
        >
          Som {sound ? 'ligado' : 'desligado'}
        </button>
      </div>
    </aside>
  );
}
