import React, { useCallback, useMemo, useRef } from 'react'

import type { BuilderTree, BuilderNode, SerializeResult } from './types'
import { DevModeContext } from './DevModeContext'

// Adapter facade (Single Source of Truth)
import { initDevmodeBridge } from '../../.DEV/components/devmode/devmode-bridge'




type DevModeProviderValue = {
  ready: boolean
  selectNodeById: (id: string) => void
  getSelectedNode: () => BuilderNode | null
  querySerialize: () => SerializeResult
  initBridge: () => void
}



function createEmptyTree(): BuilderTree {
  return {
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'Frame',
        parentId: null,
        props: {},
        craft: { related: { settings: {} }, rules: {} },
        children: [],
      },
    },
  }
}

export const DevModeProvider = ({ children }: { children: React.ReactNode }) => {
  // initialize legacy bridge on mount (currently no-op placeholder)

  const ready = true

  const treeRef = useRef<BuilderTree>(createEmptyTree())

  const selectedIdRef = useRef<string | null>(null)

  const selectNodeById = useCallback((id: string) => {
    selectedIdRef.current = id
  }, [])

  const getSelectedNode = useCallback((): BuilderNode | null => {
    const id = selectedIdRef.current
    if (!id) return null
    return treeRef.current.nodes[id] ?? null
  }, [])

  const querySerialize = useCallback((): SerializeResult => {
    return {
      version: 1,
      tree: treeRef.current,
    }
  }, [])

  // mount on first render
  React.useEffect(() => {
    try {
      initDevmodeBridge()
    } catch {
      // no-op
    }
  }, [initDevmodeBridge])

  const initBridge = useCallback(() => {
    // no-op: already mounted via useEffect
  }, [])


  const value = useMemo<DevModeProviderValue>(
    () => ({
      ready,
      selectNodeById,
      getSelectedNode,
      querySerialize,
      initBridge,
    }),
    [getSelectedNode, initBridge, querySerialize, ready, selectNodeById],
  )

  return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
}



