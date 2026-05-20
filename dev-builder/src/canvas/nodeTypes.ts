import { TextNode } from './nodes/TextNode'
import { ContainerNode } from './nodes/ContainerNode'
import { ActionButtonNode } from './nodes/ActionButtonNode'


// resolver map used by <Editor resolver={...}> and <Canvas resolver={...}>
export const nodeTypes = {
  Text: TextNode,
  Container: ContainerNode,
  ActionButton: ActionButtonNode,
}

