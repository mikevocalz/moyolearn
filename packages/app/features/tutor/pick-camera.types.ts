/**
 * An image the user captures with the device camera for the tutor session.
 *
 * The dimensions travel with the uri so the attachment can be laid out without
 * a second native measuring pass.
 */
export interface CameraImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Resolves null when the user cancels or declines permission. The caller
 * treats that as "do nothing" rather than an error to surface.
 */
export type PickCamera = () => Promise<CameraImage | null>;
