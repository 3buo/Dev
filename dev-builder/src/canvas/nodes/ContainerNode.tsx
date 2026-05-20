import React from 'react'
import { useNode } from '@craftjs/core'

export type ContainerNodeProps = {
  className?: string
  children?: React.ReactNode
}

export const ContainerNode = ({ className, children }: ContainerNodeProps) => {
  const {
    connectors: { connect, drag },
    selected,
  } = useNode((node) => ({ selected: node.events.selected }))

  return (
    <div
      ref={(dom) => {
        connect(dom!)
        drag(dom!)
      }}
      className={className ?? 'min-h-[40px] rounded border border-zinc-800 bg-zinc-900/20 p-4'}
      data-selected={selected ? 'true' : 'false'}
      style={{ resize: 'both', overflow: 'auto' }}
    >
      {children}
    </div>
  )
}

ContainerNode.craft = {
  props: {
    className: 'min-h-[40px] rounded border border-zinc-800 bg-zinc-900/20 p-4',
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: {
      className: 'min-h-[40px] rounded border border-zinc-800 bg-zinc-900/20 p-4',
    },
  },
}


