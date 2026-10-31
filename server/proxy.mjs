#!/usr/bin/env node
// Local development proxy for testing the app in a browser.
//
// IPTV servers don't send CORS headers, so browsers refuse to read their API responses or HLS
// playlists. This proxy fetches on the browser's behalf, adds CORS headers, follows redirects,
// rewrites HLS playlists so segment URLs also go through the proxy, and streams video with Range
// support so seeking works. The native iOS/Android apps don't need it.
//
// Usage: npm run proxy            (listens on http://127.0.0.1:8787)
//        PORT=9000 HOST=0.0.0.0 npm run proxy   (expose on your LAN, e.g. to test from a phone browser)

import http from 'node:http';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const USER_AGENT = process.env.PROXY_USER_AGENT ?? 'VLC/3.0.20 LibVLC/3.0.20';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
};

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

const isHlsPlaylist = (text) => text.trimStart().startsWith('#EXTM3U') && text.includes('#EXT-X-');

function rewritePlaylist(text, baseUrl, proxyBase) {
  const wrap = (uri) => `${proxyBase}${encodeURIComponent(new URL(uri, baseUrl).toString())}`;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${wrap(uri)}"`);
      return wrap(trimmed);
    })
    .join('\n');
}

function sendError(res, status, message) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (url.pathname !== '/proxy') return sendError(res, 404, 'Not found');

  const target = url.searchParams.get('url');
  let targetUrl;
  try {
    targetUrl = new URL(target ?? '');
    if (!['http:', 'https:'].includes(targetUrl.protocol)) throw new Error();
  } catch {
    return sendError(res, 400, 'Missing or invalid "url" parameter');
  }

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
    if (req.headers.range) headers.Range = req.headers.range;
    // Follow redirects by hand so the log shows where the video really came from (panels redirect
    // VOD to storage servers, and ISP web filters redirect blocked sites to their own block page).
    const hops = [];
    let upstream;
    let current = targetUrl;
    for (let i = 0; ; i++) {
      upstream = await fetch(current, { headers, redirect: 'manual', signal: controller.signal });
      const location = upstream.headers.get('location');
      if (upstream.status < 300 || upstream.status >= 400 || !location || i === 10) break;
      hops.push(`${upstream.status}→${new URL(location, current).host}`);
      current = new URL(location, current);
    }
    const finalUrl = current.toString();
    const contentType = upstream.headers.get('content-type') ?? '';
    const looksLikePlaylist = /mpegurl/i.test(contentType) || /\.m3u8?(\?|$)/i.test(finalUrl) || /\.m3u8?(\?|$)/i.test(targetUrl.pathname);

    const type = contentType ? contentType.split(';')[0] : 'no content-type';
    log(req.method, upstream.status, targetUrl, `${hops.length ? `via ${hops.join(' ')} ` : ''}[${type}]`);

    if (looksLikePlaylist && upstream.ok) {
      const text = await upstream.text();
      const body = isHlsPlaylist(text) ? rewritePlaylist(text, finalUrl, `http://${req.headers.host}/proxy?url=`) : text;
      res.writeHead(upstream.status, {
        ...CORS,
        'Content-Type': contentType || 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
      });
      return res.end(body);
    }

    const outHeaders = { ...CORS };
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) outHeaders[name] = value;
    }
    // fetch() transparently decompresses, so the upstream length no longer matches.
    if (upstream.headers.get('content-encoding')) delete outHeaders['content-length'];
    res.writeHead(upstream.status, outHeaders);

    if (req.method === 'HEAD' || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch (error) {
    if (controller.signal.aborted) return;
    log(req.method, 'ERR', targetUrl, error.cause?.code ?? error.message);
    sendError(res, 502, `Upstream request failed: ${error.cause?.code ?? error.message}`);
  }
});

function log(method, status, targetUrl, extra = '') {
  // Hide credentials embedded in Xtream URLs from the console.
  const safe = `${targetUrl.origin}${targetUrl.pathname}`.replace(/\/(live|movie|series)\/[^/]+\/[^/]+\//, '/$1/***/***/');
  console.log(`${new Date().toISOString().slice(11, 19)} ${method} ${status} ${safe} ${extra}`);
}

server.listen(PORT, HOST, () => {
  console.log(`IPTV dev proxy listening on http://${HOST}:${PORT}`);
});
