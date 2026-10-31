export type CatalogKind = 'live' | 'movie' | 'series';

export interface Category {
  id: string;
  name: string;
}

export interface LiveChannel {
  kind: 'live';
  id: string;
  name: string;
  logo?: string;
  categoryId: string;
  epgId?: string;
  num?: number;
  hasArchive?: boolean;
  /** Full stream URL for M3U sources. Xtream URLs are built from credentials. */
  directUrl?: string;
}

export interface Movie {
  kind: 'movie';
  id: string;
  name: string;
  poster?: string;
  categoryId: string;
  rating?: number;
  ext?: string;
  added?: number;
  directUrl?: string;
}

export interface Series {
  kind: 'series';
  id: string;
  name: string;
  poster?: string;
  categoryId: string;
  rating?: number;
  plot?: string;
  genre?: string;
  year?: string;
  updated?: number;
}

export type CatalogItem = LiveChannel | Movie | Series;

export interface MovieInfo {
  id: string;
  name: string;
  poster?: string;
  backdrop?: string;
  plot?: string;
  genre?: string;
  cast?: string;
  director?: string;
  releaseDate?: string;
  durationSecs?: number;
  rating?: number;
  trailer?: string;
  ext?: string;
  directUrl?: string;
}

export interface Episode {
  id: string;
  title: string;
  season: number;
  episodeNum: number;
  ext?: string;
  plot?: string;
  image?: string;
  durationSecs?: number;
  directUrl?: string;
}

export interface Season {
  number: number;
  name: string;
  cover?: string;
  episodes: Episode[];
}

export interface SeriesInfo {
  id: string;
  name: string;
  poster?: string;
  backdrop?: string;
  plot?: string;
  genre?: string;
  cast?: string;
  director?: string;
  releaseDate?: string;
  rating?: number;
  trailer?: string;
  seasons: Season[];
}

export interface EpgEntry {
  title: string;
  description?: string;
  start: number;
  end: number;
}

export interface AccountInfo {
  username?: string;
  status?: string;
  expiresAt?: number | null;
  isTrial?: boolean;
  activeConnections?: number;
  maxConnections?: number;
  createdAt?: number;
  /** Item counts, for M3U sources where there's no account API. */
  summary?: string;
}

export type LiveFormat = 'm3u8' | 'ts';

export interface CatalogProvider {
  authenticate(): Promise<AccountInfo>;
  getLiveCategories(): Promise<Category[]>;
  getLiveStreams(): Promise<LiveChannel[]>;
  getMovieCategories(): Promise<Category[]>;
  getMovies(): Promise<Movie[]>;
  getSeriesCategories(): Promise<Category[]>;
  getSeries(): Promise<Series[]>;
  getMovieInfo(id: string): Promise<MovieInfo>;
  getSeriesInfo(id: string): Promise<SeriesInfo>;
  getShortEpg(channel: LiveChannel): Promise<EpgEntry[]>;
  liveUrl(channel: LiveChannel, format: LiveFormat): string;
  movieUrl(movie: { id: string; ext?: string; directUrl?: string }): string;
  episodeUrl(episode: Episode): string;
}

export type Profile =
  | {
      id: string;
      name: string;
      type: 'xtream';
      host: string;
      username: string;
      password: string;
      createdAt: number;
    }
  | {
      id: string;
      name: string;
      type: 'm3u';
      url: string;
      createdAt: number;
    };
