import type { EventSubscription } from 'expo';
import type { PanelClosedEvent } from './PanelClosedEvent';

/**
 * Opens React Native components as separate PICO panels, each its own
 * Activity in its own task. Each panel is a second surface on the app's one
 * React Native runtime, so module state (Zustand stores included) is shared
 * with the main window. Exposed as {@linkcode spatialPanels}.
 *
 * Placement belongs to the OS, and the user can move the panel.
 */
export interface SpatialPanels {
  /**
   * True only on builds whose manifest declares the panel activity (the pico
   * flavor). On every other build {@linkcode SpatialPanels.openPanel} rejects,
   * so render the content in the main window instead.
   */
  readonly isAvailable: boolean;

  /**
   * Opens `name`, a component registered with `AppRegistry.registerComponent`,
   * in its own panel. Resolves once the launch is handed to the OS; listen
   * with {@linkcode SpatialPanels.addOnPanelOpenedListener} to learn when it
   * is on screen. Opening a name that is already open does nothing; update
   * what it shows through shared state.
   *
   * @param size The panel's size in dp. On PICO OS 5 it is the only way to
   *   size a third-party window (launch options read at creation).
   * @param props Initial props, delivered to the component as strings.
   * @throws When {@linkcode SpatialPanels.isAvailable} is false, or the app has
   *   no current activity to launch from.
   */
  openPanel(name: string, size: PanelSizeDp, props?: Record<string, string>): Promise<void>;

  /**
   * Closes the panel showing `name`. Resolves without effect when none is
   * open. The close event reports `reason: 'app'`.
   */
  closePanel(name: string): Promise<void>;

  /** Called each time a panel finishes opening. */
  addOnPanelOpenedListener(listener: (event: { name: string }) => void): EventSubscription;

  /** Called each time a panel closes, with {@linkcode PanelClosedEvent.reason}. */
  addOnPanelClosedListener(listener: (event: PanelClosedEvent) => void): EventSubscription;
}

/** A panel's size in dp. */
export interface PanelSizeDp {
  widthDp: number;
  heightDp: number;
}
