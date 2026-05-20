export type MotionPreset =
  | 'fade-in'
  | 'bounce'
  | 'slide-up'
  | 'none'

export type AudioEvent = 'onClick' | 'onMouseEnter'

export type BuilderNode = {
  id: string
  type: string
  parentId: string | null
  props: Record<string, unknown>
  craft?: {
    related?: {
      settings?: Record<string, unknown>
    }
    rules?: {
      [k: string]: unknown
    }
  }
  children: string[]
  motion?: {
    preset: MotionPreset
  }
  audio?: {
    soundUrl: string
    event: AudioEvent
  }
}

export type BuilderTree = {
  rootId: string
  nodes: Record<string, BuilderNode>
}

export type SerializeResult = {
  version: 1
  tree: BuilderTree
}

