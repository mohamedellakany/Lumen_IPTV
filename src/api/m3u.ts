import { ApiError, fetchText } from './http';
import { parseM3U, type ParsedM3U } from './parsers';
import type { AccountInfo, CatalogProvider, Episode, LiveChannel, MovieInfo, SeriesInfo } from './types';

const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<ParsedM3U> }>();

/** Forget the parsed playlist so the next load downloads it again (used by "Refresh"). */
export function clearM3UCache(url?: string) {
  if (url) cache.delete(url);
  else cache.clear();
}

/** Plain M3U playlists: everything comes from one file, parsed once and shared by all catalog calls. */
export class M3UProvider implements CatalogProvider {
  constructor(private url: string) {}

  private load(force = false): Promise<ParsedM3U> {
    const hit = cache.get(this.url);
    if (hit && !force && Date.now() - hit.at < CACHE_TTL) return hit.promise;
    const promise = fetchText(this.url, 120_000).then((text) => {
      if (!text.trimStart().startsWith('#EXTM3U') && !text.includes('#EXTINF')) {
        throw new ApiError('This URL does not point to a valid M3U playlist.');
      }
      return parseM3U(text);
    });
    promise.catch(() => cache.delete(this.url));
    cache.set(this.url, { at: Date.now(), promise });
    return promise;
  }

  async authenticate(): Promise<AccountInfo> {
    const data = await this.load(true);
    const total = data.live.length + data.movies.length + data.series.length;
    if (total === 0) throw new ApiError('The playlist is empty.');
    return {
      status: 'Active',
      expiresAt: null,
      summary: `${data.live.length} channels · ${data.movies.length} movies · ${data.series.length} series`,
    };
  }

  getLiveCategories = async () => (await this.load()).liveCategories;
  getLiveStreams = async () => (await this.load()).live;
  getMovieCategories = async () => (await this.load()).movieCategories;
  getMovies = async () => (await this.load()).movies;
  getSeriesCategories = async () => (await this.load()).seriesCategories;
  getSeries = async () => (await this.load()).series;

  async getMovieInfo(id: string): Promise<MovieInfo> {
    const movie = (await this.load()).movies.find((m) => m.id === id);
    if (!movie) throw new ApiError('Movie not found in playlist.');
    return { id, name: movie.name, poster: movie.poster, directUrl: movie.directUrl };
  }

  async getSeriesInfo(id: string): Promise<SeriesInfo> {
    const info = (await this.load()).seriesInfo[id];
    if (!info) throw new ApiError('Series not found in playlist.');
    return info;
  }

  async getShortEpg() {
    return [];
  }

  liveUrl(channel: LiveChannel): string {
    return channel.directUrl ?? '';
  }

  movieUrl(movie: { directUrl?: string }): string {
    return movie.directUrl ?? '';
  }

  episodeUrl(episode: Episode): string {
    return episode.directUrl ?? '';
  }
}
