// Draining the upload queue on native, via expo-background-task.
//
// The OS decides when: on charge, on wi-fi, minutes or hours later. That is the
// right shape for an upload nobody is watching and the WRONG shape for anything
// a child is waiting on — which is why OCR runs in-process and only this is
// deferred.
//
// Registered at module scope because `defineTask` must run before the OS can
// route a wake-up to it: if registration lived in a component effect, a task
// fired while the app was closed would find nothing registered and be dropped.
// SOT: https://docs.expo.dev/versions/latest/sdk/background-task/
// SOT-KEYWORDS: upload queue background task native expo retry offline drain
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

export const UPLOAD_TASK = 'moyo-media-upload';

type Drain = () => Promise<void>;
let drain: Drain | undefined;

/** Supplied by the app at startup — the queue needs a repository to upload to. */
export function setUploadDrain(fn: Drain): void {
  drain = fn;
}

TaskManager.defineTask(UPLOAD_TASK, async () => {
  try {
    await drain?.();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    /*
      Failed is not the same as "nothing to do". Reporting success on a failed
      drain tells the scheduler the work is done and it may not come back for a
      long time — precisely when the queue most needs it to.
    */
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Ask the OS to run the drain periodically.
 *
 * The interval is a REQUEST, not a promise — iOS in particular treats it as a
 * hint and may run it far less often. Anything that must happen at a known time
 * does not belong here.
 */
export async function registerUploadDrain(minimumIntervalMinutes = 15): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
  await BackgroundTask.registerTaskAsync(UPLOAD_TASK, { minimumInterval: minimumIntervalMinutes });
}

export async function unregisterUploadDrain(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(UPLOAD_TASK)) {
    await BackgroundTask.unregisterTaskAsync(UPLOAD_TASK);
  }
}
