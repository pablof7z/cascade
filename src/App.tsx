import { useEffect, useReducer } from 'react'
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
  type Side,
  type TradeKind,
} from './market'
import type { HistoryPoint } from './PriceChart'
import { load, save, type MarketEntry } from './storage'
import LandingPage from './LandingPage'
import MarketDetail from './MarketDetail'

type ToastTone = 'good' | 'warn' | 'neutral'

type Toast = {
  title: string
  body: string
  tone: ToastTone
}

type View = { screen: 'landing' } | { screen: 'detail'; marketId: string }

type State = {
  markets: Record<string, MarketEntry>
  view: View
  toast?: Toast
}

export type Action =
  | {
      type: 'CREATE_MARKET'
      title: string
      description: string
      seedWithUser: boolean
      initialSide?: Side
      initialSats?: number
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
  | { type: 'NAVIGATE'; view: View }
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
    view: { screen: 'landing' },
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
        title,
        description: description || 'User-created scenario market with fully transparent fake settlement.',
      })

      if (!action.seedWithUser) {
        const entry: MarketEntry = {
          market,
          history: appendHistoryPoint([], market),
        }
        return {
          ...state,
          markets: { ...state.markets, [market.id]: entry },
          view: { screen: 'detail', marketId: market.id },
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
        view: { screen: 'detail', marketId: market.id },
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

    case 'NAVIGATE':
      return { ...state, view: action.view }

    case 'DELETE_MARKET': {
      const remaining = Object.fromEntries(
        Object.entries(state.markets).filter(([marketId]) => marketId !== action.marketId),
      )
      return {
        ...state,
        markets: remaining,
        view: { screen: 'landing' },
        toast: { title: 'Market deleted', body: 'Gone. No undo.', tone: 'neutral' },
      }
    }

    case 'CLEAR_TOAST':
      return { ...state, toast: undefined }

    default:
      return state
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  useEffect(() => {
    save(state.markets)
  }, [state.markets])

  useEffect(() => {
    if (!state.toast) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600)
    return () => window.clearTimeout(timer)
  }, [state.toast])

  const content =
    state.view.screen === 'detail' && state.markets[state.view.marketId] ? (
      <MarketDetail
        key={state.view.marketId}
        entry={state.markets[state.view.marketId]}
        dispatch={dispatch}
      />
    ) : (
      <LandingPage markets={state.markets} dispatch={dispatch} />
    )

  return (
    <>
      {content}
      {state.toast ? (
        <div className={`toast ${state.toast.tone}`}>
          <strong>{state.toast.title}</strong>
          <p>{state.toast.body}</p>
        </div>
      ) : null}
    </>
  )
}

export default App
