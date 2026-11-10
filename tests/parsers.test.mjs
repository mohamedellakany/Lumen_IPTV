import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decodeBase64,
  firstPlaylistUri,
  hlsCodecs,
  isAdultCategory,
  normalizeHost,
  parseEpisodeName,
  parseM3U,
  parseXtreamM3uUrl,
  readableText,
  tsStreamTypes,
} from '../src/api/parsers.ts';

test('normalizeHost adds a scheme and strips paths', () => {
  assert.equal(normalizeHost('example.com:8080'), 'http://example.com:8080');
  assert.equal(normalizeHost(' https://example.com/player_api.php?x=1 '), 'https://example.com');
  assert.equal(normalizeHost('http://1.2.3.4:25461/'), 'http://1.2.3.4:25461');
  assert.equal(normalizeHost(''), '');
});

test('parseXtreamM3uUrl extracts credentials from get.php links', () => {
  assert.deepEqual(parseXtreamM3uUrl('http://tv.example.com:8080/get.php?username=bob&password=s3cr%23t&type=m3u_plus&output=ts'), {
    host: 'http://tv.example.com:8080',
    username: 'bob',
    password: 's3cr#t',
  });
  assert.equal(parseXtreamM3uUrl('http://example.com/playlist.m3u'), null);
  assert.equal(parseXtreamM3uUrl('not a url'), null);
});

test('decodeBase64 handles UTF-8 and bad input', () => {
  assert.equal(decodeBase64(Buffer.from('Café — Noticias 24h').toString('base64')), 'Café — Noticias 24h');
  assert.equal(decodeBase64(Buffer.from('الأخبار').toString('base64')), 'الأخبار');
  assert.equal(decodeBase64(''), '');
  assert.equal(decodeBase64('%%%'), '%%%');
});

test('isAdultCategory', () => {
  for (const name of ['XXX Movies', 'Adult', 'FOR ADULTS', 'VOD 18+', '+18 Channels']) assert.ok(isAdultCategory(name), name);
  for (const name of ['Sports', 'Kids', 'News 24', 'Movies 2018']) assert.ok(!isAdultCategory(name), name);
});

test('parseEpisodeName', () => {
  assert.deepEqual(parseEpisodeName('Breaking Bad S01E02'), { series: 'Breaking Bad', season: 1, episode: 2 });
  assert.deepEqual(parseEpisodeName('The.Office.s3.e12.720p'), { series: 'The Office', season: 3, episode: 12 });
  assert.deepEqual(parseEpisodeName('Dark - S02 E05'), { series: 'Dark', season: 2, episode: 5 });
  assert.equal(parseEpisodeName('Just a movie (2020)'), null);
});

test('parseM3U classifies live, movies and series', () => {
  const playlist = `#EXTM3U url-tvg="http://epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="bbc1.uk" tvg-name="BBC One" tvg-logo="http://logo/bbc1.png" group-title="UK, News",BBC One HD
http://srv.example.com/live/u/p/1001.ts
#EXTINF:-1 tvg-chno="7" group-title="Sports",Sky Sports
http://srv.example.com/live/u/p/1002.m3u8
#EXTINF:-1 tvg-logo="http://img/inception.jpg" group-title="Movies EN",Inception (2010)
http://srv.example.com/movie/u/p/2001.mkv
#EXTINF:-1 group-title="Series EN",Dark S01E02
http://srv.example.com/series/u/p/3002.mp4
#EXTINF:-1 group-title="Series EN",Dark S01E01
http://srv.example.com/series/u/p/3001.mp4
#EXTINF:-1 group-title="Series EN",Dark S02E01
http://srv.example.com/series/u/p/3010.mp4
#EXTINF:-1,No Group Channel
#EXTVLCOPT:http-user-agent=Foo
http://other.example.com/stream
`;
  const r = parseM3U(playlist);

  assert.equal(r.live.length, 3);
  assert.equal(r.live[0].name, 'BBC One HD');
  assert.equal(r.live[0].categoryId, 'UK, News');
  assert.equal(r.live[0].epgId, 'bbc1.uk');
  assert.equal(r.live[0].logo, 'http://logo/bbc1.png');
  assert.equal(r.live[1].num, 7);
  assert.equal(r.live[2].categoryId, 'Uncategorized');
  assert.equal(r.live[2].directUrl, 'http://other.example.com/stream');

  assert.equal(r.movies.length, 1);
  assert.equal(r.movies[0].name, 'Inception (2010)');

  assert.equal(r.series.length, 1);
  const info = r.seriesInfo[r.series[0].id];
  assert.equal(info.name, 'Dark');
  assert.deepEqual(info.seasons.map((s) => s.number), [1, 2]);
  assert.deepEqual(info.seasons[0].episodes.map((e) => e.episodeNum), [1, 2]);

  assert.deepEqual(r.liveCategories.map((c) => c.name), ['UK, News', 'Sports', 'Uncategorized']);
  // IDs are derived from URLs, so they're stable across reloads (favorites keep working).
  assert.equal(parseM3U(playlist).live[0].id, r.live[0].id);
});

test('readableText decodes HTML entities', () => {
  assert.equal(readableText('<p>unsafe&nbsp;content &amp; more &#39;x&#x27;</p>'), "unsafe content & more 'x'");
  assert.equal(readableText('<title>Site&nbsp;Blocked</title><body>ignored</body>'), 'Site Blocked');
});

test('hlsCodecs and firstPlaylistUri read HLS playlists', () => {
  const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=9000000,CODECS="hvc1.2.4.L150.B0,mp4a.40.2"\nhigh/index.m3u8\n';
  assert.deepEqual(hlsCodecs(master), ['hvc1.2.4.l150.b0', 'mp4a.40.2']);
  assert.equal(firstPlaylistUri(master, 'http://cdn.example.com/live/1/master.m3u8'), 'http://cdn.example.com/live/1/high/index.m3u8');
  const media = '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4.0,\n/hls/seg001.ts?token=x\n';
  assert.equal(firstPlaylistUri(media, 'http://cdn.example.com/live/1/index.m3u8'), 'http://cdn.example.com/hls/seg001.ts?token=x');
  assert.equal(firstPlaylistUri('#EXTM3U\n', 'http://x/'), null);
});

// Builds a 188-byte TS packet carrying one PSI section (pointer_field 0), padded with 0xff.
function psiPacket(pid, sectionBytes) {
  const p = new Uint8Array(188).fill(0xff);
  p.set([0x47, 0x40 | (pid >> 8), pid & 0xff, 0x10, 0x00], 0);
  p.set(sectionBytes, 5);
  return p;
}
function tsWith(streamTypes) {
  // PAT: program 1 -> PMT on PID 0x1000.
  const pat = psiPacket(0, [0x00, 0xb0, 0x0d, 0x00, 0x01, 0xc1, 0x00, 0x00, 0x00, 0x01, 0xf0, 0x00, 0, 0, 0, 0]);
  const streams = streamTypes.flatMap((t, i) => [t, 0xe1, 0x00 + i, 0xf0, 0x00]);
  const length = 9 + streams.length + 4;
  const pmt = psiPacket(0x1000, [0x02, 0xb0 | (length >> 8), length & 0xff, 0x00, 0x01, 0xc1, 0x00, 0x00, 0xe1, 0x00, 0xf0, 0x00, ...streams, 0, 0, 0, 0]);
  const out = new Uint8Array(188 * 3);
  out.set(pat, 0);
  out.set(pmt, 188);
  out.set(psiPacket(0x1fff, []), 376);
  return out;
}

test('tsStreamTypes reads the codec table of an MPEG-TS segment', () => {
  assert.deepEqual(tsStreamTypes(tsWith([0x24, 0x0f])), [0x24, 0x0f]); // HEVC + AAC
  assert.deepEqual(tsStreamTypes(tsWith([0x1b, 0x0f])), [0x1b, 0x0f]); // H.264 + AAC
  assert.deepEqual(tsStreamTypes(new Uint8Array(500)), []);
});

test('seekTarget rejects invalid times and keeps valid ones inside the video', async () => {
  const { seekTarget } = await import('../src/components/player/types.ts');
  assert.equal(seekTarget(Number.NaN, 600), null);
  assert.equal(seekTarget(Number.POSITIVE_INFINITY, 600), null);
  assert.equal(seekTarget(-5, 600), 0);
  assert.equal(seekTarget(900, 600), 600);
  assert.equal(seekTarget(120, Number.POSITIVE_INFINITY), 120);
  assert.equal(seekTarget(120), 120);
});
