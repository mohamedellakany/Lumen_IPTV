import { ApiError, fetchJson } from './http';
import { decodeBase64, toNum, toStr, toTimestampMs } from './parsers';
import type {
  AccountInfo,
  CatalogProvider,
  Category,
  EpgEntry,
  Episode,
  LiveChannel,
  LiveFormat,
  Movie,
  MovieInfo,
  Series,
  SeriesInfo,
} from './types';

type Raw = Record<string, any>;

const asArray = (value: unknown): Raw[] => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []);
const firstOf = (value: unknown): string | undefined => (Array.isArray(value) ? toStr(value[0]) : toStr(value));

export class XtreamProvider implements CatalogProvider {
  constructor(
    private host: string,
    private username: string,
    private password: string,
  ) {}

  private api<T = Raw>(params: Record<string, string> = {}): Promise<T> {
    const query = new URLSearchParams({ username: this.username, password: this.password, ...params });
    return fetchJson<T>(`${this.host}/player_api.php?${query}`);
  }

  private get credentials() {
    return `${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}`;
  }

  async authenticate(): Promise<AccountInfo> {
    const data = await this.api();
    const user = data?.user_info;
    if (!user || Number(user.auth) === 0) throw new ApiError('Invalid username or password.');
    const status = toStr(user.status);
    if (status && status.toLowerCase() !== 'active') throw new ApiError(`Your account is ${status.toLowerCase()}.`);
    return {
      username: toStr(user.username),
      status,
      expiresAt: toTimestampMs(user.exp_date) ?? null,
      isTrial: String(user.is_trial) === '1',
      activeConnections: toNum(user.active_cons),
      maxConnections: toNum(user.max_connections),
      createdAt: toTimestampMs(user.created_at),
    };
  }

  private async categories(action: string): Promise<Category[]> {
    const data = await this.api<unknown>({ action });
    return asArray(data)
      .map((c) => ({ id: String(c.category_id), name: toStr(c.category_name) ?? 'Untitled' }))
      .filter((c) => c.id !== 'undefined');
  }

  getLiveCategories = () => this.categories('get_live_categories');
  getMovieCategories = () => this.categories('get_vod_categories');
  getSeriesCategories = () => this.categories('get_series_categories');

  async getLiveStreams(): Promise<LiveChannel[]> {
    const data = await this.api<unknown>({ action: 'get_live_streams' });
    return asArray(data).map((s) => ({
      kind: 'live',
      id: String(s.stream_id),
      name: toStr(s.name) ?? 'Untitled',
      logo: toStr(s.stream_icon),
      categoryId: String(s.category_id ?? ''),
      epgId: toStr(s.epg_channel_id),
      num: toNum(s.num),
      hasArchive: String(s.tv_archive) === '1',
    }));
  }

  async getMovies(): Promise<Movie[]> {
    const data = await this.api<unknown>({ action: 'get_vod_streams' });
    return asArray(data).map((s) => ({
      kind: 'movie',
      id: String(s.stream_id),
      name: toStr(s.name) ?? 'Untitled',
      poster: toStr(s.stream_icon),
      categoryId: String(s.category_id ?? ''),
      rating: toNum(s.rating_5based) ? toNum(s.rating_5based)! * 2 : toNum(s.rating),
      ext: toStr(s.container_extension),
      added: toTimestampMs(s.added),
    }));
  }

  async getSeries(): Promise<Series[]> {
    const data = await this.api<unknown>({ action: 'get_series' });
    return asArray(data).map((s) => ({
      kind: 'series',
      id: String(s.series_id),
      name: toStr(s.name) ?? 'Untitled',
      poster: toStr(s.cover),
      categoryId: String(s.category_id ?? ''),
      rating: toNum(s.rating_5based) ? toNum(s.rating_5based)! * 2 : toNum(s.rating),
      plot: toStr(s.plot),
      genre: toStr(s.genre),
      year: toStr(s.releaseDate ?? s.release_date)?.slice(0, 4),
      updated: toTimestampMs(s.last_modified),
    }));
  }

  async getMovieInfo(id: string): Promise<MovieInfo> {
    const data = await this.api({ action: 'get_vod_info', vod_id: id });
    const info: Raw = data?.info && !Array.isArray(data.info) ? data.info : {};
    const movie: Raw = data?.movie_data ?? {};
    return {
      id,
      name: toStr(movie.name) ?? toStr(info.name) ?? 'Untitled',
      poster: toStr(info.movie_image) ?? toStr(info.cover_big),
      backdrop: firstOf(info.backdrop_path),
      plot: toStr(info.plot) ?? toStr(info.description),
      genre: toStr(info.genre),
      cast: toStr(info.cast) ?? toStr(info.actors),
      director: toStr(info.director),
      releaseDate: toStr(info.releasedate) ?? toStr(info.release_date),
      durationSecs: toNum(info.duration_secs),
      rating: toNum(info.rating),
      trailer: toStr(info.youtube_trailer),
      ext: toStr(movie.container_extension),
    };
  }

  async getSeriesInfo(id: string): Promise<SeriesInfo> {
    const data = await this.api({ action: 'get_series_info', series_id: id });
    const info: Raw = data?.info ?? {};
    const seasonMeta = new Map<number, Raw>(asArray(data?.seasons).map((s) => [Number(s.season_number), s]));

    const bySeason = new Map<number, Episode[]>();
    const episodeGroups = data?.episodes ?? {};
    for (const [seasonKey, list] of Object.entries(episodeGroups)) {
      for (const e of asArray(list)) {
        const season = toNum(e.season) ?? toNum(seasonKey) ?? 1;
        const episode: Episode = {
          id: String(e.id),
          title: toStr(e.title) ?? `Episode ${e.episode_num}`,
          season,
          episodeNum: toNum(e.episode_num) ?? 0,
          ext: toStr(e.container_extension),
          plot: toStr(e.info?.plot),
          image: toStr(e.info?.movie_image),
          durationSecs: toNum(e.info?.duration_secs),
        };
        bySeason.set(season, [...(bySeason.get(season) ?? []), episode]);
      }
    }

    return {
      id,
      name: toStr(info.name) ?? 'Untitled',
      poster: toStr(info.cover),
      backdrop: firstOf(info.backdrop_path),
      plot: toStr(info.plot),
      genre: toStr(info.genre),
      cast: toStr(info.cast),
      director: toStr(info.director),
      releaseDate: toStr(info.releaseDate) ?? toStr(info.release_date),
      rating: toNum(info.rating),
      trailer: toStr(info.youtube_trailer),
      seasons: [...bySeason.entries()]
        .sort(([a], [b]) => a - b)
        .map(([number, episodes]) => ({
          number,
          name: toStr(seasonMeta.get(number)?.name) ?? `Season ${number}`,
          cover: toStr(seasonMeta.get(number)?.cover),
          episodes: episodes.sort((a, b) => a.episodeNum - b.episodeNum),
        })),
    };
  }

  async getShortEpg(channel: LiveChannel): Promise<EpgEntry[]> {
    const data = await this.api({ action: 'get_short_epg', stream_id: channel.id, limit: '4' });
    return asArray(data?.epg_listings)
      .map((e) => ({
        title: decodeBase64(e.title),
        description: decodeBase64(e.description),
        start: toTimestampMs(e.start_timestamp) ?? Date.parse(e.start),
        end: toTimestampMs(e.stop_timestamp) ?? Date.parse(e.end ?? e.stop),
      }))
      .filter((e) => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > Date.now());
  }

  liveUrl(channel: LiveChannel, format: LiveFormat): string {
    return `${this.host}/live/${this.credentials}/${channel.id}.${format}`;
  }

  movieUrl(movie: { id: string; ext?: string }): string {
    return `${this.host}/movie/${this.credentials}/${movie.id}.${movie.ext || 'mp4'}`;
  }

  episodeUrl(episode: Episode): string {
    return `${this.host}/series/${this.credentials}/${episode.id}.${episode.ext || 'mp4'}`;
  }
}
