// A 签文卡 hands its title and question to 许愿树 for one wish (spec story 46). Kept for this tab only.
import type { Wish } from './wish';

const KEY = 'temple.wish-source';
type Source = NonNullable<Wish['source']>;

export function rememberSource(source: Source): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(source));
  } catch {
    // Storage blocked: the wish is still made, without its card.
  }
}

/** The card waiting for a wish, if any; reading it does not clear it, so a reload keeps it until the wish is made. */
export function pendingSource(): Source | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<Source> | null;
    return raw && typeof raw.title === 'string' && typeof raw.question === 'string'
      ? { title: raw.title, question: raw.question } : null;
  } catch {
    return null;
  }
}

export function forgetSource(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept, nothing to forget.
  }
}
