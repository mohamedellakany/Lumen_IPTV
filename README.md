# Lumen Player

An IPTV player for **iOS, Android and the web**, built with React Native + Expo. Bring your own
Xtream Codes account or M3U playlist and watch live TV, movies and series.

## Features

- **Xtream Codes login** (server URL + username + password) and **M3U playlist URLs**.
  Xtream `get.php?username=…&password=…` links are detected automatically and upgraded to the richer Xtream API.
- **Multiple playlists**: save several and switch between them. Favorites and history are kept per playlist.
- **Live TV**: categories, search, channel logos, **EPG now/next** with a progress bar, **channel zapping**
  (previous/next and a side channel list), and favorites.
- **Movies**: poster grid, categories, sorting (recently added, A–Z, top rated), and a details page with
  plot, cast, director, rating, runtime and a YouTube trailer link.
- **Series**: seasons and episodes, **"Continue S2 E5"**, watched markers, **autoplay next episode**.
- **Resume playback**: movies and episodes pick up where you stopped.
- **Home**: featured banner (full story under "More"), Live TV / Movies / Series cards and a "Recently Added" row,
  plus a warning when your subscription is about to expire.
- **My List**: favorite channels, movies and series, plus full watch history.
- **Global search** across channels, movies and series.
- **Settings**: account status, expiry, connections, live format (HLS / MPEG-TS), hide adult categories,
  refresh the playlist, clear history.
- **Native player**: system controls, fullscreen, Picture-in-Picture, background audio and lock-screen controls.
- Responsive layout: phone, tablet and desktop browser, with a category sidebar on wide screens.

## 1. Try it in your browser

Requires Node.js 20+.

```bash
npm install
npm run dev:web
```

This starts two things:

1. **The streaming proxy** on `http://localhost:8787`. Browsers block direct requests to IPTV servers
   (no CORS headers, and video served over plain HTTP), so the web build sends requests through this small
   local proxy (`server/proxy.mjs`). **The mobile apps don't need it.**
2. **The Expo web dev server**: open the URL it prints (usually http://localhost:8081).

Then choose **Xtream Codes** and enter your server URL (for example `http://myserver.com:8080`),
username and password.

> You can also run them separately: `npm run proxy` in one terminal and `npm run web` in another.

### No account handy? Use the mock server

```bash
node tests/mock-xtream.mjs     # in a third terminal
```

Log in with server `localhost:8790`, username `demo`, password `demo`. It serves sample channels, movies and
series that play public test videos. For M3U, use `http://localhost:8790/playlist.m3u`.

### Browser limitations

The browser build is for testing. Some streams play in the mobile apps but not in browsers:

- **MKV / HEVC (H.265) / AC3 audio** are usually unsupported by browsers. Most IPTV movies use MKV.
- If a live channel doesn't start, tap **"Try MPEG-TS"** on the error screen (or change it in Settings).

## 2. Run on your phone

**Quickest: Expo Go.** Install **Expo Go** from the App Store or Google Play, run `npm start`, and scan
the QR code. Your phone and computer must be on the same Wi-Fi network.

**Most accurate: a development build.** This uses the app's real native configuration, including permission
to load plain-HTTP streams, Picture-in-Picture and background audio:

```bash
npx expo run:ios       # needs Xcode on macOS
npx expo run:android   # needs Android Studio
```

## Fire TV / Android TV

The app supports TV remotes: D-pad focus highlights, a Fire TV home-screen banner, and a denser
TV layout. TV mode is enabled per build with `EXPO_TV=1`. Phone builds are unaffected.

**Build the APK** (needs JDK 17 and the Android SDK; see the steps below):

```bash
EXPO_TV=1 npx expo prebuild --platform android --clean
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
  ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
# → android/app/build/outputs/apk/release/app-release.apk
```

**Install it on a Fire TV.** On the TV, turn on Settings → My Fire TV → Developer options →
ADB debugging and Apps from Unknown Sources. Then run:

```bash
~/Library/Android/sdk/platform-tools/adb connect <FIRE-TV-IP>:5555
~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

**Remote controls**

| Where | Key | Action |
| --- | --- | --- |
| Live TV | OK on a channel | Play it next to the channel list |
| Live TV | OK again on the playing channel | Full screen |
| Live full screen | ▲ / ▼ | Previous / next channel |
| Live full screen | OK | Show channel info and EPG |
| Live full screen | Back | Return to the channel list |
| Movies & series | ◀ / ▶ (controls hidden) | Rewind / forward 15 seconds (hold to keep skipping) |
| Movies & series | OK / ▲ / ▼ | Show controls (play/pause, ±15s, next episode, audio & subtitles) |
| Movies & series | ⏯ ⏪ ⏩ media keys | Play/pause, −15s, +15s |
| Movies & series | Back | Hide the controls, then exit |

In the browser, the arrow keys, Space, Enter and Esc do the same.

## 3. Build and publish to the App Store and Google Play

Builds run in the cloud with [EAS](https://docs.expo.dev/eas/), so you don't need a local Xcode or
Android Studio setup.

1. **Set your app identity** in `app.json`: `name`, `ios.bundleIdentifier` and `android.package`
   (currently `com.lumenplayer.app`). Change them to something you own, such as `com.yourcompany.player`.
   They can't be changed after the first store release.
2. **Replace the icons and splash image** in `assets/`: `icon.png` (1024×1024), the `android-icon-*.png`
   files and `splash-icon.png`.
3. Log in and link the project:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
4. **Test builds** that you install directly on devices:
   ```bash
   npx eas-cli@latest build --profile preview --platform android   # produces an .apk
   npx eas-cli@latest build --profile preview --platform ios       # ad-hoc build (register devices first)
   ```
5. **Store builds and submission**:
   ```bash
   npx eas-cli@latest build --profile production --platform all
   npx eas-cli@latest submit --platform ios       # needs an Apple Developer account ($99/year)
   npx eas-cli@latest submit --platform android   # needs a Google Play Console account ($25 once)
   ```

### Store review tips (important for IPTV apps)

Apple and Google regularly reject IPTV apps. To give yourself the best chance:

- **Ship no content.** The app must not include or suggest any playlists, channels or servers. It doesn't.
- **Keep the disclaimer** on the login screen ("does not provide any content").
- **Give reviewers a working demo account** with legal content (your own test streams, for example
  `tests/mock-xtream.mjs` deployed somewhere), and explain that it's a player for user-supplied playlists.
- **Avoid "IPTV", channel names or TV-network logos** in the app name, screenshots and description.
  Use a neutral name, like "Lumen Player — Media Player".
- **Add a privacy policy URL.** Both stores require one. The app stores credentials only on the device and
  has no analytics or ads.

## Project structure

```
src/
  app/                    Screens (Expo Router: every file is a route)
    (tabs)/               Home, Live TV, Movies, Series, My List
    movie/[id].tsx        Movie details
    series/[id].tsx       Series details with seasons and episodes
    player.tsx            Video player: live zapping, EPG, resume, next episode
    login.tsx             Add or switch playlists
    search.tsx, settings.tsx
  api/
    xtream.ts             Xtream Codes API client
    m3u.ts, parsers.ts    M3U parsing and pure helpers (unit-tested)
    http.ts               fetch with timeouts and friendly errors, plus the web proxy
  components/             UI building blocks; player/ has native and web video surfaces
  hooks/useCatalog.ts     Data fetching and caching (React Query) and adult filtering
  store/                  Persisted state (zustand + AsyncStorage): playlists, favorites, history, settings
server/proxy.mjs          Dev-only CORS and streaming proxy for the browser
tests/                    Unit tests and the mock Xtream server
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:web` | Proxy + web app together |
| `npm start` | Expo dev server (scan with Expo Go) |
| `npm run proxy` | Browser streaming proxy only |
| `npm test` | Parser unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Troubleshooting

- **"Could not reach the server" in the browser.** Make sure `npm run proxy` is running and that
  Settings → Browser → proxy URL is `http://localhost:8787`.
- **"Invalid username or password".** Check the server URL, including the port. Many panels use `:8080`
  or `:25461`.
- **Live channel buffers or fails.** Switch Settings → Live stream format to MPEG-TS (Android/web) or back to HLS.
- **A movie won't play in the browser.** It's probably MKV/HEVC. Try it on your phone.
- **Some panels block unknown players.** The browser proxy identifies itself as VLC. Change it with
  `PROXY_USER_AGENT="..." npm run proxy`.
