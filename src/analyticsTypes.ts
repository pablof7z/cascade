// Analytics event types — anonymous, no PII, no cookies

export type AnalyticsEventType =
  | 'page_view'
  | 'market_view'
  | 'trade_placed'
  | 'discussion_interaction'
  | 'wallet_connected'
  | 'session_start'
  | 'session_heartbeat'
  | 'session_end'

export interface BaseEvent {
  type: AnalyticsEventType
  sessionId: string
  timestamp: number
}

export interface PageViewEvent extends BaseEvent {
  type: 'page_view'
  data: { path: string; referrer: string }
}

export interface MarketViewEvent extends BaseEvent {
  type: 'market_view'
  data: { marketId: string }
}

export interface TradePlacedEvent extends BaseEvent {
  type: 'trade_placed'
  data: { marketId: string; outcome: string; amount: number }
}

export interface DiscussionInteractionEvent extends BaseEvent {
  type: 'discussion_interaction'
  data: { marketId: string; action: string }
}

export interface WalletConnectedEvent extends BaseEvent {
  type: 'wallet_connected'
  data: Record<string, never>
}

export interface SessionStartEvent extends BaseEvent {
  type: 'session_start'
  data: Record<string, never>
}

export interface SessionHeartbeatEvent extends BaseEvent {
  type: 'session_heartbeat'
  data: { duration: number }
}

export interface SessionEndEvent extends BaseEvent {
  type: 'session_end'
  data: { duration: number }
}

export type AnalyticsEvent =
  | PageViewEvent
  | MarketViewEvent
  | TradePlacedEvent
  | DiscussionInteractionEvent
  | WalletConnectedEvent
  | SessionStartEvent
  | SessionHeartbeatEvent
  | SessionEndEvent

export interface AnalyticsSummary {
  dailyActiveSessions: number
  weeklyActiveSessions: number
  topMarkets: { marketId: string; views: number }[]
  funnel: { pageViews: number; marketViews: number; tradesPlaced: number }
  averageSessionDuration: number
  generatedAt: number
}
