import { Canvas as CraftCanvas } from '@craftjs/core'

import type { SerializeResult } from '../devmode/types'
import { nodeTypes } from './nodeTypes'

export type DevBuilderCanvasProps = {
  initialSerialized?: unknown
  onReady?: (api: {
    serialize: () => SerializeResult
    selectNode: (id: string) => void
    getSelectedNodeId: () => string | null
  }) => void
}

export const DevBuilderCanvas = ({ initialSerialized }: DevBuilderCanvasProps) => {
  return <CraftCanvas resolver={nodeTypes as unknown as Record<string, unknown>} initialSerialized={initialSerialized as unknown} />
}




