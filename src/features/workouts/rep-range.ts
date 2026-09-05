export type RepRange = { min: number; max: number };

export function parseRepRange(value: string): RepRange | null {
  const text = value.trim().toLowerCase();
  const match = text.match(/^(?:de\s+)?(\d+)\s*(?:-|–|a)\s*(\d+)$/);
  const single = text.match(/^(\d+)$/);
  const min = Number(match?.[1] ?? single?.[1]);
  const max = Number(match?.[2] ?? single?.[1]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 1000 || max < min)
    return null;
  return { min, max };
}

export function formatRepRange(min: number | null, max: number | null) {
  if (min === null) return '';
  return max && max !== min ? `${min}-${max}` : String(min);
}
