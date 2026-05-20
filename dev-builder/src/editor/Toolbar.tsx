import { useEditor } from '@craftjs/core'

type BlueprintTypeKey = 'Text' | 'Container' | 'ActionButton'

type Blueprint = {
  name: string
  type: BlueprintTypeKey
}

const blueprints: Blueprint[] = [
  { name: 'Text', type: 'Text' },
  { name: 'Container', type: 'Container' },
  { name: 'ActionButton', type: 'ActionButton' },
]

const buildProps = (type: BlueprintTypeKey): Record<string, unknown> => {
  if (type === 'Text') return { text: 'Texto', className: 'text-zinc-100' }
  if (type === 'ActionButton')
    return { label: 'Action', soundUrl: '', motionPreset: 'fade-in' }
  return { className: 'min-h-[40px] rounded border border-zinc-800 bg-zinc-900/20 p-4' }
}

export const Toolbar = () => {
  const { connectors, query, actions } = useEditor((state: unknown) => {
    const s = state as {
      connectors: { create?: (node: unknown) => void }
      query: { createNode?: (args: { type: string; props: Record<string, unknown> }) => unknown }
      actions: unknown
    }
    return {
      connectors: s.connectors,
      query: s.query,
      actions: s.actions,
    }
  })

  const addBlueprintNode = (type: BlueprintTypeKey) => {
    const props = buildProps(type)

    const node = query.createNode?.({ type, props })
    if (node) {
      connectors.create?.(node)
      return
    }

    // Craft.js actions types are generic; use safe runtime checks.
    const actionsAny = actions as unknown as {
      add?: (node: unknown) => void
      addNode?: (args: { type: string; props: Record<string, unknown> }) => void
      addNodeTree?: (args: unknown) => void
    }

    if (typeof actionsAny.add === 'function') actionsAny.add(node)
    else if (typeof actionsAny.addNode === 'function') actionsAny.addNode({ type, props })
    else if (typeof actionsAny.addNodeTree === 'function') actionsAny.addNodeTree({ type, props })

  }


  return (
    <aside className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">

      <div className="text-sm font-semibold text-zinc-300">Toolbar</div>
      <div className="mt-2 text-xs text-zinc-500">Click to add nodes (STEP 2)</div>

      <div className="mt-4 flex flex-col gap-2">
        {blueprints.map((bp) => (
          <button
            key={bp.type}
            type="button"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-200 hover:border-indigo-500/40 hover:bg-zinc-900"
            onClick={() => addBlueprintNode(bp.type)}
          >
            + {bp.name}
          </button>
        ))}
      </div>
    </aside>
  )
}

