import { useNode } from '@craftjs/core'
import type { MotionPreset } from '../devmode/types'

const motionPresetOptions: Array<MotionPreset> = ['fade-in', 'bounce', 'slide-up', 'none']

export const Inspector = () => {
  const { actions, selected, id, node } = useNode((n) => ({
    selected: n.events.selected,
    id: n.id,
    node: n,
  }))

  const props = node.data?.props ?? {}
  const motionPreset = (props.motionPreset ?? 'none') as MotionPreset

  if (!selected) {
    return (
      <aside className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold text-zinc-300">Inspector</div>
        <div className="mt-2 text-xs text-zinc-500">Selecciona un nodo</div>
      </aside>
    )
  }

  const type = node.data?.type as string | undefined
  const name = node.data?.name as string | undefined
  const label = name ?? type

  return (
    <aside className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-300">Inspector</div>
          <div className="mt-1 text-xs text-zinc-500">Node ID: {id}</div>
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
                  actions.setProp((p: { text?: string }) => {
                    p.text = e.target.value
                  }, 0)
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
                  actions.setProp((p: { label?: string }) => {
                    p.label = e.target.value
                  }, 0)
                }}
              />


              <label className="text-xs text-zinc-400">Sound URL</label>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
                value={String(props.soundUrl ?? '')}
                placeholder="https://..."
                onChange={(e) => {
                  actions.setProp((p: { soundUrl?: string }) => {
                    p.soundUrl = e.target.value
                  }, 0)
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
              actions.setProp((p: { motionPreset?: MotionPreset }) => {
                p.motionPreset = v
              }, 300)
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


