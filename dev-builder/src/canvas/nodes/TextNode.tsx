import { useEffect } from 'react'
import { useNode } from '@craftjs/core'

export type TextNodeProps = {
  text: string
  className?: string
}

export const TextNode = ({ text, className }: TextNodeProps) => {
  const {
    connectors: { connect, drag },
    selected,
    actions: { setProp },
  } = useNode((node) => ({ selected: node.events.selected }))

  useEffect(() => {
    // ensure initial props exist
    if (typeof text !== 'string') setProp((p: { text?: string }) => {
      p.text = ''
    })
  }, [setProp, text])


  return (
    <div
      ref={(dom) => {
        connect(dom!)
        drag(dom!)
      }}
      data-selected={selected ? 'true' : 'false'}
      className={className ?? 'text-zinc-100'}
    >
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  )
}

TextNode.craft = {
  rules: {
    canDrag: () => true,
    canMoveIn: () => true,
    canDrop: () => true,
  },
  related: {
    settings: {
      text: 'Texto',
      className: 'text-zinc-100',
    },
  },
  props: {
    text: 'Texto',
    className: 'text-zinc-100',
  },
}


