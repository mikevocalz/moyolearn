// The stub expo-horizon-quest's metaLayoutSdk writes (withQuestMetaLayout.ts),
// checked in by hand because expo-horizon-core 57.0.2 has no such option.
//
// Compiled into every flavor except quest, where the real class comes from the
// Meta VR Layout SDK AAR. The generated PackageList instantiates this class in
// all flavors; here it registers nothing.
package metavrx.layout.react;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;

@SuppressWarnings({"rawtypes"})
public final class SpatialScenePackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
