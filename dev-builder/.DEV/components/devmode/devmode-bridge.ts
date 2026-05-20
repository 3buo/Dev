// Adapter facade (Single Source of Truth):
// Importamos el core legacy directamente desde la fuente original.
// No duplicamos HTML/CSS/JS: solo re-exportamos lo necesario.

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
/* eslint-disable @typescript-eslint/no-explicit-any */
const legacyModule = '/legacy/devmode.js'

async function loadLegacyModule(): Promise<{ initDevMode?: () => void }> {
  return (await import(/* @vite-ignore */ legacyModule)) as { initDevMode?: () => void }
}

export type DevmodeBridgeInit = object & Record<string, never>

export function initDevmodeBridge(): void {
  // lazy-load legacy JS to avoid TS declaration coupling on external .js file
  void loadLegacyModule().then((m) => m.initDevMode?.()).catch(() => {
    // no-op
  })
}

export function toggleDevMode(): void {
  try {
    if (!(window as any).__devModeIsAuthenticated) (window as any).initDevMode?.()
    else (window as any).closeDevPanel?.()
  } catch {
    // no-op
  }
}



