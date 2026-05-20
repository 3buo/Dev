import type { BuilderTree, SerializeResult } from './types'

export function serializeTree(tree: BuilderTree): SerializeResult {
  return {
    version: 1,
    tree,
  }
}

