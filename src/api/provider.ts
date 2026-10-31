import { M3UProvider } from './m3u';
import type { CatalogProvider, Profile } from './types';
import { XtreamProvider } from './xtream';

export function createProvider(profile: Profile): CatalogProvider {
  return profile.type === 'xtream'
    ? new XtreamProvider(profile.host, profile.username, profile.password)
    : new M3UProvider(profile.url);
}
