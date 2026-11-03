import { createStore, type StoreApi } from "zustand/vanilla";
import type { BlePenPort, PenConnectionPort, PenConnectionState, PenDevice, PenLink, PenVerification } from "./types";

export interface PenConnectionController {
  readonly state: StoreApi<PenConnectionState>;
  /** Show rationale and request a real OS permission only after a tap. */
  begin(): Promise<void>;
  /** Start another foreground scan with previously granted permissions. */
  rescan(): Promise<void>;
  /** Whether this transport exposes a real system chooser. */
  readonly canChooseSystemDevice: boolean;
  /** Opens the system chooser explicitly; selection alone never verifies input. */
  chooseSystemDevice(): Promise<void>;
  readonly canLoadAssociatedDevices: boolean;
  /** Load actual owned OS records after an explicit tap, without connecting. */
  loadAssociatedDevices(): Promise<void>;
  /** Connect only to a device from the actual last scan. */
  connect(deviceId: string): Promise<void>;
  /** Receives trusted native tracking/protocol status; never called by UI. */
  verifyNativeInput(sample: PenVerification): void;
  /** Cancel any active scan/link. Safe to call multiple times. */
  cancel(): Promise<void>;
  dispose(): void;
}

export function createPenConnectionController(port: PenConnectionPort): PenConnectionController {
  const state = createStore<PenConnectionState>(() => ({ kind: "idle" }));
  let epoch = 0;
  let disposed = false;
  let link: PenLink | undefined;
  let unsubscribeLink: (() => void) | undefined;
  let devices: readonly PenDevice[] = [];
  let pairedDevice: PenDevice | undefined;
  let granted = false;
  const valid = (generation: number) => !disposed && generation === epoch;
  const transition = (next: PenConnectionState) => { if (!disposed) state.setState(next, true); };
  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
  const release = () => {
    unsubscribeLink?.();
    unsubscribeLink = undefined;
    const old = link;
    link = undefined;
    pairedDevice = undefined;
    if (old !== undefined) void old.disconnect().catch(() => undefined);
  };
  const reportError = (generation: number, code: Extract<PenConnectionState, {kind:"error"}>["code"], error: unknown) => {
    if (valid(generation)) transition({kind:"error",code,message:message(error)});
  };
  const doScan = async (generation: number, transport: BlePenPort) => {
    if (!valid(generation)) return;
    transition({kind:"scanning"});
    devices = [];
    try {
      const scanResults = await transport.scan();
      if (!valid(generation)) return;
      // Limit display count and reject phantom/malformed devices.
      const unique = new Map<string, PenDevice>();
      for (const device of scanResults) {
        if (typeof device.id !== "string" || !device.id.trim()) continue;
        if (typeof device.name !== "string" || !device.name.trim()) continue;
        if (!unique.has(device.id)) unique.set(device.id, device);
        if (unique.size >= 50) break;
      }
      devices = [...unique.values()];
      transition({kind:"found",devices});
    } catch (error) {
      reportError(generation,"scan",error);
    }
  };
  return {
    state,
    canChooseSystemDevice: port.mode === "bluetooth-le" && typeof port.chooseDevice === "function",
    canLoadAssociatedDevices: port.mode === "bluetooth-le" && typeof port.loadAssociatedDevices === "function",
    async loadAssociatedDevices() {
      if (disposed || port.mode !== "bluetooth-le" || !port.loadAssociatedDevices) return;
      const generation = ++epoch;
      port.cancelScan(); release(); devices = [];
      transition({kind:"loading-associated"});
      try {
        if (!granted) granted = await port.requestAccess();
        if (!valid(generation)) return;
        if (!granted) {
          transition({kind:"error",code:"permission",message:"Bluetooth permission was not granted."});
          return;
        }
        const history = await port.loadAssociatedDevices();
        if (!valid(generation)) return;
        const unique = new Map<string, PenDevice>();
        for (const device of history) {
          if (!device || typeof device.id !== "string" || !device.id.trim() || typeof device.name !== "string" || !device.name.trim() || device.selectionSource !== "association-history") throw new Error("Invalid association history.");
          if (!unique.has(device.id)) unique.set(device.id, device);
          if (unique.size >= 50) break;
        }
        devices = [...unique.values()];
        transition({kind:"found",devices,source:"association-history"});
      } catch (error) { reportError(generation,"scan",error); }
    },
    async chooseSystemDevice() {
      if (disposed || port.mode !== "bluetooth-le" || !port.chooseDevice) return;
      const generation = ++epoch;
      port.cancelScan();
      release();
      devices = [];
      // System-owned selection survives the activity transition to the OS chooser.
      transition({kind:"system-pairing",deviceName:"Muse",instructions:["Choose Muse in the Quest device chooser.","Selection does not verify pen input or tracking."]});
      try {
        if (!granted) granted = await port.requestAccess();
        if (!valid(generation)) return;
        if (!granted) {
          transition({kind:"error",code:"permission",message:"Bluetooth permission was not granted."});
          return;
        }
        if (!(await port.ensureEnabled())) {
          if (valid(generation)) transition({kind:"error",code:"disabled",message:"Bluetooth is switched off."});
          return;
        }
        if (!valid(generation)) return;
        const selected = await port.chooseDevice();
        if (!valid(generation)) return;
        if (typeof selected.id !== "string" || !selected.id.trim() || typeof selected.name !== "string" || !selected.name.trim()) throw new Error("Invalid system device selection.");
        devices = [selected];
        transition({kind:"found",devices});
      } catch (error) { reportError(generation,"scan",error); }
    },
    async begin() {
      if (disposed) return;
      const generation = ++epoch;
      port.mode === "bluetooth-le" && port.cancelScan();
      release();
      devices = [];
      granted = false;
      if (port.mode === "system-spatial") {
        transition({kind:"system-pairing",deviceName:port.deviceName,instructions:port.pairingInstructions});
        return;
      }
      transition({kind:"explaining-permission",mode:port.mode});
      // Permission is only requested once user explicitly presses Connect.
      transition({kind:"requesting-permission"});
      try {
        granted = await port.requestAccess();
        if (!valid(generation)) return;
        if (!granted) {
          transition({kind:"error",code:"permission",message:"Bluetooth permission was not granted."});
          return;
        }
        if (!(await port.ensureEnabled())) {
          if (valid(generation)) transition({kind:"error",code:"disabled",message:"Bluetooth is switched off or enabling was declined."});
          return;
        }
        await doScan(generation,port);
      } catch (error) {
        reportError(generation,"permission",error);
      }
    },
    async rescan() {
      if (disposed || port.mode !== "bluetooth-le") return;
      const generation = ++epoch;
      port.cancelScan();
      release();
      if (!granted) {
        transition({kind:"error",code:"permission",message:"Bluetooth permission is required; choose Connect to request access."});
        return;
      }
      await doScan(generation,port);
    },
    async connect(deviceId) {
      if (disposed || port.mode !== "bluetooth-le") return;
      const device = devices.find((d) => d.id === deviceId);
      if (device === undefined) {
        transition({kind:"error",code:"unsupported",message:"Select a device from the latest Bluetooth scan."});
        return;
      }
      const generation = ++epoch;
      port.cancelScan();
      release();
      transition({kind:"connecting",device});
      try {
        const nextLink = await port.connect(device.id);
        if (!valid(generation)) {
          await nextLink.disconnect().catch(() => undefined);
          return;
        }
        link = nextLink;
        pairedDevice = device;
        unsubscribeLink = nextLink.onDisconnected?.((reason) => {
          if (!valid(generation)) return;
          const detachedLink = link;
          link = undefined;
          unsubscribeLink?.();
          unsubscribeLink = undefined;
          pairedDevice = undefined;
          // Some native transports emit an unplug callback before disposing
          // their GATT handle. Explicitly release it; the port must implement
          // idempotent disconnect so a spontaneous disconnect is safe.
          if (detachedLink !== undefined) void detachedLink.disconnect().catch(() => undefined);
          transition({kind:"error",code:"disconnected",message:reason ?? "Bluetooth connection was lost."});
        });
        transition({kind:"linked",device,detail:"awaiting-native-input"});
      } catch (error) {
        reportError(generation,"connection",error);
      }
    },
    verifyNativeInput(sample) {
      if (disposed) return;
      if (!sample.tracked) {
        const current = state.getState();
        if (current.kind === "ready") {
          if (port.mode === "system-spatial") {
            transition({kind:"system-pairing",deviceName:port.deviceName,instructions:port.pairingInstructions});
          } else {
            transition({kind:"linked",device:current.device,detail:"awaiting-native-input"});
          }
        }
        return;
      }
      if (port.mode === "system-spatial") {
        if (sample.evidence !== "visionos-spatial-stream") return;
        // The actual Viro SDK must be the source of this event; generic
        // Bluetooth status alone cannot prove 6DoF tracking.
        transition({kind:"ready",device:{id:"visionos-spatial-muse",name:port.deviceName},evidence:sample.evidence});
        return;
      }
      if (sample.evidence !== "verified-pen-protocol") return;
      const current = state.getState();
      if ((current.kind !== "linked" && current.kind !== "ready") ||
          pairedDevice === undefined || current.device.id !== pairedDevice.id ||
          sample.deviceId !== pairedDevice.id) return;
      transition({kind:"ready",device:pairedDevice,evidence:sample.evidence});
    },
    async cancel() {
      if (disposed) return;
      ++epoch;
      if (port.mode === "bluetooth-le") port.cancelScan();
      unsubscribeLink?.();
      unsubscribeLink = undefined;
      const lastLink = link;
      link = undefined;
      pairedDevice = undefined;
      if (lastLink !== undefined) await lastLink.disconnect().catch(() => undefined);
      transition({kind:"idle"});
    },
    dispose() {
      if (disposed) return;
      ++epoch;
      if (port.mode === "bluetooth-le") port.cancelScan();
      release();
      disposed = true;
    },
  };
}
