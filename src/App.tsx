import { useEffect, useReducer, useRef } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'
import { TestnetProvider } from './testnetConfig'
import './App.css'
import {
  ACTOR_LABELS,
  STARTING_BANKROLL,
  applyBuy,
  applyRedeem,
  createEmptyMarket,
  deriveActorMetrics,
  priceLong,
  type ActorId,
  type Market,
  type MarketKind,
  type Side,
  type ThesisDefinition,
  type TradeKind,
} from './market'
import type { HistoryPoint } from './PriceChart'
import {
  load,
  save,
  mergeLocalAndNostr,
  addPendingPublish,
  getPendingPublishes,
  removePendingPublish,
  incrementPendingRetries,
  type MarketEntry,
} from './storage'
import { recordTrade, recordMarketCreation } from './services/participantIndex'
import {
  publishDeletionEvent,
  fetchAllMarkets,
  subscribeToAllMarkets,
} from './services/marketService'
import { publishMarket } from './services/nostrService'
import { useNostr } from './context/NostrContext'
import { initializePositions } from './positionStore'
import { initializeBookmarks } from './bookmarkStore'
import LandingPage from './LandingPage'
import MarketDetail from './MarketDetail'
import ThreadPage from './ThreadPage'
import ThesisBuilder from './ThesisBuilder'
import Portfolio from './Portfolio'
import Profile from './Profile'
import ProfilePage from './ProfilePage'
import Leaderboard from './Leaderboard'
import BookmarksPage from './BookmarksPage'
import Activity from './Activity'
import Blog from './Blog'
import HowItWorks from './HowItWorks'
import { TermsOfService, PrivacyPolicy } from './LegalPages'
import NavHeader from './NavHeader'
import OnboardingSplit from './OnboardingSplit'
import WalletPage from './WalletPage'
import HireAgents from './HireAgents'
import EnrollAgent from './EnrollAgent'
import AgentDashboard from './AgentDashboard'
import AgentsPage from './AgentsPage'
import FieldsList from './FieldsList'
import DashboardOverview from './DashboardOverview'
import TreasuryPage from './TreasuryPage'
import ActivityFeed from './ActivityFeed'
import SettingsPage from './SettingsPage'
import FieldDetail from './FieldDetail'
import EmbedPage from './EmbedPage'
import EmbedLanding from './EmbedLanding'
import NotFoundPage from './NotFoundPage'
import TestnetBanner from './components/TestnetBanner'
import Footer from './components/Footer'
import AnalyticsDashboard from './AnalyticsDashboard'
import { initAnalytics, destroyAnalytics, trackPageView } from './analytics'
import { initPosthog, trackPageView as posthogTrackPageView } from './lib/posthog'
import { initResolutionService, resolveMarket } from './services/resolutionService'

type ToastTone = 'good' | 'warn' | 'neutral'

type Toast = {
  title: string
  body: string
  tone: ToastTone
}

type State = {
  markets: Record<string, MarketEntry>
  toast?: Toast
  marketsLoading: boolean
}

export type Action =
  | {
      type: 'CREATE_MARKET'
      id?: string
      title: string
      description: string
      seedWithUser: boolean
      initialSide?: Side
      initialSats?: number
      kind?: MarketKind
      thesis?: ThesisDefinition
      creatorPubkey: string
      endDate?: string
    }
  | {
      type: 'TRADE'
      marketId: string
      actor: ActorId
      kind: TradeKind
      side: Side
      amount: number
    }
  | {
      type: 'APPLY_EXTERNAL_RESULT'
      marketId: string
      market: Market
      detail: string
      tone: ToastTone
      basisTradeId: string
    }
  | { type: 'DELETE_MARKET'; marketId: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'HYDRATE_FROM_NOSTR'; markets: Market[]; marketsLoading?: boolean }
  | {
      type: 'SYNC_MARKET'
      marketId: string
      market: Market
      isDeletion?: boolean
    }
  | { type: 'MARK_PUBLISHED'; marketId: string; publishedMarket: Market }
  | {
      type: 'RESOLVE_MARKET'
      marketId: string
      outcome: 'YES' | 'NO'
      outcomePrice: number
    }

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const tokenFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatTokens(value: number) {
  return tokenFormatter.format(value)
}

function appendHistoryPoint(history: HistoryPoint[], market: Market): HistoryPoint[] {
  const price = priceLong(market.qLong, market.qShort, market.b)
  const lastTime = history.length > 0 ? history[history.length - 1].time : 0
  const time = Math.max(Math.floor(Date.now() / 1000), lastTime + 1)
  return [...history, { time, priceLong: price, reserve: market.reserve }]
}

function withUserDelta(previousMarket: Market, nextMarket: Market) {
  const pnlDelta =
    deriveActorMetrics(nextMarket, 'you').totalValue -
    deriveActorMetrics(previousMarket, 'you').totalValue
  if (!nextMarket.lastTrade) return nextMarket
  return {
    ...nextMarket,
    lastTrade: { ...nextMarket.lastTrade, pnlDelta },
  }
}

function commitMarketResult(
  entry: MarketEntry,
  previousMarket: Market,
  nextMarket: Market,
  detail: string,
  tone: ToastTone,
): { entry: MarketEntry; toast: Toast } {
  const market = withUserDelta(previousMarket, nextMarket)
  return {
    entry: {
      market,
      history: appendHistoryPoint(entry.history, market),
    },
    toast: { title: 'Market rebalanced!', body: detail, tone },
  }
}

function errorToast(body: string): Toast {
  return { title: 'Order rejected', body, tone: 'warn' }
}

function initState(): State {
  const persisted = load()
  return {
    markets: persisted ?? {},
    marketsLoading: true,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CREATE_MARKET': {
      const title = action.title.trim()
      const description = action.description.trim()
      if (!title) {
        return { ...state, toast: errorToast('Markets need a title before they can absorb capital.') }
      }

      const market = createEmptyMarket({
        slug: action.id,
        title,
        description: description || 'User-created scenario market with fully transparent fake settlement.',
        kind: action.kind,
        thesis: action.thesis,
        creatorPubkey: action.creatorPubkey,
        endDate: action.endDate,
      })

      if (!action.seedWithUser) {
        const entry: MarketEntry = {
          market,
          history: appendHistoryPoint([], market),
        }
        // Track market creation in participant index
        if (market.creatorPubkey) {
          recordMarketCreation(market.creatorPubkey, market.slug)
        }
        return {
          ...state,
          markets: { ...state.markets, [market.slug]: entry },
          toast: {
            title: 'Market ready',
            body: `${title} is live. Everyone starts flat until the first trade lands.`,
            tone: 'neutral',
          },
        }
      }

      const seeded = applyBuy(
        market,
        action.initialSide ?? 'LONG',
        action.initialSats ?? 0,
        'you',
      )
      if (!seeded) {
        return {
          ...state,
          toast: errorToast(
            `You only have ${formatCurrency(STARTING_BANKROLL)} in your market wallet.`,
          ),
        }
      }

      const seededMarket = withUserDelta(market, seeded.market)
      const entry: MarketEntry = {
        market: seededMarket,
        history: appendHistoryPoint(appendHistoryPoint([], market), seededMarket),
      }
      // Track market creation and initial trade in participant index
      if (market.creatorPubkey) {
        recordMarketCreation(market.creatorPubkey, market.slug)
        recordTrade(market.creatorPubkey, market.slug, 0) // Initial seed trade
      }
      return {
        ...state,
        markets: { ...state.markets, [market.slug]: entry },
        toast: {
          title: 'Market rebalanced!',
          body: `${seeded.detail} ${ACTOR_LABELS.you} opened the market.`,
          tone: 'good',
        },
      }
    }

    case 'TRADE': {
      const entry = state.markets[action.marketId]
      if (!entry) return state
      const market = entry.market

      if (action.kind === 'BUY') {
        const result = applyBuy(market, action.side, action.amount, action.actor)
        if (!result) {
          return {
            ...state,
            toast: errorToast(
              `${ACTOR_LABELS[action.actor]} only has ${formatCurrency(
                deriveActorMetrics(market, action.actor).cash,
              )} left in that wallet.`,
            ),
          }
        }
        const committed = commitMarketResult(
          entry,
          market,
          result.market,
          result.detail,
          action.actor === 'you' ? 'good' : 'neutral',
        )
        // Track trade in participant index (use 'you' as placeholder for current user pubkey)
        recordTrade(action.actor, action.marketId, 0)
        return {
          ...state,
          markets: { ...state.markets, [action.marketId]: committed.entry },
          toast: committed.toast,
        }
      }

      const result = applyRedeem(market, action.side, action.amount, action.actor)
      if (!result) {
        return {
          ...state,
          toast: errorToast(
            `${ACTOR_LABELS[action.actor]} does not have ${formatTokens(
              action.amount,
            )} ${action.side} tokens available to burn.`,
          ),
        }
      }
      const committed = commitMarketResult(entry, market, result.market, result.detail, 'neutral')
      // Track redeem trade in participant index
      recordTrade(action.actor, action.marketId, 0)
      return {
        ...state,
        markets: { ...state.markets, [action.marketId]: committed.entry },
        toast: committed.toast,
      }
    }

    case 'APPLY_EXTERNAL_RESULT': {
      const entry = state.markets[action.marketId]
      if (!entry) return state
      const currentTradeId = entry.market.lastTrade?.id ?? 'origin'
      if (currentTradeId !== action.basisTradeId) return state
      const committed = commitMarketResult(
        entry,
        entry.market,
        action.market,
        action.detail,
        action.tone,
      )
      return {
        ...state,
        markets: { ...state.markets, [action.marketId]: committed.entry },
        toast: committed.toast,
      }
    }

    case 'DELETE_MARKET': {
      const remaining = Object.fromEntries(
        Object.entries(state.markets).filter(([marketId]) => marketId !== action.marketId),
      )
      return {
        ...state,
        markets: remaining,
        toast: { title: 'Market deleted', body: 'Gone. No undo.', tone: 'neutral' },
      }
    }

    case 'CLEAR_TOAST':
      return { ...state, toast: undefined }

    case 'HYDRATE_FROM_NOSTR': {
      const merged = mergeLocalAndNostr(state.markets, action.markets)
      return { ...state, markets: merged, marketsLoading: action.marketsLoading ?? false }
    }

    case 'SYNC_MARKET': {
      const existing = state.markets[action.marketId]

      // Handle deletion signal from another client
      if (action.isDeletion) {
        if (!existing) return state
        return {
          ...state,
          markets: {
            ...state.markets,
            [action.marketId]: {
              ...existing,
              market: { ...existing.market, status: 'archived' as const },
            },
          },
        }
      }

      if (!existing) {
        // New market discovered via subscription
        return {
          ...state,
          markets: {
            ...state.markets,
            [action.marketId]: { market: action.market, history: [] },
          },
        }
      }

      // Kind 982 events are immutable — newer createdAt wins
      if (action.market.createdAt <= existing.market.createdAt) {
        return state
      }

      return {
        ...state,
        markets: {
          ...state.markets,
          [action.marketId]: {
            market: action.market,
            history: existing.history,
          },
        },
      }
    }

    case 'MARK_PUBLISHED': {
      // Update local market with the confirmed version/stateHash returned by the relay
      const existing = state.markets[action.marketId]
      if (!existing) return state
      return {
        ...state,
        markets: {
          ...state.markets,
          [action.marketId]: {
            ...existing,
            market: action.publishedMarket,
          },
        },
      }
    }

    case 'RESOLVE_MARKET': {
      const entry = state.markets[action.marketId]
      if (!entry) return state
      const market = entry.market
      if (market.status !== 'active') return state
      const resolvedMarket: Market = {
        ...market,
        status: 'resolved',
        resolutionOutcome: action.outcome,
        resolvedAt: Math.floor(Date.now() / 1000),
      }
      return {
        ...state,
        markets: {
          ...state.markets,
          [action.marketId]: { ...entry, market: resolvedMarket },
        },
      }
    }

    default:
      return state
  }
}

// Wrapper components for routing
function MarketDetailWrapper({
  markets,
  dispatch,
  activeTab,
}: {
  markets: Record<string, MarketEntry>
  dispatch: React.Dispatch<Action>
  activeTab: 'overview' | 'discussion' | 'charts' | 'activity'
}) {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const entry = slug ? markets[slug] : undefined
  
  useEffect(() => {
    if (!slug || !entry) {
      navigate('/', { replace: true })
    }
  }, [slug, entry, navigate])
  
  if (!entry) {
    return null
  }
  
  return <MarketDetail key={`${slug}-${activeTab}`} entry={entry} markets={markets} dispatch={dispatch} activeTab={activeTab} />
}

function ThesisRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`/market/${slug ?? ''}`} replace />
}

function ThreadPageWrapper({ markets }: { markets: Record<string, MarketEntry> }) {
  return <ThreadPage markets={markets} />
}

function LegacyMarketDiscussionRedirect() {
  const { slug, threadId } = useParams<{ slug: string; threadId?: string }>()

  if (!slug) {
    return <Navigate to="/" replace />
  }

  return (
    <Navigate
      replace
      to={
        threadId
          ? `/market/${slug}/discussion/${threadId}`
          : `/market/${slug}/discussion`
      }
    />
  )
}

// Legacy redirect: /field/:id -> /dashboard/field/:id
function LegacyFieldRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/dashboard/field/${id ?? ''}`} replace />
}



// Legacy redirect: /field/:id/meeting -> /dashboard/field/:id/meeting
function LegacyFieldMeetingRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/dashboard/field/${id ?? ''}/meeting`} replace />
}

// Legacy redirect: /market/:id (numeric) -> find market by slug and redirect
function LegacyMarketRedirect({ markets }: { markets: Record<string, MarketEntry> }) {
  const { id } = useParams<{ id: string }>()

  useEffect(() => {
    if (!id) return

    // Check if this ID exists as a market slug in our local store
    if (markets[id]) {
      // Already a valid slug, redirect to the same URL (no-op but updates URL)
      window.location.replace(`/market/${id}`)
    }
    // If not found in local store, let the component render the not found state
  }, [id, markets])

  if (!id) {
    return <Navigate to="/" replace />
  }

  // Check if market exists in local store
  if (markets[id]) {
    // Show the market
    return <Navigate to={`/market/${id}`} replace />
  }

  // Market not found - redirect to home
  return <Navigate to="/" replace />
}

// Legacy redirect: /discuss/:id -> redirect to home
// Since we don't have market context, redirect to home
function LegacyDiscussRedirect({ markets }: { markets: Record<string, MarketEntry> }) {
  const { id: threadId } = useParams<{ id: string }>()

  useEffect(() => {
    if (!threadId) return

    // We can't find threads without market context, so redirect to home
    // User can search for the discussion from the home page
    window.location.replace('/')
  }, [threadId, markets])

  if (!threadId) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div className="text-neutral-400 mb-4">Discussion thread: {threadId}</div>
      <div className="text-neutral-600 text-sm">Redirecting to home...</div>
    </div>
  )
}

// Interval between outbox retry sweeps (30 seconds)
const OUTBOX_RETRY_INTERVAL_MS = 30_000

function AppContent() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const location = useLocation()
  const navigate = useNavigate()
  const { isReady: nostrReady, pubkey: nostrPubkey, ndkInstance } = useNostr()

  // 404 detection: check if pathname matches any known route pattern
  const isKnownRoute = (pathname: string): boolean => {
    const knownPrefixes = [
      '/market/',
      '/builder',
      '/onboarding',
      '/portfolio',
      '/profile',
      '/u/',
      '/leaderboard',
      '/bookmarks',
      '/activity',
      '/blog',
      '/how-it-works',
      '/wallet',
      '/join',
      '/terms',
      '/privacy',
      '/hire-agents',
      '/enroll-agent',
      '/dashboard',
      '/embed',
      '/analytics',
      '/fields',
      '/field/',
      '/thesis/',
    ]
    return pathname === '/' || knownPrefixes.some(prefix => pathname.startsWith(prefix))
  }

  if (!isKnownRoute(location.pathname)) {
    return <NotFoundPage />
  }

  // Keep a ref to the latest markets so async callbacks never read stale closure state
  const marketsRef = useRef(state.markets)
  useEffect(() => {
    marketsRef.current = state.markets
  }, [state.markets])

  useEffect(() => {
    initAnalytics()
    initPosthog()
    return () => destroyAnalytics()
  }, [])

  useEffect(() => {
    initResolutionService()
  }, [])

  useEffect(() => {
    trackPageView(location.pathname)
    posthogTrackPageView(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    save(state.markets)
  }, [state.markets])

  useEffect(() => {
    if (!state.toast) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600)
    return () => window.clearTimeout(timer)
  }, [state.toast])

  // Nostr hydration: fetch and merge markets from relays when service is ready
  useEffect(() => {
    if (!nostrReady) return
    fetchAllMarkets()
      .then((markets) => {
        dispatch({ type: 'HYDRATE_FROM_NOSTR', markets, marketsLoading: false })
      })
      .catch((err: unknown) => {
        console.warn('Nostr hydration failed:', err)
        dispatch({ type: 'HYDRATE_FROM_NOSTR', markets: [], marketsLoading: false })
      })
  }, [nostrReady])

  // Nostr subscription: receive live market updates and deletion signals from other clients
  useEffect(() => {
    if (!nostrReady) return
    const sub = subscribeToAllMarkets((market, isDeletion) => {
      dispatch({ type: 'SYNC_MARKET', marketId: market.slug, market, isDeletion })
    })
    return () => sub.stop()
  }, [nostrReady])

  // Position persistence: initialize from Nostr when logged in, localStorage when anonymous
  useEffect(() => {
    if (!nostrReady) return
    initializePositions(nostrPubkey ?? null, ndkInstance).catch((err: unknown) => {
      console.error('Failed to initialize positions:', err)
      // App continues; positions fall back to localStorage
    })
  }, [nostrReady, nostrPubkey, ndkInstance])

  // Bookmark persistence: initialize from Nostr when logged in, localStorage when anonymous
  useEffect(() => {
    if (!nostrReady) return
    initializeBookmarks(nostrPubkey ?? null, ndkInstance).catch((err: unknown) => {
      console.error('Failed to initialize bookmarks:', err)
      // App continues; bookmarks fall back to localStorage
    })
  }, [nostrReady, nostrPubkey, ndkInstance])

  // Outbox: retry failed publishes on a fixed timer (independent of signer state changes)
  useEffect(() => {
    if (!nostrReady || !nostrPubkey) return

    function runOutboxRetry() {
      const pending = getPendingPublishes()
      for (const item of pending) {
        publishMarket(item.market, '')
          .then((ndkEvent) => {
            const publishedMarket: Market = { ...item.market, eventId: ndkEvent.id ?? '' }
            removePendingPublish(item.marketId)
            dispatch({ type: 'MARK_PUBLISHED', marketId: item.marketId, publishedMarket })
          })
          .catch((err: unknown) => {
            console.warn(`Outbox retry failed for market ${item.marketId}:`, err)
            incrementPendingRetries(item.marketId)
          })
      }
    }

    // Run immediately on mount/signer-ready, then on a fixed interval
    runOutboxRetry()
    const intervalId = window.setInterval(runOutboxRetry, OUTBOX_RETRY_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [nostrReady, nostrPubkey])

  // Handle market creation navigation and async Nostr side effects
  const handleDispatch = (action: Action) => {
    if (action.type === 'CREATE_MARKET') {
      // Pre-generate the slug so the publish callback can look up the market in
      // marketsRef after React flushes the state update — no stale closure issues.
      const marketSlug =
        action.id ??
        `market-${
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10)
        }`
      const actionWithId: Action = { ...action, id: marketSlug }
      dispatch(actionWithId)

      navigate(`/market/${marketSlug}`)
      if (nostrReady && nostrPubkey) {
        // setTimeout(0) lets React flush the state update before we read marketsRef
        setTimeout(() => {
          const entry = marketsRef.current[marketSlug]
          if (!entry) return
          publishMarket(entry.market, '')
            .then((ndkEvent) => {
              const publishedMarket: Market = { ...entry.market, eventId: ndkEvent.id ?? '' }
              dispatch({ type: 'MARK_PUBLISHED', marketId: marketSlug, publishedMarket })
            })
            .catch((err: unknown) => {
              console.warn('Nostr publish failed, queuing for retry:', err)
              addPendingPublish(entry.market)
            })
        }, 0)
      }
      return
    }

    dispatch(action)

    if (action.type === 'TRADE') {
      // Async: publish updated market state to Nostr after trade.
      // Read from marketsRef (not state.markets) to get the post-reducer value.
      if (nostrReady && nostrPubkey) {
        setTimeout(() => {
          const entry = marketsRef.current[action.marketId]
          if (!entry) return
          publishMarket(entry.market, '')
            .then((ndkEvent) => {
              const publishedMarket: Market = { ...entry.market, eventId: ndkEvent.id ?? '' }
              dispatch({ type: 'MARK_PUBLISHED', marketId: action.marketId, publishedMarket })
            })
            .catch((err: unknown) => {
              console.warn('Nostr trade publish failed, queuing for retry:', err)
              addPendingPublish(entry.market)
            })
        }, 0)
      }
    }

    if (action.type === 'DELETE_MARKET') {
      navigate('/')
      // Async: publish archived market state + NIP-09 deletion event to Nostr
      if (nostrReady && nostrPubkey) {
        const entry = marketsRef.current[action.marketId]
        if (entry) {
          publishDeletionEvent(entry.market).catch((err: unknown) => {
            console.warn('Nostr deletion publish failed:', err)
          })
        }
      }
    }

    if (action.type === 'RESOLVE_MARKET') {
      // Trigger payout distribution via resolution queue
      const entry = marketsRef.current[action.marketId]
      if (entry) {
        resolveMarket(entry.market, action.outcome, action.outcomePrice)
      }

      // Async: publish resolved market state to Nostr
      if (nostrReady && nostrPubkey) {
        setTimeout(() => {
          const entry = marketsRef.current[action.marketId]
          if (!entry) return
          publishMarket(entry.market, '')
            .then((ndkEvent) => {
              const publishedMarket: Market = { ...entry.market, eventId: ndkEvent.id ?? '' }
              dispatch({ type: 'MARK_PUBLISHED', marketId: action.marketId, publishedMarket })
            })
            .catch((err: unknown) => {
              console.warn('Nostr resolution publish failed, queuing for retry:', err)
              addPendingPublish(entry.market)
            })
        }, 0)
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TestnetBanner />
      <NavHeader />
      <main className="flex-1">
      <Routes>
        <Route path="/" element={<LandingPage markets={state.markets} dispatch={handleDispatch} isLoadingMarkets={state.marketsLoading} />} />
        {/* Legacy /market/:id route - handles numeric IDs by redirecting to slug-based URL */}
        <Route
          path="/market/:id"
          element={<LegacyMarketRedirect markets={state.markets} />}
        />
        <Route
          path="/market/:slug"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="overview" />}
        />
        <Route
          path="/market/:slug/discussion"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="discussion" />}
        />
        <Route
          path="/market/:slug/discussion/:threadId"
          element={<ThreadPageWrapper markets={state.markets} />}
        />
        <Route
          path="/market/:slug/charts"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="charts" />}
        />
        <Route
          path="/market/:slug/activity"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="activity" />}
        />
        <Route path="/market/:slug/discuss" element={<LegacyMarketDiscussionRedirect />} />
        <Route path="/market/:slug/discuss/:threadId" element={<LegacyMarketDiscussionRedirect />} />
        <Route path="/thesis/:slug" element={<ThesisRedirect />} />
        <Route path="/builder" element={<ThesisBuilder markets={state.markets} dispatch={handleDispatch} />} />
        <Route path="/onboarding" element={<Profile />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:pubkey" element={<ProfilePage />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/bookmarks" element={<BookmarksPage markets={state.markets} />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/join" element={<OnboardingSplit className="py-12" />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/hire-agents" element={<HireAgents />} />
        <Route path="/enroll-agent" element={<EnrollAgent />} />
        {/* Dashboard workspace routes — nested under AgentDashboard layout (sidebar) */}
        <Route path="/dashboard" element={<AgentDashboard />}>
          <Route index element={<DashboardOverview />} />
          <Route path="fields" element={<FieldsList />} />
          <Route path="field/:id" element={<FieldDetail />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="treasury" element={<TreasuryPage />} />
          <Route path="activity" element={<ActivityFeed />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        {/* Legacy redirects — keep old URLs working */}
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/discuss/:id" element={<LegacyDiscussRedirect markets={state.markets} />} />
        <Route path="/fields" element={<Navigate to="/dashboard/fields" replace />} />
        <Route path="/field/:id/meeting" element={<LegacyFieldMeetingRedirect />} />
        <Route path="/field/:id" element={<LegacyFieldRedirect />} />
        <Route path="/embed" element={<EmbedLanding />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>
      </main>
      <Footer />
      {state.toast ? (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm px-5 py-4 border shadow-lg ${
          state.toast.tone === 'good'
            ? 'bg-green-900/80 border-green-700 text-green-100'
            : state.toast.tone === 'warn'
              ? 'bg-red-900/80 border-red-700 text-red-100'
              : 'bg-neutral-800/90 border-neutral-700 text-neutral-100'
        }`}>
          <strong className="block text-sm font-semibold">{state.toast.title}</strong>
          <p className="text-sm mt-1 opacity-90">{state.toast.body}</p>
        </div>
      ) : null}
    </div>
  )
}

function App() {
  return (
    <TestnetProvider>
      <BrowserRouter>
        <Routes>
          {/* Embed route renders standalone without app shell */}
          <Route path="/embed/market/:slug" element={<EmbedPage />} />
          {/* All other routes render with full app shell */}
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </TestnetProvider>
  )
}

export default App
