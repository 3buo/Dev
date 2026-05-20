import React from 'react'

export type DevModeSandboxProps = {
  isOpen: boolean
  onCloseRequested: () => void
  children?: React.ReactNode
}

export function DevModeSandbox({ isOpen, onCloseRequested, children }: DevModeSandboxProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const shadowRootRef = React.useRef<ShadowRoot | null>(null)

  React.useEffect(() => {
    if (!hostRef.current) return
    if (shadowRootRef.current) return
    shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' })
  }, [])

  // The legacy core uses document.body/head and global IDs.
  // This sandbox provides a dedicated host for any React-managed overlay UI,
  // but we cannot fully intercept legacy appendChild/head injection without
  // patching the legacy core. We keep this component as the React-facing
  // encapsulation boundary.

  return (
    <div
      ref={hostRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000000,
        pointerEvents: isOpen ? 'auto' : 'none',
        display: 'block',
      }}
      aria-hidden={!isOpen}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isOpen ? 'rgba(0,0,0,0.35)' : 'transparent',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
        onMouseDown={(e) => {
          // clicking backdrop closes; only when open
          if (!isOpen) return
          e.preventDefault()
          e.stopPropagation()
          onCloseRequested()
        }}
      />
      {isOpen ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 420,
            maxWidth: '94vw',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

