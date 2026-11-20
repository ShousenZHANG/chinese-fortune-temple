// Interface language (spec story 10). The interface is Chinese or English; everything the Skill writes, and every
// classical text, stays Chinese, since a translation would no longer be the text the citation points to.
// Views call tr() while they render, so switching language re-renders the current view.
export type Lang = 'zh' | 'en';

const KEY = 'temple.lang';
export const LANG_EVENT = 'temple:lang';

function initial(): Lang {
  try {
    const kept = localStorage.getItem(KEY);
    if (kept === 'zh' || kept === 'en') return kept;
  } catch {
    // Fall back to the browser's language.
  }
  return (navigator.languages?.[0] ?? navigator.language ?? 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang: Lang = initial();

export const currentLang = (): Lang => lang;

/** The interface text in the current language. */
export const tr = (zh: string, en: string): string => (lang === 'en' ? en : zh);

export function applyLang(): void {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.title = tr('有据山寺', 'Chinese Fortune Temple · 有据山寺');
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // The choice holds for this page.
  }
  applyLang();
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: next }));
}

const PLACES: Record<string, string> = {
  求签殿: 'Coin Hall', 月老殿: 'Matchmaker Hall', 问心堂: 'Hall of Questions', 紫微殿: 'Purple Star Hall',
  黄历亭: 'Almanac Pavilion', 许愿树: 'Wish Tree', 香客簿: 'Pilgrim Book', 缘起: 'Sources', 山门: 'Gate',
};

/** A hall or place name: Chinese, or its English name. */
export const placeName = (zh: string): string => tr(zh, PLACES[zh] ?? zh);
