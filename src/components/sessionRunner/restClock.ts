export type RestClock = { deadline: number | null; remaining: number; setId: string };
export function remainingMs(clock: RestClock, now = Date.now()) {
  return Math.max(0, clock.deadline === null ? clock.remaining : clock.deadline - now);
}
export function hasActiveRest(clock: RestClock | null, now = Date.now()) {
  return Boolean(clock && remainingMs(clock, now) > 0);
}
export function pauseClock(clock: RestClock, now = Date.now()): RestClock {
  return { ...clock, remaining: remainingMs(clock, now), deadline: null };
}
export function resumeClock(clock: RestClock, now = Date.now()): RestClock {
  return { ...clock, deadline: now + clock.remaining };
}
export function extendClock(clock: RestClock, now = Date.now()): RestClock {
  const remaining = remainingMs(clock, now) + 30000;
  return { ...clock, remaining, deadline: clock.deadline === null ? null : now + remaining };
}
export function readClock(key: string): RestClock | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (
      !value ||
      typeof value.setId !== 'string' ||
      !Number.isFinite(value.remaining) ||
      value.remaining < 0 ||
      value.remaining > 86400000 ||
      !(value.deadline === null || Number.isFinite(value.deadline))
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function startClock(setId: string, seconds: number): RestClock {
  return { setId, remaining: seconds * 1000, deadline: Date.now() + seconds * 1000 };
}
