import ExpoModulesCore
import MobileVLCKit

/// A video view backed by libVLC, for streams AVPlayer can't show (HEVC in MPEG-TS, MKV, AVI…).
/// State is polled twice a second rather than taken from delegate callbacks: simpler, and the
/// player UI only needs coarse updates.
class VlcPlayerView: ExpoView {
  let onStateChange = EventDispatcher()
  let onTracksChange = EventDispatcher()
  let onEnded = EventDispatcher()
  let onError = EventDispatcher()

  var uri: String?
  var userAgent: String?
  var isLive = false
  var startAt: Double = 0
  var contentFit = "contain"

  private let videoView = UIView()
  private let player = VLCMediaPlayer()
  private var loadedUri: String?
  private var appliedFit: String?
  private var timer: Timer?
  private var didResume = false
  private var reportedEnd = false
  private var reportedError = false
  private var lastTracksKey = ""

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    videoView.backgroundColor = .black
    addSubview(videoView)
    player.drawable = videoView
  }

  deinit {
    timer?.invalidate()
    player.stop()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    videoView.frame = bounds
    appliedFit = nil
    applyContentFit()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    // Leaving the screen: stop decoding and networking right away instead of waiting for deinit.
    if window == nil {
      timer?.invalidate()
      timer = nil
      player.stop()
      loadedUri = nil
    } else if loadedUri == nil {
      applyProps()
    }
  }

  func applyProps() {
    applyContentFit()
    guard window != nil, let uri, uri != loadedUri, let url = URL(string: uri) else { return }
    loadedUri = uri
    didResume = false
    reportedEnd = false
    reportedError = false
    lastTracksKey = ""

    let media = VLCMedia(url: url)
    if let userAgent, !userAgent.isEmpty {
      media.addOption(":http-user-agent=\(userAgent)")
    }
    // A little more buffering for live streams, which can't be re-requested once missed.
    media.addOption(":network-caching=\(isLive ? 2000 : 1500)")
    player.media = media
    player.play()

    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      self?.tick()
    }
  }

  func play() { player.play() }
  func pause() { player.pause() }

  func seek(to seconds: Double) {
    guard !isLive else { return }
    player.time = VLCTime(int: Int32(max(0, seconds) * 1000))
  }

  func setAudioTrack(_ id: Int32) {
    player.currentAudioTrackIndex = id
    lastTracksKey = ""
  }

  /// -1 turns subtitles off.
  func setSubtitleTrack(_ id: Int32) {
    player.currentVideoSubTitleIndex = id
    lastTracksKey = ""
  }

  private func applyContentFit() {
    guard appliedFit != contentFit, bounds.width > 0, bounds.height > 0 else { return }
    appliedFit = contentFit
    // libVLC copies these strings, so a temporary C copy is enough.
    let ratio = strdup("\(Int(bounds.width)):\(Int(bounds.height))")
    defer { free(ratio) }
    switch contentFit {
    case "cover":
      player.videoAspectRatio = nil
      player.videoCropGeometry = ratio
    case "fill":
      player.videoCropGeometry = nil
      player.videoAspectRatio = ratio
    default:
      player.videoCropGeometry = nil
      player.videoAspectRatio = nil
    }
  }

  private func tick() {
    let state = player.state
    let position = Double(player.time.intValue) / 1000
    let length = Double(player.media?.length.intValue ?? 0) / 1000

    if !didResume, !isLive, startAt > 0, player.isPlaying, length > 0 {
      didResume = true
      seek(to: startAt)
    }

    onStateChange([
      "playing": player.isPlaying,
      "position": position,
      "duration": isLive ? 0 : max(0, length),
      // libVLC often stays in .buffering while it is in fact playing; only count it when nothing plays.
      "buffering": !player.isPlaying && (state == .opening || state == .buffering),
    ])

    if state == .ended, !reportedEnd {
      reportedEnd = true
      onEnded()
    }
    if state == .error, !reportedError {
      reportedError = true
      onError(["message": "This stream could not be played."])
    }
    reportTracksIfChanged()
  }

  private func reportTracksIfChanged() {
    let audio = tracks(player.audioTrackIndexes, player.audioTrackNames)
    let subtitles = tracks(player.videoSubTitlesIndexes, player.videoSubTitlesNames)
    let selectedAudio = player.currentAudioTrackIndex
    let selectedSubtitle = player.currentVideoSubTitleIndex
    let key = "\(audio)|\(subtitles)|\(selectedAudio)|\(selectedSubtitle)"
    guard key != lastTracksKey else { return }
    lastTracksKey = key
    onTracksChange([
      "audio": audio,
      "subtitles": subtitles,
      "selectedAudio": selectedAudio >= 0 ? String(selectedAudio) : nil,
      "selectedSubtitle": selectedSubtitle >= 0 ? String(selectedSubtitle) : nil,
    ])
  }

  /// libVLC lists a "Disable" entry with index -1; the app offers its own "off" option instead.
  private func tracks(_ indexes: [Any]?, _ names: [Any]?) -> [[String: String]] {
    let ids = (indexes ?? []).compactMap { ($0 as? NSNumber)?.int32Value }
    let labels = (names ?? []).map { "\($0)" }
    return zip(ids, labels).filter { $0.0 >= 0 }.map { ["id": String($0.0), "label": $0.1] }
  }
}
