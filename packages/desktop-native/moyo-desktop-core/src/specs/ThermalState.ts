/**
 * macOS thermal pressure, mirroring ProcessInfo.ThermalState one to one.
 * SOT: Apple Foundation ProcessInfo.ThermalState
 * SOT-KEYWORDS: desktop nitro thermal state processinfo
 */
export type ThermalState = 'nominal' | 'fair' | 'serious' | 'critical'
