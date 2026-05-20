import { createContext, useContext } from 'react'

import type { BuilderNode, SerializeResult } from './types'

type DevModeProviderValue = {
  ready: boolean
  selectNodeById: (id: string) => void
  getSelectedNode: () => BuilderNode | null
  querySerialize: () => SerializeResult
  // Placeholder for future `.DEV/components/devmode` bridge
  initBridge: () => void
}

export const DevModeContext = createContext<DevModeProviderValue | null>(null)

export function useDevMode() {
  const v = useContext(DevModeContext)
  if (!v) throw new Error('useDevMode must be used inside DevModeProvider')
  return v
}

