Pod::Spec.new do |s|
  s.name           = 'ReservedRegions'
  s.version        = '0.1.0'
  s.summary        = "UIKit reserved regions for the app window"
  s.description    = "Fold division and camera occlusion rects from UIView.reservedRegions(kind:), iOS 27.1+."
  s.author         = 'Moyo'
  s.homepage       = 'https://moyolearn.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '6.0'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
