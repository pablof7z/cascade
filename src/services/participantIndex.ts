/**
 * ParticipantIndex Service
 * Tracks cross-market user activity persisted to localStorage
 */

const PARTICIPANT_INDEX_KEY = 'cascade-participant-index'

export type UserActivity = {
  marketIds: string[]           // Markets with positions
  createdMarketIds: string[]    // Markets created by user
  totalPnL: number              // Aggregate P&L across markets
  tradeCount: number            // Total trades executed
  discussionPostIds: string[]   // Discussion posts authored
  lastActiveAt: number          // Last activity timestamp
}

export type ParticipantIndex = Record<string, UserActivity>

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function emptyActivity(): UserActivity {
  return {
    marketIds: [],
    createdMarketIds: [],
    totalPnL: 0,
    tradeCount: 0,
    discussionPostIds: [],
    lastActiveAt: Date.now(),
  }
}

export function loadParticipantIndex(): ParticipantIndex {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(PARTICIPANT_INDEX_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ParticipantIndex
  } catch {
    return {}
  }
}

export function saveParticipantIndex(index: ParticipantIndex): void {
  if (!canUseStorage()) return
  localStorage.setItem(PARTICIPANT_INDEX_KEY, JSON.stringify(index))
}

export function getOrCreateActivity(index: ParticipantIndex, pubkey: string): UserActivity {
  return index[pubkey] ?? emptyActivity()
}

export function recordTrade(
  pubkey: string,
  marketId: string,
  pnlDelta: number,
): void {
  const index = loadParticipantIndex()
  const activity = getOrCreateActivity(index, pubkey)
  
  const updatedActivity: UserActivity = {
    ...activity,
    marketIds: activity.marketIds.includes(marketId)
      ? activity.marketIds
      : [...activity.marketIds, marketId],
    totalPnL: activity.totalPnL + pnlDelta,
    tradeCount: activity.tradeCount + 1,
    lastActiveAt: Date.now(),
  }
  
  saveParticipantIndex({ ...index, [pubkey]: updatedActivity })
}

export function recordMarketCreation(pubkey: string, marketId: string): void {
  const index = loadParticipantIndex()
  const activity = getOrCreateActivity(index, pubkey)
  
  const updatedActivity: UserActivity = {
    ...activity,
    createdMarketIds: activity.createdMarketIds.includes(marketId)
      ? activity.createdMarketIds
      : [...activity.createdMarketIds, marketId],
    lastActiveAt: Date.now(),
  }
  
  saveParticipantIndex({ ...index, [pubkey]: updatedActivity })
}

export function recordDiscussionPost(pubkey: string, postId: string): void {
  const index = loadParticipantIndex()
  const activity = getOrCreateActivity(index, pubkey)
  
  const updatedActivity: UserActivity = {
    ...activity,
    discussionPostIds: [...activity.discussionPostIds, postId],
    lastActiveAt: Date.now(),
  }
  
  saveParticipantIndex({ ...index, [pubkey]: updatedActivity })
}

export function getUserActivity(pubkey: string): UserActivity | null {
  const index = loadParticipantIndex()
  return index[pubkey] ?? null
}

export function getAllParticipants(): Array<{ pubkey: string; activity: UserActivity }> {
  const index = loadParticipantIndex()
  return Object.entries(index)
    .map(([pubkey, activity]) => ({ pubkey, activity }))
    .sort((a, b) => b.activity.totalPnL - a.activity.totalPnL)
}
