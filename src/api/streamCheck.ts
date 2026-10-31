import { Platform } from 'react-native';

import { proxify } from './http';
import { blockedSiteFromFilter, isNetworkFilterPage, networkFilterName, readableText } from './parsers';

/**
 * Many IPTV panels only serve video to players they recognise and answer anything else with an error
 * page. VLC is accepted almost everywhere, so the app identifies itself the same way (the web dev proxy
 * already does).
 */
export const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';

export interface StreamProblem {
  /** Plain-language explanation for the viewer. */
  message: string;
  /** Raw technical detail, shown small for troubleshooting. */
  detail?: string;
}

const VIDEO_TYPES = /^(video\/|audio\/|application\/(octet-stream|vnd\.apple\.mpegurl|x-mpegurl|dash\+xml|mp4))/i;

/** Turns a raw player error into something a viewer can act on. */
export function describePlayerError(raw: string): StreamProblem {
  if (/extractor|UnrecognizedInputFormat|could read the stream|NoDeclaredBrand/i.test(raw)) {
    return {
      message: "The server didn't send a playable video for this title. It may be temporarily unavailable or missing on the server.",
      detail: raw,
    };
  }
  if (/\b(403|401)\b|Response code: 40[13]/i.test(raw)) {
    return { message: 'The server refused this video. Your subscription may have reached its connection limit.', detail: raw };
  }
  if (/\b404\b|Response code: 404/i.test(raw)) return { message: 'This video was not found on the server.', detail: raw };
  if (/decoder|codec|MediaCodec|NO_EXCEEDS_CAPABILITIES|format_supported=NO/i.test(raw)) {
    return { message: "This device can't decode this video's format.", detail: raw };
  }
  if (/timeout|Unable to connect|UnknownHost|network/i.test(raw)) {
    return { message: 'Could not reach the server. Check your internet connection and try again.', detail: raw };
  }
  return { message: 'This video could not be played.', detail: raw };
}

/**
 * Downloads the first bytes of a stream to see what the server actually returns, so a failure can be
 * explained (connection limit, expired account, missing file…). Returns null if nothing conclusive.
 */
export async function checkStream(url: string): Promise<StreamProblem | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const headers: Record<string, string> = { Range: 'bytes=0-2047' };
    if (Platform.OS !== 'web') headers['User-Agent'] = PLAYER_USER_AGENT;
    const res = await fetch(proxify(url), { headers, signal: controller.signal });
    const type = res.headers.get('content-type') ?? '';
    if (res.status === 401 || res.status === 403) {
      return { message: 'The server refused this video. Your subscription may have reached its connection limit, or the account may be blocked.', detail: `HTTP ${res.status}` };
    }
    if (res.status === 404) return { message: 'This video was not found on the server. The provider may have removed it.', detail: 'HTTP 404' };
    if (res.status === 458 || res.status === 509 || res.status === 429) {
      return { message: 'Your subscription has reached its connection limit. Stop watching on another device and try again.', detail: `HTTP ${res.status}` };
    }
    if (res.status >= 500) return { message: 'The server is having problems right now. Try again in a few minutes.', detail: `HTTP ${res.status}` };
    if (!res.ok) return { message: `The server rejected the request (error ${res.status}).`, detail: `HTTP ${res.status}` };

    if (VIDEO_TYPES.test(type)) return null;
    const text = (await res.text()).slice(0, 4000);
    const snippet = readableText(text);
    // Checked first: these pages say "blocked", which would otherwise read as a blocked account.
    // The response URL is the filter's block page (after its redirect), not the blocked server.
    const blockPage = Platform.OS !== 'web' ? res.url : '';
    if (isNetworkFilterPage(text) || /cujo\.io|charter|spectrum/i.test(streamHost(blockPage, ''))) {
      const filter = networkFilterName(blockPage);
      const site = blockedSiteFromFilter(blockPage, text);
      return {
        message:
          filter === 'Spectrum Security Shield'
            ? "Spectrum's Security Shield blocked this video, not your IPTV provider. In the My Spectrum app, open Security Shield and allow this site, or turn Security Shield off, then retry."
            : "Your home network's security filter blocked this video, not your IPTV provider. Allow this site in your router or internet provider's security settings (or turn the filter off for this device), then retry.",
        detail: site ? `Blocked site: ${site}` : `Blocked by ${filter ?? streamHost(blockPage, url)}`,
      };
    }
    if (/max.*conn|connection limit|too many/i.test(text)) {
      return { message: 'Your subscription has reached its connection limit. Stop watching on another device and try again.', detail: snippet };
    }
    if (/expired|suspend|banned|disabled|account[^.]{0,40}blocked|blocked[^.]{0,40}account/i.test(text)) {
      return { message: 'The server says this account is expired or blocked.', detail: snippet };
    }
    if (/^\s*$/.test(text)) return { message: 'The server sent an empty reply instead of the video.', detail: type || 'empty response' };
    if (/text|html|json/i.test(type) || /^\s*[<{]/.test(text)) {
      return {
        message: "This title isn't available on the server right now. The provider may have removed it or it may be temporarily broken.",
        detail: snippet ? `Server page: ${snippet}` : type,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Host the stream was served from after redirects (panels often redirect VOD to a storage server). */
function streamHost(finalUrl: string, requestedUrl: string): string {
  // On web every request goes through the dev proxy, so only the requested URL is meaningful there.
  const url = Platform.OS !== 'web' && finalUrl ? finalUrl : requestedUrl;
  return url.match(/^\w+:\/\/([^/?#]+)/)?.[1] ?? url;
}

async function isPlayable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = { Range: 'bytes=0-1023' };
    if (Platform.OS !== 'web') headers['User-Agent'] = PLAYER_USER_AGENT;
    const res = await fetch(proxify(url), { headers, signal: controller.signal });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    if (/text|html|json/i.test(type)) return false;
    if (VIDEO_TYPES.test(type)) return true;
    // Unknown type: accept if it doesn't look like a web page.
    const start = (await res.text()).slice(0, 64);
    return !/^\s*[<{]/.test(start);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const VOD_EXTENSIONS = ['mp4', 'mkv', 'avi', 'm3u8', 'ts'];

/**
 * Some panels list a title with the wrong container extension (e.g. .mkv while the file is .mp4) and
 * answer the wrong one with a web page. Try the other common extensions, like IPTV Smarters does.
 * Returns a working URL, or null.
 */
export async function findAlternativeStream(url: string): Promise<string | null> {
  const match = url.match(/^(.*\/(?:movie|series)\/[^/]+\/[^/]+\/[^/.]+)\.(\w+)$/);
  if (!match) return null;
  const [, base, current] = match;
  for (const ext of VOD_EXTENSIONS) {
    if (ext === current.toLowerCase()) continue;
    const candidate = `${base}.${ext}`;
    if (await isPlayable(candidate)) return candidate;
  }
  return null;
}
