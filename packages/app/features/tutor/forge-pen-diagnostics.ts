/** Diagnostic operations on the current connection; none decode or verify a pen protocol. */
export interface ForgePenDiagnosticsPort {
  discoverGattServices(): Promise<string>;
  requestBond(): Promise<string>;
  configureSpatialAccessoryHost(): Promise<string>;
  readGattCharacteristic(characteristicKey: string): Promise<string>;
  readGattDescriptor(descriptorKey: string): Promise<string>;
  setGattNotification(characteristicKey: string, enabled: boolean): Promise<string>;
  getGattDiagnosticsJson(): string;
  stopGattDiagnostics(): void;
}

/** A discovered characteristic's opaque key is passed back unchanged to the native transport. */
export interface ForgePenCharacteristic {
  readonly key: string;
  readonly uuid: string;
  readonly serviceUuid: string;
  readonly properties: number;
  readonly descriptors: readonly { readonly key: string; readonly uuid: string }[];
}

/** Bounded native observations for the development probe, with raw bytes left uninterpreted. */
export interface ForgePenDiagnostics {
  readonly connected: boolean;
  readonly connectionGeneration: number;
  readonly bondState: number | null;
  readonly nativeCapturing: boolean | null;
  readonly blocked: boolean | null;
  readonly servicesState: string;
  readonly totalNotifications: number;
  readonly lastSequence: number;
  readonly characteristics: readonly ForgePenCharacteristic[];
  readonly inventoryTruncated: boolean;
  readonly events: readonly string[];
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown) => typeof value === 'string' ? value : '';
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Rejects invalid transport snapshots and bounds displayed metadata without inventing decoded fields. */
export function parseForgePenDiagnostics(json: string): ForgePenDiagnostics {
  if (json.length > 1024 * 1024) throw new Error('The Bluetooth diagnostic snapshot is too large.');
  const data = object(JSON.parse(json));
  if (data.version !== 1 || typeof data.connected !== 'boolean' ||
      !['connectionGeneration', 'totalNotifications', 'lastSequence'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]))) throw new Error('Bluetooth diagnostics are unavailable in this app build.');
  const characteristics: ForgePenCharacteristic[] = [];
  const services = Array.isArray(data.services) ? data.services : [];
  let inventoryTruncated = data.inventoryTruncated === true || services.length > 64;
  for (const service of services.slice(0, 64)) {
    const row = object(service);
    const rows = Array.isArray(row.characteristics) ? row.characteristics : [];
    for (const item of rows) {
      if (characteristics.length >= 256) { inventoryTruncated = true; break; }
      const value = object(item);
      if (typeof value.key !== 'string' || typeof value.uuid !== 'string' || typeof value.properties !== 'number' || !Number.isFinite(value.properties)) continue;
      const rawDescriptors = Array.isArray(value.descriptors) ? value.descriptors : [];
      if (rawDescriptors.length > 32) inventoryTruncated = true;
      const descriptors = rawDescriptors.slice(0, 32).map(object)
        .filter((descriptor) => typeof descriptor.key === 'string' && typeof descriptor.uuid === 'string')
        .map((descriptor) => ({ key: descriptor.key as string, uuid: descriptor.uuid as string }));
      characteristics.push({ key: value.key, uuid: value.uuid, serviceUuid: string(row.uuid), properties: value.properties, descriptors });
    }
  }
  const events = (Array.isArray(data.events) ? data.events : []).slice(-32).map(object).filter((event) =>
    ['sequence', 'connectionGeneration', 'elapsedRealtimeMs'].every((key) => typeof event[key] === 'number' && Number.isFinite(event[key])) && typeof event.kind === 'string'
  ).map((event) => {
    return [
      `#${number(event.sequence)}`, `t=${number(event.elapsedRealtimeMs)}ms`,
      `generation=${number(event.connectionGeneration)}`, string(event.kind).slice(0, 80),
      string(event.characteristicKey).slice(0, 160),
      typeof event.wallTimeMs === 'number' && Number.isFinite(event.wallTimeMs) ? `wall=${event.wallTimeMs}ms` : '',
      typeof event.status === 'number' ? `status=${number(event.status)}` : '',
      typeof event.byteLength === 'number' ? `bytes=${number(event.byteLength)}` : '',
      typeof event.hex === 'string' ? `hex=${event.hex.slice(0, 1024)}` : '',
      event.truncated === true ? '[truncated]' : '', string(event.message).slice(0, 240),
    ].filter(Boolean).join(' ');
  });
  return { inventoryTruncated, nativeCapturing: typeof data.capturing === 'boolean' ? data.capturing : null, blocked: typeof data.blocked === 'boolean' ? data.blocked : null, connected: data.connected, connectionGeneration: number(data.connectionGeneration), bondState: typeof data.bondState === 'number' && Number.isFinite(data.bondState) ? data.bondState : null, servicesState: string(data.servicesState), totalNotifications: number(data.totalNotifications), lastSequence: number(data.lastSequence), characteristics, events };
}
