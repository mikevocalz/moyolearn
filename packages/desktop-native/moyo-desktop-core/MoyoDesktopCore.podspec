# MoyoDesktopCore: Nitro v1 HybridObjects for Moyo Learn for macOS (Legend Spark).
# Nitro v1 builds libraries through SwiftPM on React Native 0.88; Spark runs
# React Native macOS 0.83 with CocoaPods, so the pod settings come from the
# Spark macOS port of react-native-nitro-modules (apple/cocoapods/nitro_cocoapods.rb),
# resolved from this package's location so it is the app's copy.
# SOT: packages/desktop-native/README.md · docs/desktop/adr/0002-nitro-desktop-adapter.md

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
nitro_package = `node --print "require.resolve('react-native-nitro-modules/package.json', { paths: [process.argv[1]] })" "#{__dir__}"`.strip
raise "[MoyoDesktopCore] react-native-nitro-modules is not installed next to #{__dir__}" unless $?.success? && File.exist?(nitro_package)
require File.join(File.dirname(nitro_package), "apple/cocoapods/nitro_cocoapods.rb")

Pod::Spec.new do |s|
  s.name         = "MoyoDesktopCore"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://moyolearn.com"
  s.license      = { :type => "UNLICENSED" }
  s.authors      = "Moyo Learn"
  s.platforms    = { :osx => "14.0" }
  s.source       = { :git => "https://github.com/mikevocalz/moyolearn.git", :tag => "desktop-core-#{s.version}" }

  NitroCocoaPods.add_nitrogen_module(s,
    module_name: "MoyoDesktopCore",
    module_maps_directory: "apple/cocoapods")

  install_modules_dependencies(s)
end
