import { File, Paths } from 'expo-file-system';

// The theme is read synchronously at startup, before any style is created, so it lives in a tiny file
// rather than the async app settings.
const file = () => new File(Paths.document, 'theme.txt');

export function readThemeId(): string | null {
  try {
    const f = file();
    return f.exists ? f.textSync().trim() : null;
  } catch {
    return null;
  }
}

export function writeThemeId(id: string) {
  const f = file();
  if (!f.exists) f.create();
  f.writeSync(id);
}
