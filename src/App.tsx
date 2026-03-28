import { useEffect, useReducer } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
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
import LandingPage from './LandingPage'
import MarketDetail from './MarketDetail'
import ThesisDetail from './ThesisDetail'
import ThesisBuilder from './ThesisBuilder'
import Portfolio from './Portfolio'
import Profile from './Profile'
import Leaderboard from './Leaderboard'
import Activity from './Activity'
import NavHeader from './NavHeader'
import OnboardingSplit from './OnboardingSplit'
import TestnetBanner from './components/TestnetBanner'
import Footer from './components/Footer'

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
      })

      if (!action.seedWithUser) {
        const entry: MarketEntry = {
          market,
          history: appendHistoryPoint([], market),
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
function MarketDetailWrapper({ markets, dispatch }: { markets: Record<string, MarketEntry>; dispatch: React.Dispatch<Action> }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  if (!id || !markets[id]) {
    navigate('/')
    return null
  }
  
  return <MarketDetail key={id} entry={markets[id]} dispatch={dispatch} />
}

function ThesisDetailWrapper({ markets, dispatch }: { markets: Record<string, MarketEntry>; dispatch: React.Dispatch<Action> }) {
  return <ThesisDetail markets={markets} dispatch={dispatch} />
}

function AppContent() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const navigate = useNavigate()

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
    dispatch(action)
    if (action.type === 'CREATE_MARKET') {
      // Navigate after state updates - we need to get the new market ID
      // For now, just stay on the page - the reducer will handle view changes
    }
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
        <Route path="/market/:id" element={<MarketDetailWrapper markets={state.markets} dispatch={handleDispatch} />} />
        <Route path="/thesis/:id" element={<ThesisDetailWrapper markets={state.markets} dispatch={handleDispatch} />} />
        <Route path="/builder" element={<ThesisBuilder markets={state.markets} dispatch={handleDispatch} />} />
        <Route path="/onboarding" element={<Profile />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/join" element={<OnboardingSplit className="py-12" />} />
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
        <AppContent />
      </BrowserRouter>
    </TestnetProvider>
  )
}

export default App
