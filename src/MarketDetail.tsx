import { startTransition, useEffect, useRef, useState } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { useNavigate } from 'react-router-dom'
import Discussion from './Discussion'
import {
  ACTORS,
  ACTOR_LABELS,
  costFunction,
  deriveActorMetrics,
  deriveMarketMetrics,
  previewTrade,
  simulateCrowdStep,
  type ActorId,
  type ActorMetrics,
  type Market,
  type MarketBias,
  type Side,
  type TradeKind,
} from './market'
import PriceChart from './PriceChart'
import type { MarketEntry } from './storage'
import type { Action } from './App'

type WalletView = 'ACTORS' | 'AGGREGATE'
type RealitySpeed = 'SLOW' | 'NORMAL' | 'FAST'

const tradeKinds: TradeKind[] = ['BUY', 'REDEEM']
const tradeSides: Side[] = ['LONG', 'SHORT']
const REALITY_SPEEDS: Record<
  RealitySpeed,
  { label: string; intervalMs: number; intensity: number; certaintyStep: number }
> = {
  SLOW: { label: 'Slow', intervalMs: 2600, intensity: 0.78, certaintyStep: 0.025 },
  NORMAL: { label: 'Normal', intervalMs: 1800, intensity: 1, certaintyStep: 0.045 },
  FAST: { label: 'Fast', intervalMs: 1100, intensity: 1.35, certaintyStep: 0.075 },
}

function favoredSideLabel(bias: MarketBias) {
  if (bias === 'LONGS_FAVORED') return 'longs'
  if (bias === 'SHORTS_FAVORED') return 'shorts'
  return null
}

function isFavoredBias(bias: MarketBias) {
  return bias === 'LONGS_FAVORED' || bias === 'SHORTS_FAVORED'
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

function formatPercent(value: number) {
  return `${currencyFormatter.format(value * 100)}%`
}

function formatTokens(value: number) {
  return tokenFormatter.format(value)
}

function describeAfterQuote(kind: TradeKind, side: Side, endPrice: number) {
  const activeSide = kind === 'BUY' ? side : side === 'LONG' ? 'SHORT' : 'LONG'
  const displayPrice = kind === 'BUY' ? endPrice : 1 - endPrice
  return `${activeSide} ${formatPercent(displayPrice)}`
}

function deriveGroupMetrics(market: Market, actors: readonly ActorId[]): ActorMetrics {
  const cash = actors.reduce((sum, actor) => sum + market.participants[actor].cash, 0)
  const long = actors.reduce((sum, actor) => sum + market.participants[actor].long, 0)
  const short = actors.reduce((sum, actor) => sum + market.participants[actor].short, 0)
  const liquidationValue =
    costFunction(market.qLong, market.qShort, market.b) -
    costFunction(
      Math.max(0, market.qLong - long),
      Math.max(0, market.qShort - short),
      market.b,
    )

  return {
    cash,
    long,
    short,
    liquidationValue,
    totalValue: cash + liquidationValue,
  }
}

type Props = {
  entry: MarketEntry
  dispatch: Dispatch<Action>
}

export default function MarketDetail({ entry, dispatch }: Props) {
  const navigate = useNavigate()
  const { market: activeMarket, history } = entry
  const marketId = activeMarket.id

  const [selectedActor, setSelectedActor] = useState<ActorId>('you')
  const [tradeMode, setTradeMode] = useState<TradeKind>('BUY')
  const [tradeSide, setTradeSide] = useState<Side>('LONG')
  const [tradeAmount, setTradeAmount] = useState('120')
  const [walletView, setWalletView] = useState<WalletView>('ACTORS')
  const [livelyMarket, setLivelyMarket] = useState(false)
  const [marketBias, setMarketBias] = useState<MarketBias>('NEUTRAL')
  const [realitySpeed, setRealitySpeed] = useState<RealitySpeed>('NORMAL')
  const [realityPressure, setRealityPressure] = useState(0)

  const marketRef = useRef<Market>(activeMarket)
  const marketBiasRef = useRef<MarketBias>('NEUTRAL')
  const realitySpeedRef = useRef<RealitySpeed>('NORMAL')
  const realityPressureRef = useRef(0)

  useEffect(() => {
    marketRef.current = activeMarket
  }, [activeMarket])

  useEffect(() => {
    marketBiasRef.current = marketBias
  }, [marketBias])

  useEffect(() => {
    realitySpeedRef.current = realitySpeed
  }, [realitySpeed])

  useEffect(() => {
    realityPressureRef.current = realityPressure
  }, [realityPressure])

  useEffect(() => {
    if (!livelyMarket) return undefined

    const currentSpeed = REALITY_SPEEDS[realitySpeed]
    const intervalMs = isFavoredBias(marketBias) ? currentSpeed.intervalMs : 1800

    const timer = window.setInterval(() => {
      const currentMarket = marketRef.current
      const currentBias = marketBiasRef.current
      const nextPressure =
        isFavoredBias(currentBias)
          ? Math.min(
              1,
              realityPressureRef.current +
                REALITY_SPEEDS[realitySpeedRef.current].certaintyStep,
            )
          : Math.max(0, realityPressureRef.current - 0.04)
      if (nextPressure !== realityPressureRef.current) {
        realityPressureRef.current = nextPressure
        setRealityPressure(nextPressure)
      }
      const intensity =
        isFavoredBias(currentBias)
          ? REALITY_SPEEDS[realitySpeedRef.current].intensity
          : 1
      const result = simulateCrowdStep(currentMarket, currentBias, intensity, nextPressure)
      if (!result) return
      startTransition(() => {
        dispatch({
          type: 'APPLY_EXTERNAL_RESULT',
          marketId,
          market: result.market,
          detail: result.detail,
          tone: 'neutral',
          basisTradeId: currentMarket.lastTrade?.id ?? 'origin',
        })
      })
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [livelyMarket, marketBias, realitySpeed, marketId, dispatch])

  const metrics = deriveMarketMetrics(activeMarket)
  const selectedActorMetrics = deriveActorMetrics(activeMarket, selectedActor)
  const crowdMetrics = deriveGroupMetrics(activeMarket, ['alice', 'bob', 'carol'])
  const allActorMetrics = deriveGroupMetrics(activeMarket, ACTORS)

  const parsedTradeAmount = Number(tradeAmount)
  const preview =
    Number.isFinite(parsedTradeAmount) && parsedTradeAmount > 0
      ? previewTrade(activeMarket, selectedActor, tradeMode, tradeSide, parsedTradeAmount)
      : null
  const tradeLabel = `${tradeMode === 'BUY' ? 'Buy' : 'Sell'} ${tradeSide}`
  const tradeAmountLabel = tradeMode === 'BUY' ? 'Spend in sats' : `Sell ${tradeSide}`
  const submitLabel = `${ACTOR_LABELS[selectedActor]} ${tradeLabel}`
  const actorSummary = [
    { label: 'Cash', value: formatCurrency(selectedActorMetrics.cash) },
    { label: 'LONG', value: formatTokens(selectedActorMetrics.long) },
    { label: 'SHORT', value: formatTokens(selectedActorMetrics.short) },
    { label: 'Total', value: formatCurrency(selectedActorMetrics.totalValue) },
  ]
  const previewSummary = preview
    ? [
        {
          label: tradeMode === 'BUY' ? 'You get' : 'Payout',
          value:
            tradeMode === 'BUY'
              ? `${formatTokens(preview.tokens)} ${tradeSide}`
              : `${formatCurrency(preview.sats)} sats`,
        },
        { label: 'Avg fill', value: formatCurrency(preview.avgPrice) },
        { label: 'After quote', value: describeAfterQuote(tradeMode, tradeSide, preview.endPrice) },
        { label: 'Reserve', value: formatCurrency(preview.reserveAfter) },
      ]
    : []
  const walletRows =
    walletView === 'ACTORS'
      ? ACTORS.map((actor) => ({
          key: actor,
          label: ACTOR_LABELS[actor],
          detail: undefined as string | undefined,
          metrics: deriveActorMetrics(activeMarket, actor),
          selected: actor === selectedActor,
        }))
      : [
          {
            key: 'you',
            label: 'You',
            detail: 'Manual wallet',
            metrics: deriveGroupMetrics(activeMarket, ['you']),
            selected: false,
          },
          {
            key: 'crowd',
            label: 'Crowd total',
            detail: 'Alice + Bob + Carol',
            metrics: crowdMetrics,
            selected: false,
          },
          {
            key: 'all',
            label: 'All wallets',
            detail: 'Entire market book',
            metrics: allActorMetrics,
            selected: false,
          },
        ]

  function handleTradeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(tradeAmount)
    if (!Number.isFinite(amount)) return
    startTransition(() => {
      dispatch({
        type: 'TRADE',
        marketId,
        actor: selectedActor,
        kind: tradeMode,
        side: tradeSide,
        amount,
      })
    })
  }

  const liveProofs = activeMarket.proofs.filter((proof) => proof.remainingTokens > 0.000001)

  return (
    <div className="shell shell-single">
      <header className="market-header">
        <div className="market-header-nav">
          <button
            type="button"
            className="ghost-button back-button"
            onClick={() => navigate('/')}
          >
            All markets
          </button>
          <button
            type="button"
            className="ghost-button delete-button"
            onClick={() => dispatch({ type: 'DELETE_MARKET', marketId })}
          >
            Delete
          </button>
        </div>
        <h1 className="market-title">{activeMarket.title}</h1>
        <p className="hero-copy">{activeMarket.description}</p>
      </header>

      <div className="dashboard dashboard-main">
        <section className="trade-dock">
          <div className="trade-topline">
            <div className="trade-title-group">
              <p className="label">Trade</p>
              <div className="actor-tabs actor-tabs-compact">
                {ACTORS.map((actor) => (
                  <button
                    key={actor}
                    type="button"
                    className={`mode-button actor-tab ${selectedActor === actor ? 'active' : ''}`}
                    onClick={() => setSelectedActor(actor)}
                  >
                    {ACTOR_LABELS[actor]}
                  </button>
                ))}
              </div>
            </div>

            <div className={`trade-state ${preview ? 'ready' : ''}`}>
              <span>{ACTOR_LABELS[selectedActor]}</span>
              <strong>{tradeLabel}</strong>
            </div>
          </div>

          <div className="actor-metrics">
            {actorSummary.map((item) => (
              <div className="metric-pill" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <form className="stacked-form trade-form-compact" onSubmit={handleTradeSubmit}>
            <div className="trade-control-row">
              <div className="toggle-group toggle-group-compact">
                <span className="toggle-label">Action</span>
                <div className="segment-control">
                  {tradeKinds.map((kind) => (
                    <button
                      type="button"
                      key={kind}
                      className={`mode-button segment-button ${tradeMode === kind ? 'active' : ''}`}
                      onClick={() => setTradeMode(kind)}
                    >
                      {kind === 'BUY' ? 'Buy' : 'Sell'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toggle-group toggle-group-compact">
                <span className="toggle-label">Side</span>
                <div className="segment-control">
                  {tradeSides.map((side) => (
                    <button
                      type="button"
                      key={side}
                      className={`mode-button segment-button ${tradeSide === side ? 'active' : ''}`}
                      onClick={() => setTradeSide(side)}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>

              <label className="trade-amount-field trade-amount-field-compact">
                <span>{tradeAmountLabel}</span>
                <input
                  value={tradeAmount}
                  onChange={(event) => setTradeAmount(event.target.value)}
                  inputMode="decimal"
                />
              </label>

              <button className="primary-button trade-submit" type="submit">
                {submitLabel}
              </button>
            </div>

            <div className={`trade-preview-strip ${preview ? 'ready' : 'idle'}`}>
              {preview ? (
                <>
                  <div className="preview-chip preview-status-chip">
                    <span>Execution</span>
                    <strong>Ready</strong>
                  </div>
                  {previewSummary.map((item) => (
                    <div className="preview-chip" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </>
              ) : (
                <p className="muted">
                  Preview uses the exact LMSR cost delta for {ACTOR_LABELS[selectedActor]}.
                </p>
              )}
            </div>

            {preview ? (
              <p className="trade-footnote">
                Quote {formatPercent(preview.startPrice)} {'->'} {formatPercent(preview.endPrice)} | Slippage{' '}
                {formatPercent(Math.abs(preview.endPrice - preview.startPrice))}
              </p>
            ) : null}
          </form>
        </section>

        <aside className="info-rail">
          <section className="sticky-info">
            <div className="market-state">
              <p className="label">Current state</p>
              <div className="market-state-odds">
                <strong>LONG {formatPercent(metrics.longPositionShare)}</strong>
                <span>vs</span>
                <strong>SHORT {formatPercent(metrics.shortPositionShare)}</strong>
              </div>
              <div className="state-bar">
                <span
                  className="state-bar-long"
                  style={{ width: `${metrics.longPositionShare * 100}%` }}
                />
              </div>
              <div className="market-state-meta">
                <span>Market cap {formatCurrency(activeMarket.reserve)}</span>
                <span>
                  LMSR quote LONG {formatPercent(metrics.longOdds)} | SHORT{' '}
                  {formatPercent(metrics.shortOdds)}
                </span>
                <span>
                  Committed stake LONG {formatPercent(metrics.longCapital)} | SHORT{' '}
                  {formatPercent(metrics.shortCapital)}
                </span>
                <span>
                  Committed dollars {formatCurrency(metrics.longCommitted)} LONG |{' '}
                  {formatCurrency(metrics.shortCommitted)} SHORT
                </span>
                <span>
                  Outstanding shares {formatTokens(activeMarket.qLong)} LONG |{' '}
                  {formatTokens(activeMarket.qShort)} SHORT
                </span>
              </div>

              <p className="muted">Quote history</p>
              <PriceChart data={history} />

              <div className="market-controls">
                <div className="section-head section-head-compact">
                  <p className="label">Crowd</p>
                  <button
                    type="button"
                    className={`mode-button live-toggle ${livelyMarket ? 'active' : ''}`}
                    onClick={() => setLivelyMarket((current) => !current)}
                  >
                    {livelyMarket ? 'Live' : 'Paused'}
                  </button>
                </div>

                <div className="segment-control regime-control">
                  <button
                    type="button"
                    className={`mode-button segment-button ${
                      marketBias === 'NEUTRAL' ? 'active' : ''
                    }`}
                    onClick={() => {
                      setMarketBias('NEUTRAL')
                      setRealityPressure(0)
                      realityPressureRef.current = 0
                    }}
                  >
                    Balanced
                  </button>
                  <button
                    type="button"
                    className={`mode-button segment-button ${
                      isFavoredBias(marketBias) ? 'active' : ''
                    }`}
                    onClick={() => setMarketBias((current) => (current === 'NEUTRAL' ? 'LONGS_FAVORED' : current))}
                  >
                    Favored
                  </button>
                </div>

                {isFavoredBias(marketBias) ? (
                  <div className="reality-speed-row">
                    <span className="toggle-label">Favored side</span>
                    <div className="segment-control speed-control">
                      <button
                        type="button"
                        className={`mode-button segment-button ${
                          marketBias === 'LONGS_FAVORED' ? 'active' : ''
                        }`}
                        onClick={() => {
                          setMarketBias('LONGS_FAVORED')
                          setRealityPressure(0)
                          realityPressureRef.current = 0
                        }}
                      >
                        LONG
                      </button>
                      <button
                        type="button"
                        className={`mode-button segment-button ${
                          marketBias === 'SHORTS_FAVORED' ? 'active' : ''
                        }`}
                        onClick={() => {
                          setMarketBias('SHORTS_FAVORED')
                          setRealityPressure(0)
                          realityPressureRef.current = 0
                        }}
                      >
                        SHORT
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="reality-speed-row">
                  <span className="toggle-label">Reality speed</span>
                  <div className="segment-control speed-control">
                    {(
                      Object.entries(REALITY_SPEEDS) as Array<
                        [RealitySpeed, (typeof REALITY_SPEEDS)[RealitySpeed]]
                      >
                    ).map(([speedKey, speedConfig]) => (
                      <button
                        key={speedKey}
                        type="button"
                        disabled={!isFavoredBias(marketBias)}
                        className={`mode-button segment-button ${
                          realitySpeed === speedKey ? 'active' : ''
                        }`}
                        onClick={() => setRealitySpeed(speedKey)}
                      >
                        {speedConfig.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isFavoredBias(marketBias) ? (
                  <p className="reality-pressure">
                    Reality pressure {formatPercent(realityPressure)}
                  </p>
                ) : null}

                <p className="muted market-mode-note">
                  {livelyMarket
                    ? isFavoredBias(marketBias)
                      ? `Reality is leaning toward the ${favoredSideLabel(
                          marketBias,
                        )} at ${REALITY_SPEEDS[
                          realitySpeed
                        ].label.toLowerCase()} speed. As pressure builds, fresh ${
                          favoredSideLabel(marketBias)?.toUpperCase()
                        } flow keeps entering, the other side rushes harder toward the exits, and winners stop clipping profit once the move looks close to locked in.`
                      : 'The crowd is live. Alice, Bob, and Carol keep reacting to price, P&L, and who looks overextended.'
                    : 'Crowd is paused. Turn it on to let the other actors keep trading on their own.'}
                </p>
              </div>
            </div>

            <div className="wallets-section">
              <div className="section-head section-head-compact">
                <p className="label">Wallets</p>
                <div className="segment-control wallet-view-control">
                  <button
                    type="button"
                    className={`mode-button segment-button ${
                      walletView === 'ACTORS' ? 'active' : ''
                    }`}
                    onClick={() => setWalletView('ACTORS')}
                  >
                    Actors
                  </button>
                  <button
                    type="button"
                    className={`mode-button segment-button ${
                      walletView === 'AGGREGATE' ? 'active' : ''
                    }`}
                    onClick={() => setWalletView('AGGREGATE')}
                  >
                    Aggregate
                  </button>
                </div>
              </div>
              <div className="wallet-list">
                {walletRows.map((row) => (
                  <article
                    className={`wallet-row ${row.selected ? 'selected' : ''}`}
                    key={row.key}
                  >
                    <div className="wallet-row-head">
                      <div>
                        <strong>{row.label}</strong>
                        {row.detail ? <small className="wallet-caption">{row.detail}</small> : null}
                      </div>
                      <span>Total {formatCurrency(row.metrics.totalValue)}</span>
                    </div>
                    <div className="wallet-row-meta">
                      <span>Cash {formatCurrency(row.metrics.cash)}</span>
                      <span>LONG {formatTokens(row.metrics.long)}</span>
                      <span>SHORT {formatTokens(row.metrics.short)}</span>
                      <span>Pos {formatCurrency(row.metrics.liquidationValue)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className="detail-drawers">
        <details className="detail-drawer">
          <summary>
            <span>Fake Cashu</span>
            <strong>Audit trail</strong>
          </summary>
          <div className="ledger-stack">
            <div className="ledger-block">
              <h3>Quotes</h3>
              {activeMarket.quotes.length ? (
                activeMarket.quotes.map((quote) => (
                  <article className="ledger-row" key={quote.id}>
                    <div>
                      <strong>{quote.kind.toUpperCase()}</strong>
                      <p>
                        {ACTOR_LABELS[quote.actor]} {quote.side} | {formatCurrency(quote.sats)} |{' '}
                        {formatTokens(quote.tokens)} tokens
                      </p>
                    </div>
                    <span>{quote.createdAt}</span>
                  </article>
                ))
              ) : (
                <p className="muted">No quotes yet.</p>
              )}
            </div>

            <div className="ledger-block">
              <h3>Live proofs</h3>
              {liveProofs.length ? (
                liveProofs.map((proof) => (
                  <article className="ledger-row" key={proof.id}>
                    <div>
                      <strong>{proof.id}</strong>
                      <p>
                        {ACTOR_LABELS[proof.actor]} {proof.side} | remaining{' '}
                        {formatTokens(proof.remainingTokens)} / {formatTokens(proof.tokens)}
                      </p>
                    </div>
                    <span>{proof.createdAt}</span>
                  </article>
                ))
              ) : (
                <p className="muted">No unspent proofs remain.</p>
              )}
            </div>

            <div className="ledger-block">
              <h3>Spent proofs</h3>
              {activeMarket.spentProofs.length ? (
                activeMarket.spentProofs.map((proof) => (
                  <article className="ledger-row" key={proof.id}>
                    <div>
                      <strong>{proof.sourceProofId}</strong>
                      <p>
                        {ACTOR_LABELS[proof.actor]} burned {formatTokens(proof.tokens)} {proof.side}{' '}
                        for {formatCurrency(proof.payoutSats)}
                      </p>
                    </div>
                    <span>{proof.createdAt}</span>
                  </article>
                ))
              ) : (
                <p className="muted">Nothing redeemed yet.</p>
              )}
            </div>

            <div className="ledger-block">
              <h3>Receipts</h3>
              {activeMarket.receipts.length ? (
                activeMarket.receipts.map((receipt) => (
                  <article className="ledger-row" key={receipt.id}>
                    <div>
                      <strong>{receipt.kind}</strong>
                      <p>
                        {ACTOR_LABELS[receipt.actor]} {receipt.side} | reserve{' '}
                        {formatCurrency(receipt.reserveBefore)} {'->'}{' '}
                        {formatCurrency(receipt.reserveAfter)}
                      </p>
                    </div>
                    <span>{receipt.createdAt}</span>
                  </article>
                ))
              ) : (
                <p className="muted">Receipts will land here after the first fill.</p>
              )}
            </div>
          </div>
        </details>

        <details className="detail-drawer">
          <summary>
            <span>Market log</span>
            <strong>Append-only gossip</strong>
          </summary>
          <div className="event-log">
            {activeMarket.events.length ? (
              activeMarket.events.map((eventEntry) => (
                <article className="event-row" key={eventEntry.id}>
                  <div>
                    <strong>{eventEntry.label}</strong>
                    <p>{eventEntry.detail}</p>
                  </div>
                  <span>{eventEntry.createdAt}</span>
                </article>
              ))
            ) : (
              <p className="muted">Empty market. The first trade writes the opening line of history.</p>
            )}
          </div>
        </details>

        {/* Discussion Section */}
        <Discussion marketId={activeMarket.id} />
      </div>
    </div>
  )
}
