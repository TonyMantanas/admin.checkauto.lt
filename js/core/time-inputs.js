function pad2(value) {
  return String(value).padStart(2, '0');
}

export function normalizeTimeToStep(value, stepMinutes = 15) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  const step = Number(stepMinutes);
  if (!match || !Number.isInteger(step) || step < 1 || step > 60) return String(value || '');

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return String(value || '');

  const rounded = Math.round((hours * 60 + minutes) / step) * step;
  const normalized = Math.max(0, Math.min(24 * 60 - step, rounded));
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}
