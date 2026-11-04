/** Quest classifies hybrid activities using an activity intent-filter category. */
const VR_CATEGORY = 'com.oculus.intent.category.VR';
const DEFAULT_CATEGORY = 'android.intent.category.DEFAULT';

function mergeQuestImmersiveActivity(document, packageName) {
  if (!packageName) throw new Error('Quest immersive activity requires the Android package name');
  const manifest = document.manifest;
  manifest.application ??= [{}];
  const application = manifest.application[0];
  application.activity ??= [];
  let activity = application.activity.find((entry) =>
    ['.VRActivity', `${packageName}.VRActivity`].includes(entry.$?.['android:name']));
  if (!activity) {
    activity = { $: { 'android:name': '.VRActivity' } };
    application.activity.push(activity);
  }
  const action = `${packageName}.action.IMMERSIVE_VR`;
  activity['intent-filter'] ??= [];
  let filter = activity['intent-filter'].find((entry) => entry.action?.some((value) => value.$?.['android:name'] === action));
  if (!filter) {
    filter = { action: [{ $: { 'android:name': action } }], category: [] };
    activity['intent-filter'].push(filter);
  }
  filter.category ??= [];
  for (const name of [DEFAULT_CATEGORY, VR_CATEGORY]) {
    if (!filter.category.some((entry) => entry.$?.['android:name'] === name)) {
      filter.category.push({ $: { 'android:name': name } });
    }
  }
  return document;
}

module.exports = { mergeQuestImmersiveActivity, VR_CATEGORY };
