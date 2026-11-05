Pod::Spec.new do |s|
  s.name           = 'VlcPlayer'
  s.version        = '1.0.0'
  s.summary        = 'VLC playback engine for Lumen Player on iOS'
  s.description    = 'Wraps MobileVLCKit in an Expo view, for streams AVPlayer cannot show (HEVC in MPEG-TS, MKV, AVI).'
  s.author         = 'Mohamed Ellakany'
  s.homepage       = 'https://github.com/mohamedellakany/Lumen_IPTV'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MobileVLCKit', '~> 3.7.5'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
