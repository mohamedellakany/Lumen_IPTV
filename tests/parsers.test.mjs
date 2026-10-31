import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decodeBase64,
  isAdultCategory,
  blockedSiteFromFilter,
  isNetworkFilterPage,
  networkFilterName,
  normalizeHost,
  parseEpisodeName,
  parseM3U,
  parseXtreamM3uUrl,
  readableText,
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

test('isNetworkFilterPage spots router/ISP block pages but not panel account errors', () => {
  const filterPage =
    '<html><body><h1>Suspicious Site Blocked</h1><p>This site was blocked because it may contain unsafe content that can harm your device or compromise your personal info.&nbsp; Managing</p></body></html>';
  assert.equal(isNetworkFilterPage(filterPage), true);
  assert.equal(isNetworkFilterPage('Access to this website has been blocked by your administrator'), true);
  assert.equal(isNetworkFilterPage('Your account is blocked'), false);
  assert.equal(isNetworkFilterPage('Account expired'), false);
});

test('readableText decodes HTML entities', () => {
  assert.equal(readableText('<p>unsafe&nbsp;content &amp; more &#39;x&#x27;</p>'), "unsafe content & more 'x'");
  assert.equal(readableText('<title>Site&nbsp;Blocked</title><body>ignored</body>'), 'Site Blocked');
});

test('blockedSiteFromFilter finds the blocked server, never the filter itself', () => {
  const page = 'https://block.charter-prod.hosted.cujo.io/';
  assert.equal(blockedSiteFromFilter(`${page}?url=http%3A%2F%2Fstorage7.example.net%3A8080%2Fseries%2Fx.mkv&cat=malware`, ''), 'storage7.example.net');
  assert.equal(blockedSiteFromFilter(page, '<script>var blocked = "cdn.example.org";</script>'), 'cdn.example.org');
  assert.equal(blockedSiteFromFilter(page, '<a href="https://www.spectrum.net/support">Managing</a>'), null);
  assert.equal(networkFilterName(page), 'Spectrum Security Shield');
  assert.equal(networkFilterName('https://filter.example.com/'), null);
});
