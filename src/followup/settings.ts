// The visitor's own model provider and key (spec stories 61, 62), kept in this browser only and removable at once.
// Read through parseProvider, so a hand-edited or stale entry is ignored rather than sent anywhere.
export type Provider =
  | { kind: 'anthropic'; key: string }
  | { kind: 'openai'; key: string; baseUrl: string; model: string };

const KEY = 'temple.llm';

/** An https endpoint, or http on this machine for local testing. */
export const validEndpoint = (url: string): boolean => /^https:\/\/[^\s/]+/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(`${url}/`);

export function parseProvider(raw: unknown): Provider | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  const key = typeof value.key === 'string' ? value.key.trim() : '';
  if (!key) return null;
  if (value.kind === 'anthropic') return { kind: 'anthropic', key };
  if (value.kind !== 'openai') return null;
  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim().replace(/\/+$/, '') : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  return validEndpoint(baseUrl) && model ? { kind: 'openai', key, baseUrl, model } : null;
}

export function loadProvider(): Provider | null {
  try {
    return parseProvider(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function saveProvider(provider: Provider): void {
  localStorage.setItem(KEY, JSON.stringify(provider));
}

export function deleteProvider(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
}
