// Adapter facade (Single Source of Truth):
// Importamos el core legacy directamente desde la fuente original.
// No duplicamos HTML/CSS/JS: solo re-exportamos lo necesario.

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { initDevMode } from '../../../../components/devmode/devmode.js'

export type DevmodeBridgeInit = object & Record<string, never>

export function initDevmodeBridge(): void {
  initDevMode()
}


