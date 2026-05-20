import './App.css'
import React from 'react'
import { DevModeProvider } from './devmode/DevModeProvider'
import { nodeTypes } from './canvas/nodeTypes'

import { Editor } from '@craftjs/core'

import { DevBuilderCanvas } from './canvas/Canvas'
import { Toolbar } from './editor/Toolbar'
import { Inspector } from './editor/Inspector'

function App() {
  // Alt + Shift + D -> DevMode panel (must be global)
  // Uses the mandatory legacy devmode UI:
  //   components/devmode/devmode.html + components/devmode/devmode.js
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        e.preventDefault()
        try {
          // Legacy devmode UI functions are attached globally by the legacy script.
          // If not present, no-op.
          if (!(window as any).__devModeIsAuthenticated) (window as any).initDevMode?.()
          else (window as any).closeDevPanel?.()
        } catch {
          // no-op
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <DevModeProvider>
      <Editor resolver={nodeTypes as any}>

        <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
          <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-400">STEP 2 · Craft.js Canvas</div>
                <h1 className="text-2xl font-black">No-Code Visual Builder</h1>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                React nodes + useNode
              </div>
            </div>

            <div className="mt-6 grid grid-cols-12 gap-4">
              <Toolbar />
              <main className="col-span-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-sm font-semibold text-zinc-300">Canvas</div>
                <div className="mt-2 text-xs text-zinc-500">Craft.js Canvas (native React nodes)</div>
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
                  <DevBuilderCanvas />
                </div>
              </main>
              <Inspector />
            </div>
          </div>
        </div>
      </Editor>
    </DevModeProvider>
  )
}

export default App



