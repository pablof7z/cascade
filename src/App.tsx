import { useEffect, useReducer } from 'react'
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
import { load, save, type MarketEntry } from './storage'
import { recordTrade, recordMarketCreation } from './services/participantIndex'
import LandingPage from './LandingPage'
import MarketDetail from './MarketDetail'
import ThreadPage from './ThreadPage'
import ThesisBuilder from './ThesisBuilder'
import Portfolio from './Portfolio'
import Profile from './Profile'
import MockProfilePage from './MockProfilePage'
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
import FieldDetail from './FieldDetail'
import EmbedPage from './EmbedPage'
import EmbedLanding from './EmbedLanding'
import TestnetBanner from './components/TestnetBanner'
import Footer from './components/Footer'
import AnalyticsDashboard from './AnalyticsDashboard'
import { initAnalytics, destroyAnalytics, trackPageView } from './analytics'

type ToastTone = 'good' | 'warn' | 'neutral'

type Toast = {
  title: string
  body: string
  tone: ToastTone
}

type State = {
  markets: Record<string, MarketEntry>
  toast?: Toast
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
        id: action.id,
        title,
        description: description || 'User-created scenario market with fully transparent fake settlement.',
        kind: action.kind,
        thesis: action.thesis,
        creatorPubkey: action.creatorPubkey,
      })

      if (!action.seedWithUser) {
        const entry: MarketEntry = {
          market,
          history: appendHistoryPoint([], market),
        }
        // Track market creation in participant index
        if (market.creatorPubkey) {
          recordMarketCreation(market.creatorPubkey, market.id)
        }
        return {
          ...state,
          markets: { ...state.markets, [market.id]: entry },
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
        recordMarketCreation(market.creatorPubkey, market.id)
        recordTrade(market.creatorPubkey, market.id, 0) // Initial seed trade
      }
      return {
        ...state,
        markets: { ...state.markets, [market.id]: entry },
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
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const entry = id ? markets[id] : undefined
  
  useEffect(() => {
    if (!id || !entry) {
      navigate('/', { replace: true })
    }
  }, [id, entry, navigate])
  
  if (!entry) {
    return null
  }
  
  return <MarketDetail key={`${id}-${activeTab}`} entry={entry} markets={markets} dispatch={dispatch} activeTab={activeTab} />
}

function ThesisRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/market/${id ?? ''}`} replace />
}

function ThreadPageWrapper({ markets }: { markets: Record<string, MarketEntry> }) {
  return <ThreadPage markets={markets} />
}

function LegacyMarketDiscussionRedirect() {
  const { id, threadId } = useParams<{ id: string; threadId?: string }>()

  if (!id) {
    return <Navigate to="/" replace />
  }

  return (
    <Navigate
      replace
      to={
        threadId
          ? `/market/${id}/discussion/${threadId}`
          : `/market/${id}/discussion`
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

function AppContent() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    initAnalytics()
    return () => destroyAnalytics()
  }, [])

  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    save(state.markets)
  }, [state.markets])

  useEffect(() => {
    if (!state.toast) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600)
    return () => window.clearTimeout(timer)
  }, [state.toast])

  // Handle market creation navigation
  const handleDispatch = (action: Action) => {
    if (action.type === 'CREATE_MARKET' && action.id) {
      dispatch(action)
      navigate(`/market/${action.id}`)
      return
    }
    dispatch(action)
    if (action.type === 'DELETE_MARKET') {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TestnetBanner />
      <NavHeader />
      <main className="flex-1">
      <Routes>
        <Route path="/" element={<LandingPage markets={state.markets} dispatch={handleDispatch} />} />
        <Route
          path="/market/:id"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="overview" />}
        />
        <Route
          path="/market/:id/discussion"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="discussion" />}
        />
        <Route
          path="/market/:id/discussion/:threadId"
          element={<ThreadPageWrapper markets={state.markets} />}
        />
        <Route
          path="/market/:id/charts"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="charts" />}
        />
        <Route
          path="/market/:id/activity"
          element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} activeTab="activity" />}
        />
        <Route path="/market/:id/discuss" element={<LegacyMarketDiscussionRedirect />} />
        <Route path="/market/:id/discuss/:threadId" element={<LegacyMarketDiscussionRedirect />} />
        <Route path="/thesis/:id" element={<ThesisRedirect />} />
        <Route path="/builder" element={<ThesisBuilder markets={state.markets} dispatch={handleDispatch} />} />
        <Route path="/onboarding" element={<Profile />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:handle" element={<MockProfilePage />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
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
        </Route>
        {/* Legacy redirects — keep old URLs working */}
        <Route path="/fields" element={<Navigate to="/dashboard/fields" replace />} />
        <Route path="/field/:id/meeting" element={<LegacyFieldMeetingRedirect />} />
        <Route path="/field/:id" element={<LegacyFieldRedirect />} />
        <Route path="/embed" element={<EmbedLanding />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>
      </main>
      <Footer />
      {state.toast ? (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm px-5 py-4 rounded-xl border shadow-lg backdrop-blur-sm ${
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
          <Route path="/embed/market/:id" element={<EmbedPage />} />
          {/* All other routes render with full app shell */}
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </TestnetProvider>
  )
}

export default App
