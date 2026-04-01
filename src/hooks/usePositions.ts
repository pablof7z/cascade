/**
 * usePositions — React hook for live position state.
 *
 * Reads exclusively from positionStore's in-memory cache.
 * positionStore is the single subscription authority (subscribes to Nostr once
 * at app startup in initializePositions). This hook observes cache mutations
 * via positionStore.onPositionsChanged — no duplicate Nostr subscriptions.
 *
 * Returns positions for a specific market or all positions for the current user.
 * Cleans up listener on unmount.
 */

import { useState, useEffect, useCallback } from 'react'
import { loadPositions, onPositionsChanged } from '../positionStore'
import type { Position } from '../positionStore'

export function usePositions(marketId?: string): {
  positions: Position[]
  loading: boolean
  error: Error | null
} {
  const getFiltered = useCallback((): Position[] => {
    const all = loadPositions()
    return marketId ? all.filter((p) => p.marketId === marketId) : all
  }, [marketId])

  const [positions, setPositions] = useState<Position[]>(getFiltered)
  const [loading] = useState(false)
  const [error] = useState<Error | null>(null)

  useEffect(() => {
    // Sync immediately in case cache changed between renders
    setPositions(getFiltered())

    // Subscribe to future cache mutations (Nostr events, addPosition, removePosition)
    const unsubscribe = onPositionsChanged(() => {
      setPositions(getFiltered())
    })

    return unsubscribe
  }, [getFiltered])

  return { positions, loading, error }
}
