import SwiftUI
import ViroReactUI
import React
import React_RCTSwiftExtensions

@main
struct MoyoApp: App {
  @UIApplicationDelegateAdaptor var delegate: AppDelegate
  
  @State private var immersionStyle: ImmersionStyle = .mixed
  
  var body: some Scene {
    RCTMainWindow(moduleName: "main") { rootView in
            rootView.viroImmersiveSpaceController()
        }

        ImmersiveSpace(id: ViroImmersiveSpace.id) {
            ViroImmersiveSpaceView()
        }
        .immersionStyle(selection: $immersionStyle, in: .mixed, .full)
  }
}

