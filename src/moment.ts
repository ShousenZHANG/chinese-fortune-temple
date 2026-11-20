// "Now" for the Skill comes from here, never from the worker (spec: the visitor confirms the time zone once).
const KEY = 'temple.timezone';

export function guessedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
}

export function confirmedTimezone(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function confirmTimezone(timezone: string): void {
  try {
    localStorage.setItem(KEY, timezone);
  } catch {
    // Storage blocked: the choice still holds for this page.
  }
}

export function timezones(): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return all.length ? all : [guessedTimezone()];
}

/** Wall-clock date and minute in the given zone, in the shapes the Skill's --date and --time take. */
export function localMoment(timezone: string, now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
