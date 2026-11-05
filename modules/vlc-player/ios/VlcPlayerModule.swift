import ExpoModulesCore

public class VlcPlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VlcPlayer")

    View(VlcPlayerView.self) {
      Events("onStateChange", "onTracksChange", "onEnded", "onError")

      Prop("uri") { (view, uri: String) in
        view.uri = uri
      }
      Prop("userAgent") { (view, userAgent: String?) in
        view.userAgent = userAgent
      }
      Prop("isLive") { (view, isLive: Bool?) in
        view.isLive = isLive ?? false
      }
      Prop("startAt") { (view, startAt: Double?) in
        view.startAt = startAt ?? 0
      }
      Prop("contentFit") { (view, contentFit: String?) in
        view.contentFit = contentFit ?? "contain"
      }

      // Start (or restart) playback once every prop of this update has been applied.
      OnViewDidUpdateProps { view in
        view.applyProps()
      }

      AsyncFunction("play") { (view: VlcPlayerView) in
        view.play()
      }
      AsyncFunction("pause") { (view: VlcPlayerView) in
        view.pause()
      }
      AsyncFunction("seekTo") { (view: VlcPlayerView, seconds: Double) in
        view.seek(to: seconds)
      }
      AsyncFunction("setAudioTrack") { (view: VlcPlayerView, id: Int) in
        view.setAudioTrack(Int32(id))
      }
      AsyncFunction("setSubtitleTrack") { (view: VlcPlayerView, id: Int) in
        view.setSubtitleTrack(Int32(id))
      }
    }
  }
}
