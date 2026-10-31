#!/usr/bin/env node
// A fake Xtream Codes server for local testing without a real subscription.
// Login: http://localhost:8790  user: demo  pass: demo
// Streams redirect to public test videos (like real panels redirect to load balancers).
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8790);
const HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const MP4 = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4';
const img = (seed, w = 300, h = 450) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const now = Math.floor(Date.now() / 1000);
const b64 = (s) => Buffer.from(s).toString('base64');

// A flaky live channel (id 150) for testing recovery: a sliding-window live playlist built from the
// test stream's segments, where every 3rd refresh returns a broken reply (like real IPTV hiccups).
const SEG_BASE = 'https://test-streams.mux.dev/x36xhzz/url_2/';
let segments = [];
fetch(`${SEG_BASE}193039199_mp4_h264_aac_ld_7.m3u8`)
  .then((r) => r.text())
  .then((t) => (segments = t.split('\n').filter((l) => l.endsWith('.ts'))))
  .catch(() => {});
const liveStart = Date.now();
let flakyRequests = 0;
// Each catalog download adds one new item, so "Refresh" can be seen picking up new content.
let vodRequests = 0;
let playlistRequests = 0;

const liveCategories = [
  { category_id: '1', category_name: 'News', parent_id: 0 },
  { category_id: '2', category_name: 'Sports', parent_id: 0 },
  { category_id: '3', category_name: 'Kids', parent_id: 0 },
  { category_id: '9', category_name: 'XXX Adult', parent_id: 0 },
];
const live = Array.from({ length: 30 }, (_, i) => ({
  num: i + 1,
  name: `${['News', 'Sports', 'Kids'][i % 3]} Channel ${i + 1} HD`,
  stream_type: 'live',
  stream_id: 100 + i,
  stream_icon: i % 5 === 0 ? '' : img(`ch${i}`, 200, 120),
  epg_channel_id: `ch${i}`,
  added: String(now - i * 1000),
  category_id: String((i % 3) + 1),
  tv_archive: i % 4 === 0 ? 1 : 0,
}));
live.push({ num: 99, name: 'Hidden Adult', stream_id: 999, stream_icon: '', category_id: '9' });
live.push({ num: 150, name: 'Flaky Test Channel', stream_id: 150, stream_icon: '', category_id: '1' });

const vodCategories = [
  { category_id: '10', category_name: 'Action' },
  { category_id: '11', category_name: 'Comedy' },
];
const vod = Array.from({ length: 24 }, (_, i) => ({
  num: i + 1,
  name: `Movie Title ${i + 1} (${2000 + i})`,
  stream_type: 'movie',
  stream_id: 2000 + i,
  stream_icon: img(`mv${i}`),
  rating: String((5 + (i % 5)).toFixed(1)),
  rating_5based: ((5 + (i % 5)) / 2).toFixed(1),
  added: String(now - i * 86400),
  category_id: String(10 + (i % 2)),
  // Served as HLS so the 10-minute test stream can be used to exercise seeking.
  container_extension: 'm3u8',
}));

// Like some real panels: movie 2022 is listed as .mkv, but only the .mp4 file exists. Asking for
// the .mkv returns the panel's web page.
vod[22].container_extension = 'mkv';

const seriesCategories = [{ category_id: '20', category_name: 'Drama' }];
const series = Array.from({ length: 10 }, (_, i) => ({
  num: i + 1,
  name: `Series ${i + 1}`,
  series_id: 3000 + i,
  cover: img(`sr${i}`),
  plot: 'A gripping drama about testing IPTV players.',
  genre: 'Drama, Thriller',
  releaseDate: `${2015 + i}-01-01`,
  last_modified: String(now - i * 3600),
  rating: '8.1',
  rating_5based: 4.05,
  category_id: '20',
}));

function seriesInfo(id) {
  const s = series.find((x) => String(x.series_id) === id) ?? series[0];
  const episodes = {};
  for (const season of [1, 2, 3]) {
    episodes[season] = Array.from({ length: 12 }, (_, e) => ({
      id: String(id * 1000 + season * 100 + e),
      episode_num: e + 1,
      title: `Episode ${e + 1}`,
      container_extension: 'm3u8',
      season,
      info: { movie_image: img(`ep${id}${season}${e}`, 320, 180), plot: 'Something happens.', duration_secs: 2700 },
    }));
  }
  return {
    seasons: [1, 2, 3].map((n) => ({ season_number: n, name: `Season ${n}` })),
    info: { name: s.name, cover: s.cover, plot: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future, partnering with a former student as their small operation grows into an empire that puts everyone around them in danger.', genre: s.genre, cast: 'Bryan Cranston, Aaron Paul, Anna Gunn, RJ Mitte, Dean Norris, Betsy Brandt, Bob Odenkirk, Jonathan Banks', director: 'Vince Gilligan', releaseDate: s.releaseDate, rating: '8.1', backdrop_path: [img(`bd${id}`, 1280, 720)] },
    episodes,
  };
}

const json = (res, body) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    console.log(req.method, url.pathname, url.searchParams.get('action') ?? '');
    if (url.pathname === '/player_api.php') {
      if (url.searchParams.get('username') !== 'demo' || url.searchParams.get('password') !== 'demo') {
        return json(res, { user_info: { auth: 0 } });
      }
      const p = url.searchParams;
      switch (p.get('action')) {
        case null:
          return json(res, {
            user_info: { username: 'demo', auth: 1, status: 'Active', exp_date: String(now + 5 * 86400), is_trial: '0', active_cons: '0', max_connections: '2', created_at: String(now - 86400 * 100) },
            server_info: { url: 'localhost', port: String(PORT), server_protocol: 'http', timezone: 'UTC', timestamp_now: now },
          });
        case 'get_live_categories': return json(res, liveCategories);
        case 'get_live_streams': return json(res, live);
        case 'get_vod_categories': return json(res, vodCategories);
        case 'get_vod_streams': {
          vodRequests++;
          const fresh = Array.from({ length: vodRequests - 1 }, (_, i) => ({ ...vod[0], stream_id: 9000 + i, name: `Fresh Movie ${i + 1}`, added: String(now + i) }));
          return json(res, [...vod, ...fresh]);
        }
        case 'get_series_categories': return json(res, seriesCategories);
        case 'get_series': return json(res, series);
        case 'get_vod_info': {
          const m = vod.find((v) => String(v.stream_id) === p.get('vod_id')) ?? vod[0];
          return json(res, {
            info: { movie_image: m.stream_icon, backdrop_path: [img(`bdm${m.stream_id}`, 1280, 720)], plot: 'تدور أحداث الفيلم في إطار كوميدي حول (المكسيكي) الذي اعتاد القيام بعمليات السرقة والتهريب وحده دون مساعدة، ويتورط في عملية كبيرة تحتاج للاستعانة بعصابة كاملة، فيبدأ رحلة البحث عن أفراد العصابة واحدًا تلو الآخر، لتتوالى المواقف الكوميدية والمفارقات حتى يصلوا إلى يوم التنفيذ الكبير الذي يقلب حياتهم رأسًا على عقب.', genre: 'كوميديا / جريمة', cast: 'أحمد فهمي، روبي، لطفي لبيب، محمد لطفي، هشام إسماعيل، مصطفى غريب، حاتم صلاح، أحمد سعد، وعدد كبير من ضيوف الشرف', director: 'Carol', releasedate: '2010-07-16', duration_secs: 8880, rating: '8.4', youtube_trailer: 'YoHD9XEInc0' },
            movie_data: { stream_id: m.stream_id, name: m.name, container_extension: m.container_extension },
          });
        }
        case 'get_series_info': return json(res, seriesInfo(Number(p.get('series_id'))));
        case 'get_short_epg': {
          const start = now - 1200;
          return json(res, {
            epg_listings: [
              { title: b64('Evening Report — Édition spéciale'), description: b64('Top stories'), start_timestamp: String(start), stop_timestamp: String(start + 3600) },
              { title: b64('Late Night Movie'), description: b64(''), start_timestamp: String(start + 3600), stop_timestamp: String(start + 7200) },
            ],
          });
        }
        default: return json(res, []);
      }
    }
    if (url.pathname === '/playlist.m3u') {
      const base = `http://${req.headers.host}`;
      playlistRequests++;
      const extra = Array.from({ length: playlistRequests - 1 }, (_, i) => `#EXTINF:-1 group-title="M3U News",M3U Fresh Channel ${i + 1}\n${base}/live/demo/demo/${300 + i}.m3u8\n`).join('');
      res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
      return res.end(`#EXTM3U
${extra}
#EXTINF:-1 tvg-id="news1" tvg-logo="${img('m3u-news', 200, 120)}" group-title="M3U News",M3U News One
${base}/live/demo/demo/100.m3u8
#EXTINF:-1 group-title="M3U Sports",M3U Sports One
${base}/live/demo/demo/101.m3u8
#EXTINF:-1 tvg-logo="${img('m3u-mv')}" group-title="M3U Movies",M3U Movie
${base}/movie/demo/demo/2000.mp4
#EXTINF:-1 group-title="M3U Shows",Test Show S01E01
${base}/series/demo/demo/1.mp4
#EXTINF:-1 group-title="M3U Shows",Test Show S01E02
${base}/series/demo/demo/2.mp4
`);
    }
    if (url.pathname === '/live/demo/demo/150.m3u8') {
      flakyRequests++;
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' });
      if (flakyRequests % 3 === 0) return res.end('<html>Service temporarily unavailable</html>');
      const seq = Math.floor((Date.now() - liveStart) / 10000);
      const window = [0, 1, 2].map((i) => segments[(seq + i) % segments.length]);
      return res.end(
        ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:10', `#EXT-X-MEDIA-SEQUENCE:${seq}`]
          .concat(window.flatMap((seg) => ['#EXTINF:10.000,', SEG_BASE + seg]))
          .join('\n'),
      );
    }
    // Like many real panels: unknown players get an error page instead of video (STRICT_UA=1 to enable).
    if (/^\/(live|movie|series)\//.test(url.pathname)) {
      const ua = req.headers['user-agent'] ?? '';
      if (process.env.STRICT_UA === '1' && !/VLC|Smarters/i.test(ua)) {
        console.log('  blocked user agent:', ua);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body>Access denied: unsupported player</body></html>');
      }
      if (/\/2021\.\w+$/.test(url.pathname)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"><title>File not found</title></head><body>Not found</body></html>`);
      }
      if (url.pathname.endsWith('/2022.mkv')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; img-src 'self'"><title>Not Found</title></head><body><h1>Not Found</h1></body></html>`);
      }
      if (url.pathname.endsWith('/2023.m3u8')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body><h1>Max connections reached</h1></body></html>');
      }
    }
    if (/^\/(live|movie|series)\/demo\/demo\/\d+\.m3u8$/.test(url.pathname)) { res.writeHead(302, { Location: HLS }); return res.end(); }
    if (/^\/(movie|series)\/demo\/demo\/\d+\.\w+$/.test(url.pathname)) { res.writeHead(302, { Location: MP4 }); return res.end(); }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => console.log(`Mock Xtream server on http://localhost:${PORT} (demo/demo)`));
