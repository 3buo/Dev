import { useEffect, useMemo } from 'react'
import { useNode } from '@craftjs/core'
import { Howl } from 'howler'
import { motion } from 'framer-motion'

export type ActionButtonNodeProps = {
  label: string
  soundUrl?: string
  motionPreset?: 'fade-in' | 'bounce' | 'slide-up' | 'none'
}

type AnyVariants = Record<string, unknown>

const presetVariants: AnyVariants = {

  'fade-in': { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.25 } } },
  bounce: {
    hidden: { transform: 'scale(0.95)', opacity: 0 },
    show: {
      transform: 'scale(1)',
      opacity: 1,
      transition: { duration: 0.35, type: 'spring', bounce: 0.5 },
    },
  },
  'slide-up': {
    hidden: { y: 10, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.25 } },
  },
  none: { hidden: {}, show: {} },
}


export const ActionButtonNode = ({ label, soundUrl, motionPreset }: ActionButtonNodeProps) => {
  const {
    connectors: { connect, drag },
    selected,
    actions: { setProp },
  } = useNode((node) => ({ selected: node.events.selected }))

  useEffect(() => {
    if (typeof label !== 'string')
      setProp((p: { label?: string }) => {
        p.label = 'Action'
      })
  }, [label, setProp])


  const sound = useMemo(() => {
    if (!soundUrl) return null
    try {
      return new Howl({ src: [soundUrl], html5: true })
    } catch {
      return null
    }
  }, [soundUrl])

  const preset = (motionPreset && presetVariants[motionPreset] ? motionPreset : 'none') as
'tfade-in' | 'bounce' | 'slide-up' | 'none'


  return (
    <motion.button

      ref={(dom) => {
        if (!dom) return
        connect(dom)
        drag(dom)
      }}

      initial="hidden"
      animate="show"
      variants={presetVariants[preset] as never}

      data-selected={selected ? 'true' : 'false'}

      type="button"
      onClick={() => {
        sound?.play()
      }}
      className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white shadow"
    >
      {label}
    </motion.button>
  )
}

ActionButtonNode.craft = {
  props: {
    label: 'ActionButton',
    soundUrl: '',
    motionPreset: 'fade-in',
  },
  rules: {
    canDrag: () => true,
    canMoveIn: () => true,
    canDrop: () => true,
  },
  related: {
    settings: {
      label: 'ActionButton',
      soundUrl: '',
      motionPreset: 'fade-in',
    },
  },
}


