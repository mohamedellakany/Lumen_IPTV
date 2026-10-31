import type { ImperativeRouter as Router } from 'expo-router';

import type { MediaRef } from '@/store/library';

/** Opens a catalog item or library entry: channels/episodes go straight to the player, VOD opens details. */
export function openMedia(router: Router, ref: Pick<MediaRef, 'kind' | 'id' | 'seriesId'>) {
  switch (ref.kind) {
    case 'live':
      router.push({ pathname: '/player', params: { kind: 'live', id: ref.id } });
      break;
    case 'movie':
      router.push({ pathname: '/movie/[id]', params: { id: ref.id } });
      break;
    case 'series':
      router.push({ pathname: '/series/[id]', params: { id: ref.id } });
      break;
    case 'episode':
      router.push({ pathname: '/player', params: { kind: 'episode', id: ref.id, seriesId: ref.seriesId ?? '' } });
      break;
  }
}
