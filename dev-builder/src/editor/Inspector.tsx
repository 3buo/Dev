import { useEditor } from '@craftjs/core'
import type { MotionPreset } from '../devmode/types'

const motionPresetOptions: Array<MotionPreset> = ['fade-in', 'bounce', 'slide-up', 'none']

export const Inspector = () => {
  const { selectedId, selectedNode, actions } = useEditor((state, query) => {
    const selected = Array.from(state.events.selected)
    const id = selected.length > 0 ? selected[0] : null
    const node = id ? query.node(id).get() : null
    return {
      selectedId: id,
      selectedNode: node,
    }
  })

  if (!selectedId || !selectedNode) {
    return (
      <aside className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold text-zinc-300">Inspector</div>
        <div className="mt-2 text-xs text-zinc-500">Selecciona un nodo</div>
      </aside>
    )
  }

  const props = selectedNode.data?.props ?? {}
  const motionPreset = (props.motionPreset ?? 'none') as MotionPreset

  const type =
    typeof selectedNode.data?.type === 'string'
      ? selectedNode.data.type
      : selectedNode.data?.displayName ?? 'Node'
  const name = selectedNode.data?.name as string | undefined
  const label = name ?? type

  return (
    <aside className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-300">Inspector</div>
          <div className="mt-1 text-xs text-zinc-500">Node ID: {selectedId}</div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300">{label}</div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Props</label>
          {type === 'TextNode' || (name ?? '').includes('TextNode') ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-400">Text</label>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
                value={String(props.text ?? '')}
                onChange={(e) => {
                  actions.setProp(selectedId, (p: { text?: string }) => {
                    p.text = e.target.value
                  })
                }}
              />
            </div>
          ) : type === 'ActionButtonNode' || (name ?? '').includes('ActionButtonNode') ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-400">Label</label>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
                value={String(props.label ?? '')}
                onChange={(e) => {
                  actions.setProp(selectedId, (p: { label?: string }) => {
                    p.label = e.target.value
                  })
                }}
              />

              <label className="text-xs text-zinc-400">Sound URL</label>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
                value={String(props.soundUrl ?? '')}
                placeholder="https://..."
                onChange={(e) => {
                  actions.setProp(selectedId, (p: { soundUrl?: string }) => {
                    p.soundUrl = e.target.value
                  })
                }}
              />
            </div>
          ) : (
            <div className="text-xs text-zinc-500">Sin inspector para este nodo.</div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Motion</label>
          <select
            className="rounded border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
            value={motionPreset}
            onChange={(e) => {
              const v = e.target.value as MotionPreset
              actions.setProp(selectedId, (p: { motionPreset?: MotionPreset }) => {
                p.motionPreset = v
              })
            }}
          >
            {motionPresetOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  )
}
