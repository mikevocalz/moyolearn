// PLATFORM FORK — a browser asks at `getUserMedia` time and cannot be asked
// ahead, so there is nothing to do as the app loads.
// SOT-KEYWORDS: permissions launch web fork no-op
export function useAskPermissionsOnLaunch(): void {}
