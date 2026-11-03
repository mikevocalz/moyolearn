import { PermissionsAndroid, Platform } from "react-native";
import type { BlePenPort, PenDevice, PenLink } from "./types";

/**
 * The explicit native Nitro v1 interface; dependency injected so the portable
 * pairing dialog never loads native modules on visionOS or the web.
 */
export interface ForgeBluetoothAndroid {
  isEnabled(): boolean;
  openBluetoothSettings(): void;
  startScan(): void;
  stopScan(): void;
  getDevicesJson(): string;
  getScanError(): string;
  connect(deviceId: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  isSystemChooserAvailable?(): boolean;
  chooseMuseWithSystem?(): Promise<string>;
  cancelSystemChooser?(): void;
  listAssociatedMuseDevices?(): Promise<string>;
}
export interface AndroidBleOptions {
  readonly scanDurationMs?: number;
  readonly connectionPollMs?: number;
}

/**
 * Native Android BLE GATT support. Bluetooth pairing is system-owned;
 * this adapter requests real Android permissions only after an explicit tap.
 * A GATT link does not imply Muse protocol/pressure/6DoF support.
 */
export function createAndroidBlePenPort(
  native: ForgeBluetoothAndroid,
  options: AndroidBleOptions = {},
): BlePenPort {
  const duration = options.scanDurationMs ?? 6000;
  const polling = options.connectionPollMs ?? 1200;
  if (!Number.isFinite(duration) || duration < 500 || duration > 30000) {
    throw new RangeError("scanDurationMs must be 500..30000");
  }
  if (!Number.isFinite(polling) || polling < 250 || polling > 60000) {
    throw new RangeError("connectionPollMs must be 250..60000");
  }
  let scanGeneration = 0;
  let connectionGeneration = 0;
  let pendingConnection: number | undefined;
  let cancelPending: (() => void) | undefined;
  let chooserGeneration = 0;
  const chooseWithSystem = native.chooseMuseWithSystem?.bind(native);
  const listAssociated = native.listAssociatedMuseDevices?.bind(native);

  return {
    mode: "bluetooth-le",
    ...(Platform.OS === "android" && Number(Platform.Version) >= 33 && listAssociated && native.isSystemChooserAvailable?.() === true ? {
      async loadAssociatedDevices(): Promise<readonly PenDevice[]> {
        const generation = ++chooserGeneration;
        const raw: unknown = JSON.parse(await listAssociated());
        if (generation !== chooserGeneration) throw new Error("Association history request cancelled.");
        if (!Array.isArray(raw) || raw.length > 50) throw new Error("Invalid association history.");
        return raw.map((item: unknown): PenDevice => {
          if (!item || typeof item !== "object") throw new Error("Invalid association history.");
          const value = item as Record<string, unknown>;
          if (typeof value.id !== "string" || !value.id.trim() || typeof value.name !== "string" || !value.name.trim() ||
              typeof value.bonded !== "boolean" || value.selectionSource !== "association-history" ||
              typeof value.associationId !== "number" || !Number.isSafeInteger(value.associationId) || value.associationId <= 0) {
            throw new Error("Invalid association history.");
          }
          // A historical ScanResult is not a current signal-strength measurement.
          return { id: value.id, name: value.name, bonded: value.bonded,
            selectionSource: "association-history", associationId: value.associationId };
        });
      },
    } : {}),
    ...(Platform.OS === "android" && native.isSystemChooserAvailable?.() === true && chooseWithSystem && native.cancelSystemChooser ? {
      async chooseDevice(): Promise<PenDevice> {
        const generation = ++chooserGeneration;
        const raw: unknown = JSON.parse(await chooseWithSystem());
        if (generation !== chooserGeneration) throw new Error("System device selection cancelled.");
        if (!raw || typeof raw !== "object") throw new Error("Invalid system device selection.");
        const selected = raw as Record<string, unknown>;
        if (typeof selected.id !== "string" || !selected.id.trim() ||
            typeof selected.name !== "string" || !selected.name.trim() ||
            typeof selected.bonded !== "boolean" || selected.selectionSource !== "companion-device-manager") {
          throw new Error("Invalid system device selection.");
        }
        return { id: selected.id, name: selected.name, bonded: selected.bonded,
          ...(typeof selected.rssi === "number" && Number.isFinite(selected.rssi) ? {rssi: selected.rssi} : {}) };
      },
    } : {}),
    async requestAccess() {
      if (Platform.OS !== "android") return false;
      const api = typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version);
      const permissions = api >= 31
        ? ["android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_CONNECT"]
        : ["android.permission.ACCESS_FINE_LOCATION"];
      const statuses = await PermissionsAndroid.requestMultiple(permissions as Array<"android.permission.BLUETOOTH_SCAN" | "android.permission.BLUETOOTH_CONNECT" | "android.permission.ACCESS_FINE_LOCATION">);
      return permissions.every((name) => statuses[name as keyof typeof statuses] === PermissionsAndroid.RESULTS.GRANTED);
    },
    async ensureEnabled() {
      return Platform.OS === "android" && native.isEnabled();
    },
    async scan() {
      if (Platform.OS !== "android") return [];
      const generation = ++scanGeneration;
      native.startScan();
      let interrupted = false;
      try {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => { cancelPending = undefined; resolve(); }, duration);
          cancelPending = () => { interrupted = true; clearTimeout(timeout); cancelPending = undefined; resolve(); };
        });
        if (interrupted) return [];
        const error = native.getScanError();
        if (error) throw new Error(error);
        const data: unknown = JSON.parse(native.getDevicesJson());
        if (!Array.isArray(data)) throw new Error("Invalid native BLE scan result");
        const devices: PenDevice[] = [];
        for (const item of data.slice(0, 50)) {
          if (!item || typeof item !== "object") continue;
          const d = item as Record<string, unknown>;
          if (typeof d.id !== "string" || typeof d.name !== "string" || !d.id || !d.name) continue;
          const rssi = d.rssi;
          devices.push({
            id: d.id, name: d.name,
            ...(typeof d.bonded === "boolean" ? { bonded: d.bonded } : {}),
            ...(typeof rssi === "number" && Number.isFinite(rssi) ? { rssi } : {}),
          });
        }
        return devices;
      } finally {
        if (generation === scanGeneration) native.stopScan();
      }
    },
    cancelScan() {
      ++chooserGeneration;
      native.cancelSystemChooser?.();
      ++scanGeneration;
      if (pendingConnection !== undefined) {
        pendingConnection = undefined;
        ++connectionGeneration;
        native.disconnect();
      }
      cancelPending?.();
      native.stopScan();
    },
    async connect(id) {
      const generation = ++connectionGeneration;
      pendingConnection = generation;
      try {
        if (!(await native.connect(id))) throw new Error("Bluetooth GATT connection failed.");
        if (generation !== connectionGeneration) throw new Error("Bluetooth connection cancelled.");
      } finally {
        if (pendingConnection === generation) pendingConnection = undefined;
      }
      let disposed = false;
      let pollTimer: ReturnType<typeof setInterval> | undefined;
      const closeNative = () => {
        // A disconnected link still owns a native GATT object. Always close it
        // exactly once, including the spontaneous-disconnect and scan-error
        // paths, so repeated pairing cannot leak native BLE resources.
        if (disposed) return;
        disposed = true;
        if (pollTimer !== undefined) clearInterval(pollTimer);
        pollTimer = undefined;
        native.disconnect();
      };
      const link: PenLink = {
        async disconnect() {
          closeNative();
        },
        onDisconnected(listener) {
          if (disposed) return () => undefined;
          if (pollTimer !== undefined) clearInterval(pollTimer);
          pollTimer = setInterval(() => {
            if (disposed) return;
            let reason = "Bluetooth link disconnected.";
            try {
              if (native.isConnected()) return;
            } catch (error) {
              reason = error instanceof Error ? error.message : "Bluetooth link was lost.";
            }
            try {
              closeNative();
            } catch (error) {
              reason = error instanceof Error ? error.message : reason;
            }
            listener(reason);
          }, polling);
          return () => {
            if (pollTimer !== undefined) clearInterval(pollTimer);
            pollTimer = undefined;
          };
        },
      };
      return link;
    },
  };
}
