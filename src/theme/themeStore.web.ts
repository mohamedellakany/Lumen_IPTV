const KEY = 'lumen-theme';

export function readThemeId(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeThemeId(id: string) {
  globalThis.localStorage?.setItem(KEY, id);
}
