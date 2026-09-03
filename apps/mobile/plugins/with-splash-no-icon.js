/**
 * Removes Android's splash-screen ICON from the generated theme, leaving the
 * paper alone.
 *
 * WHY THIS FILE EXISTS. The animated splash draws the mark in from nothing
 * (components/splash/MoyoSplash.tsx), so a static copy of the finished mark
 * flashing first is the logo twice: once as the native splash's icon, then
 * again as the thing that draws itself. Dropping `image` from the
 * expo-splash-screen config is only half of it —
 * `expo-splash-screen/plugin/build/withAndroidSplashStyles.js` writes
 *
 *     <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
 *
 * UNCONDITIONALLY, whether or not an image was configured. With no image the
 * companion mod writes no drawable, so prebuild leaves styles.xml pointing at a
 * resource that does not exist and the next `assembleDebug` fails in aapt on a
 * missing @drawable — a build error whose cause is three packages away from
 * where it surfaces.
 *
 * `android:windowSplashScreenBehavior` goes with it: `icon_preferred` asks
 * Android 12+ to keep showing an icon, which is the setting for the icon that
 * is no longer there.
 *
 * ORDER MATTERS. This must be registered AFTER 'expo-splash-screen' in
 * app.config.ts's plugins array — mods run in registration order and this one
 * edits that plugin's output.
 *
 * SOT: apps/mobile/app.config.ts · apps/mobile/components/splash/MoyoSplash.tsx
 * SOT-KEYWORDS: splash android icon styles plugin prebuild windowSplashScreenAnimatedIcon
 */
const { withAndroidStyles } = require('@expo/config-plugins');

const SPLASH_STYLE = 'Theme.App.SplashScreen';
const DROPPED = new Set(['windowSplashScreenAnimatedIcon', 'android:windowSplashScreenBehavior']);

module.exports = function withSplashNoIcon(config) {
  return withAndroidStyles(config, (androidConfig) => {
    const styles = androidConfig.modResults.resources.style ?? [];
    androidConfig.modResults.resources.style = styles.map((style) => {
      if (style.$?.name !== SPLASH_STYLE) return style;
      return { ...style, item: (style.item ?? []).filter((item) => !DROPPED.has(item.$?.name)) };
    });
    return androidConfig;
  });
};
