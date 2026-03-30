/**
 * Position persistence layer.
 *
 * Stores user trade positions in localStorage with a clean schema
 * designed for eventual migration to Nostr events.
 */

export type PositionDirection = 'yes' | 'no'

export type Position = {
  id: string
  marketId: string
  marketTitle: string
  direction: PositionDirection
  quantity: number
  entryPrice: number
  costBasis: number
  timestamp: number
}

const STORAGE_KEY = 'cascade-positions'

/** Generate a unique position id */
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Load all positions from localStorage */
export function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Position[]
  } catch {
    return []
  }
}

/** Persist the full position list */
export function savePositions(positions: Position[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch {
    // quota exceeded — silently ignore
  }
}

/** Record a new trade. If the user already holds a position on the same
 *  market+direction we average into it; otherwise we create a new row. */
export function addPosition(
  marketId: string,
  marketTitle: string,
  direction: PositionDirection,
  quantity: number,
  entryPrice: number,
): Position {
  const positions = loadPositions()

  const existing = positions.find(
    (p) => p.marketId === marketId && p.direction === direction,
  )

  if (existing) {
    // Weighted-average entry price
    const totalQty = existing.quantity + quantity
    existing.entryPrice =
      (existing.entryPrice * existing.quantity + entryPrice * quantity) /
      totalQty
    existing.quantity = totalQty
    existing.costBasis = existing.entryPrice * totalQty
    existing.timestamp = Date.now()
    savePositions(positions)
    return existing
  }

  const pos: Position = {
    id: uid(),
    marketId,
    marketTitle,
    direction,
    quantity,
    entryPrice,
    costBasis: entryPrice * quantity,
    timestamp: Date.now(),
  }
  positions.push(pos)
  savePositions(positions)
  return pos
}

/** Get all positions for a specific market */
export function getPositionsForMarket(marketId: string): Position[] {
  return loadPositions().filter((p) => p.marketId === marketId)
}

/** Remove a single position by id */
export function removePosition(positionId: string): void {
  savePositions(loadPositions().filter((p) => p.id !== positionId))
}
