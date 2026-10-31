// Pure helpers with no runtime imports, so they can be unit-tested directly with Node.
import type { Category, Episode, LiveChannel, Movie, Series, SeriesInfo } from './types';

/** Accepts "host:port", "http://host:port/", ".../player_api.php" etc. and returns "http(s)://host:port". */
export function normalizeHost(input: string): string {
  let value = input.trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

/** Detects Xtream-style M3U links (get.php?username=..&password=..) so they can use the richer Xtream API. */
export function parseXtreamM3uUrl(input: string): { host: string; username: string; password: string } | null {
  try {
    const url = new URL(input.trim());
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    if (!/\/(get|player_api)\.php$/i.test(url.pathname) || !username || !password) return null;
    return { host: `${url.protocol}//${url.host}`, username, password };
  } catch {
    return null;
  }
}

export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/** Decodes base64 that contains UTF-8 text (Xtream EPG titles). Falls back to the raw input. */
export function decodeBase64(input?: string | null): string {
  if (!input) return '';
  try {
    const binary = globalThis.atob(input);
    let encoded = '';
    for (let i = 0; i < binary.length; i++) encoded += '%' + binary.charCodeAt(i).toString(16).padStart(2, '0');
    return decodeURIComponent(encoded);
  } catch {
    return input;
  }
}

const ADULT_PATTERN = /(adult|xxx|porn|\b18\s*\+|\+\s*18\b|for adults)/i;

export function isAdultCategory(name: string): boolean {
  return ADULT_PATTERN.test(name);
}

export function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

export function toStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s && s !== 'null' ? s : undefined;
}

/** Xtream timestamps are unix seconds, sometimes as strings. Returns milliseconds. */
export function toTimestampMs(value: unknown): number | undefined {
  const n = toNum(value);
  return n && n > 0 ? n * 1000 : undefined;
}

/** "Show Name S01E02" / "Show.Name.s1.e2" -> { series, season, episode } */
export function parseEpisodeName(name: string): { series: string; season: number; episode: number } | null {
  const match = name.match(/^(.*?)[\s._-]*S(\d{1,2})[\s._-]*E(\d{1,4})/i);
  if (!match) return null;
  const series = match[1].replace(/[._]+/g, ' ').replace(/[\s-]+$/, '').trim();
  if (!series) return null;
  return { series, season: parseInt(match[2], 10), episode: parseInt(match[3], 10) };
}

export interface ParsedM3U {
  liveCategories: Category[];
  live: LiveChannel[];
  movieCategories: Category[];
  movies: Movie[];
  seriesCategories: Category[];
  series: Series[];
  seriesInfo: Record<string, SeriesInfo>;
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) attrs[m[1].toLowerCase()] = m[2];
  return attrs;
}

/** Display name is the text after the last comma that is not inside a quoted attribute. */
function parseDisplayName(line: string): string {
  let inQuotes = false;
  let lastComma = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ',' && !inQuotes) lastComma = i;
  }
  return lastComma >= 0 ? line.slice(lastComma + 1).trim() : '';
}

const VOD_EXTENSION = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)(\?|$)/i;

export function classifyM3UEntry(url: string): 'live' | 'movie' | 'series' {
  if (/\/series\//i.test(url)) return 'series';
  if (/\/movie\//i.test(url)) return 'movie';
  if (VOD_EXTENSION.test(url)) return 'movie';
  return 'live';
}

export function parseM3U(text: string): ParsedM3U {
  const result: ParsedM3U = {
    liveCategories: [],
    live: [],
    movieCategories: [],
    movies: [],
    seriesCategories: [],
    series: [],
    seriesInfo: {},
  };
  const categorySets = { live: new Set<string>(), movie: new Set<string>(), series: new Set<string>() };
  const lines = text.split(/\r?\n/);
  let pending: { name: string; attrs: Record<string, string>; group?: string } | null = null;
  let liveNum = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttributes(line);
      pending = { name: parseDisplayName(line) || attrs['tvg-name'] || 'Untitled', attrs };
      continue;
    }
    if (line.startsWith('#EXTGRP:')) {
      if (pending) pending.group = line.slice(8).trim();
      continue;
    }
    if (line.startsWith('#')) continue;
    if (!pending) continue;

    const url = line;
    const { name, attrs } = pending;
    const group = pending.group || attrs['group-title'] || 'Uncategorized';
    const logo = attrs['tvg-logo'] || undefined;
    pending = null;

    const kind = classifyM3UEntry(url);
    if (kind === 'series') {
      const parsed = parseEpisodeName(name);
      if (parsed) {
        const seriesId = hashString(`${group}|${parsed.series.toLowerCase()}`);
        let info = result.seriesInfo[seriesId];
        if (!info) {
          info = { id: seriesId, name: parsed.series, poster: logo, seasons: [] };
          result.seriesInfo[seriesId] = info;
          result.series.push({ kind: 'series', id: seriesId, name: parsed.series, poster: logo, categoryId: group });
          categorySets.series.add(group);
        }
        let season = info.seasons.find((s) => s.number === parsed.season);
        if (!season) {
          season = { number: parsed.season, name: `Season ${parsed.season}`, episodes: [] };
          info.seasons.push(season);
        }
        const episode: Episode = {
          id: hashString(url),
          title: name,
          season: parsed.season,
          episodeNum: parsed.episode,
          image: logo,
          directUrl: url,
        };
        season.episodes.push(episode);
        continue;
      }
      // Unparseable episode names are treated as standalone movies.
    }
    if (kind === 'movie' || kind === 'series') {
      categorySets.movie.add(group);
      result.movies.push({ kind: 'movie', id: hashString(url), name, poster: logo, categoryId: group, directUrl: url });
    } else {
      categorySets.live.add(group);
      liveNum++;
      result.live.push({
        kind: 'live',
        id: hashString(url),
        name,
        logo,
        categoryId: group,
        epgId: attrs['tvg-id'] || undefined,
        num: toNum(attrs['tvg-chno']) ?? liveNum,
        directUrl: url,
      });
    }
  }

  for (const info of Object.values(result.seriesInfo)) {
    info.seasons.sort((a, b) => a.number - b.number);
    for (const season of info.seasons) season.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
  }
  const toCategories = (set: Set<string>): Category[] => [...set].map((name) => ({ id: name, name }));
  result.liveCategories = toCategories(categorySets.live);
  result.movieCategories = toCategories(categorySets.movie);
  result.seriesCategories = toCategories(categorySets.series);
  return result;
}

/** The human-readable part of an HTML/text reply: its <title>, else the visible body text. */
export function readableText(html: string): string {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const text = title
    ? title
    : html
        .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<head[\s\S]*$/i, ' ')
        .replace(/<[^>]*>?/g, ' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim().slice(0, 160);
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : entity;
  });
}

/**
 * True when a reply is a block page from a web-safety filter (router security, ISP "advanced security",
 * filtering DNS, parental controls) rather than from the IPTV server. Panels often keep VOD files on
 * separate storage hosts, so a filter that flags one of them breaks only some titles.
 */
export function isNetworkFilterPage(text: string): boolean {
  return /suspicious (site|website|page)|site (was |has been )?blocked|blocked because it may|unsafe (content|site|website)|malicious (site|website|content)|phishing|web ?filter|content filter|parental control|safe ?browsing|security (filter|threat)|blocked by (your )?(network|administrator|router|isp|internet provider)|access to this (site|page|website) (is|has been|was) (blocked|denied|restricted)/i.test(
    text,
  );
}

const FILTER_HOSTS = /(^|\.)(cujo\.io|charter\.com|spectrum\.(com|net)|w3\.org)$/i;

const hostOfUrl = (value: string): string | null => value.match(/^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:[/?#]|$)/i)?.[1] ?? null;

/**
 * Which site a web filter blocked, from its block page's URL (filters usually pass it as a query
 * parameter) or its HTML. The block page's own host is not the answer: allowing it changes nothing.
 */
export function blockedSiteFromFilter(blockPageUrl: string, html: string): string | null {
  const candidates: string[] = [];
  const query = blockPageUrl.split('?')[1]?.split('#')[0] ?? '';
  for (const pair of query.split('&')) {
    const value = pair.slice(pair.indexOf('=') + 1);
    try {
      candidates.push(decodeURIComponent(value.replace(/\+/g, ' ')));
    } catch {
      candidates.push(value);
    }
  }
  for (const m of html.matchAll(/\b(?:url|site|domain|host|blocked)["']?\s*[:=]\s*["']?((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?)/gi)) {
    candidates.push(m[1]);
  }
  for (const c of candidates) {
    const host = hostOfUrl(c.trim());
    if (host && /[a-z]/i.test(host.split('.').pop() ?? '') && !FILTER_HOSTS.test(host)) return host;
    if (host && /^\d+(\.\d+){3}$/.test(host)) return host;
  }
  return null;
}

/** A friendly name for known ISP web filters, from the block page's address. */
export function networkFilterName(blockPageUrl: string): string | null {
  const host = hostOfUrl(blockPageUrl) ?? '';
  if (/charter|spectrum/i.test(host)) return 'Spectrum Security Shield';
  if (/cujo/i.test(host)) return 'your router\'s security filter';
  return null;
}
