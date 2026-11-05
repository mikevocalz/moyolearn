/**
 * Handle returned by `addThermalStateListener`; `remove()` stops future events.
 * SOT-KEYWORDS: desktop nitro listener subscription thermal
 */
export interface ThermalStateSubscription {
  remove: () => void
}
