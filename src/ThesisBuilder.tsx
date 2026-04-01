import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Dispatch } from 'react'
import type { Action } from './App'
import { deriveMarketMetrics, type ThesisSignalOutcome } from './market'
import { inferMarketType } from './marketCatalog'
import MarkdownContent from './components/MarkdownContent'
import TiptapEditor from './components/TiptapEditor'
import type { MarketEntry } from './storage'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const thesisExamples = [
  'AGI will never exist',
  'Iran will outlast the US in a direct war',
  'The dollar milkshake theory will play out',
]

type MarketDuration = 'infinite' | 'end-date'

type AvailableModule = {
  id: string
  title: string
  description: string
  probability: number
  reserve: number
  trades: number
}

type DraftSignal = {
  moduleMarketId: string
  moduleTitle: string
  expectedOutcome: ThesisSignalOutcome
  note: string
}

type Props = {
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number) {
  return `${currencyFormatter.format(value * 100)}%`
}

function makeMarketId() {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `market-${suffix}`
}

function marketLean(probability: number): ThesisSignalOutcome {
  return probability >= 0.5 ? 'YES' : 'NO'
}

export default function ThesisBuilder({ markets, dispatch }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [thesisStatement, setThesisStatement] = useState('')
  const [thesisArgument, setThesisArgument] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSignals, setSelectedSignals] = useState<DraftSignal[]>([])
  const [marketDuration, setMarketDuration] = useState<MarketDuration | null>(null)

  const wizardSteps = useMemo(() => {
    const steps = [{ id: 'claim', label: 'Claim' }]
    if (marketDuration === 'infinite') {
      steps.push({ id: 'case', label: 'Case' })
    }
    steps.push({ id: 'signals', label: 'Signals' })
    steps.push({ id: 'review', label: 'Review' })
    return steps
  }, [marketDuration])

  const caseStepIndex = useMemo(
    () => wizardSteps.findIndex((s) => s.id === 'case'),
    [wizardSteps],
  )
  const availableModules = useMemo(
    () =>
      Object.values(markets)
        .filter((entry) => inferMarketType(entry.market) === 'module')
        .map((entry) => {
          const metrics = deriveMarketMetrics(entry.market)
          return {
            id: entry.market.id,
            title: entry.market.title,
            description: entry.market.description,
            probability: metrics.longOdds,
            reserve: entry.market.reserve,
            trades: entry.market.quotes.length,
          } satisfies AvailableModule
        })
        .sort((left, right) => {
          if (right.reserve !== left.reserve) {
            return right.reserve - left.reserve
          }
          return left.title.localeCompare(right.title)
        }),
    [markets],
  )

  const moduleLookup = useMemo(
    () => Object.fromEntries(availableModules.map((module) => [module.id, module])),
    [availableModules],
  )

  const filteredModules = useMemo(
    () =>
      availableModules.filter((module) => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) {
          return true
        }
        return (
          module.title.toLowerCase().includes(query) ||
          module.description.toLowerCase().includes(query)
        )
      }),
    [availableModules, searchQuery],
  )

  const selectedSignalIds = new Set(selectedSignals.map((signal) => signal.moduleMarketId))
  const trimmedStatement = thesisStatement.trim()
  const trimmedArgument = thesisArgument.trim()
  const canAdvance =
    step === 0
      ? trimmedStatement.length > 0 && marketDuration !== null
      : step === caseStepIndex
        ? trimmedArgument.length > 0
        : true

  const addSignal = (module: AvailableModule) => {
    if (selectedSignalIds.has(module.id)) {
      return
    }

    setSelectedSignals((current) => [
      ...current,
      {
        moduleMarketId: module.id,
        moduleTitle: module.title,
        expectedOutcome: 'YES',
        note: '',
      },
    ])
  }

  const removeSignal = (moduleMarketId: string) => {
    setSelectedSignals((current) =>
      current.filter((signal) => signal.moduleMarketId !== moduleMarketId),
    )
  }

  const updateSignalOutcome = (moduleMarketId: string, expectedOutcome: ThesisSignalOutcome) => {
    setSelectedSignals((current) =>
      current.map((signal) =>
        signal.moduleMarketId === moduleMarketId ? { ...signal, expectedOutcome } : signal,
      ),
    )
  }

  const updateSignalNote = (moduleMarketId: string, note: string) => {
    setSelectedSignals((current) =>
      current.map((signal) =>
        signal.moduleMarketId === moduleMarketId ? { ...signal, note } : signal,
      ),
    )
  }

  const goNext = () => {
    if (!canAdvance || step >= wizardSteps.length - 1) {
      return
    }
    setStep((current) => current + 1)
  }

  const goBack = () => {
    if (step === 0) {
      return
    }
    setStep((current) => current - 1)
  }

  const handleCreateThesis = () => {
    if (!trimmedStatement || !trimmedArgument) {
      return
    }

    const marketId = makeMarketId()

    dispatch({
      type: 'CREATE_MARKET',
      id: marketId,
      title: trimmedStatement,
      description: trimmedArgument,
      seedWithUser: false,
      kind: 'thesis',
      creatorPubkey: 'you',
      thesis: {
        statement: trimmedStatement,
        argument: trimmedArgument,
        signals: selectedSignals.map((signal) => ({
          moduleMarketId: signal.moduleMarketId,
          moduleTitle: signal.moduleTitle,
          expectedOutcome: signal.expectedOutcome,
          note: signal.note.trim(),
        })),
      },
    })

    navigate(`/market/${marketId}`)
  }

  const renderClaimStep = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">
          Market title
        </h1>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-neutral-400 mb-3 block">
          Title
        </span>
        <input
          type="text"
          value={thesisStatement}
          onChange={(event) => setThesisStatement(event.target.value)}
          placeholder="AGI will never exist"
          className="w-full bg-transparent border-0 border-b border-neutral-800 px-0 py-4 text-3xl text-white placeholder-neutral-600 focus:outline-none focus:border-white sm:text-4xl"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-400 mb-3">
          Examples
        </p>
        <div className="flex flex-wrap gap-2">
          {thesisExamples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setThesisStatement(example)}
              className="rounded-full border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-400 mb-3">
          Duration
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setMarketDuration('infinite')}
            className={`flex-1 border px-5 py-4 text-left transition-colors ${
              marketDuration === 'infinite'
                ? 'border-white text-white'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
            }`}
          >
            <div className="text-sm font-medium mb-1">Open ended</div>
            <div className="text-xs text-neutral-500">No expiry — an infinite game</div>
          </button>
          <button
            type="button"
            onClick={() => setMarketDuration('end-date')}
            className={`flex-1 border px-5 py-4 text-left transition-colors ${
              marketDuration === 'end-date'
                ? 'border-white text-white'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
            }`}
          >
            <div className="text-sm font-medium mb-1">Has end date</div>
            <div className="text-xs text-neutral-500">Resolves on a specific date</div>
          </button>
        </div>
      </div>
    </div>
  )

  const renderCaseStep = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold text-white">
          Write the case
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Use headings, lists, quotes, and emphasis. The final thesis page renders this markdown directly.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-neutral-400 mb-3 block">
          Argument
        </span>
        <TiptapEditor
          value={thesisArgument}
          onChange={setThesisArgument}
          placeholder="Why does this thesis play out?"
          className="border-b border-neutral-800 pb-4"
        />
      </label>
    </div>
  )

  const renderSignalsStep = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold text-white">
          Add signals
        </h2>
      </div>

      {selectedSignals.length > 0 ? (
        <div className="space-y-5">
          {selectedSignals.map((signal) => {
            const module = moduleLookup[signal.moduleMarketId]
            const lean = module ? marketLean(module.probability) : null
            const isContrarian = lean ? lean !== signal.expectedOutcome : false

            return (
              <div
                key={signal.moduleMarketId}
                className="space-y-4 border-b border-neutral-800 pb-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="mb-1 text-white font-medium">{signal.moduleTitle}</h3>
                    {module ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span>Current YES {formatPercent(module.probability)}</span>
                        {lean ? (
                          <span className={isContrarian ? 'text-amber-300' : undefined}>
                            {isContrarian
                              ? `Current market leans ${lean}`
                              : `Current market leans ${lean}`}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSignal(signal.moduleMarketId)}
                    className="text-sm text-neutral-500 transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateSignalOutcome(signal.moduleMarketId, 'YES')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      signal.expectedOutcome === 'YES'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    Expect YES
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSignalOutcome(signal.moduleMarketId, 'NO')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      signal.expectedOutcome === 'NO'
                        ? 'bg-rose-600 text-white'
                        : 'border border-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    Expect NO
                  </button>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-neutral-400 mb-2 block">
                    Why this signal matters
                  </span>
                  <textarea
                    value={signal.note}
                    onChange={(event) =>
                      updateSignalNote(signal.moduleMarketId, event.target.value)
                    }
                    rows={3}
                    placeholder="Why does this point toward the thesis?"
                    className="w-full resize-none border-0 border-b border-neutral-800 bg-transparent px-0 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-white"
                  />
                </label>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="space-y-4 border-t border-neutral-800 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-lg font-semibold text-white">
            Signal markets
          </h3>

          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search modules"
              className="w-full rounded-full border border-neutral-800 bg-transparent px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
            />
          </div>
        </div>

        {availableModules.length === 0 ? (
          <div className="py-6 text-sm text-neutral-500">
            <p className="mb-2 text-neutral-300">
              No signal markets exist yet.
            </p>
            <Link
              to="/"
              className="text-neutral-300 transition-colors hover:text-white"
            >
              Back to markets
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredModules.map((module) => {
              const alreadySelected = selectedSignalIds.has(module.id)

              return (
                <div
                  key={module.id}
                  className="flex flex-col gap-3 border-b border-neutral-800 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <h4 className="mb-1 text-white font-medium">{module.title}</h4>
                    <p className="mb-2 line-clamp-2 text-sm text-neutral-500">
                      {module.description}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span>YES {formatPercent(module.probability)}</span>
                      <span>Reserve {formatCurrency(module.reserve)}</span>
                      <span>{module.trades} trade{module.trades === 1 ? '' : 's'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={alreadySelected}
                    onClick={() => addSignal(module)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      alreadySelected
                        ? 'cursor-not-allowed text-neutral-500'
                        : 'border border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:text-white'
                    }`}
                  >
                    {alreadySelected ? 'Selected' : 'Add signal'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold text-white">
          Review
        </h2>
      </div>

      <section className="border-b border-neutral-800 pb-6">
        <h3 className="text-sm text-neutral-500 mb-2">Title</h3>
        <p className="text-2xl font-medium text-white">
          {trimmedStatement || '—'}
        </p>
      </section>

      <section className="border-b border-neutral-800 pb-6">
        <h3 className="text-sm text-neutral-500 mb-2">Argument</h3>
        {trimmedArgument ? (
          <MarkdownContent content={trimmedArgument} className="text-neutral-300" />
        ) : (
          <p className="text-neutral-400">—</p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm text-neutral-500">Signals</h3>
          <span className="text-sm text-neutral-500">
            {selectedSignals.length}
          </span>
        </div>

        {selectedSignals.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No signal markets attached.
          </p>
        ) : (
          <div className="space-y-4">
            {selectedSignals.map((signal) => (
              <div
                key={signal.moduleMarketId}
                className="border-b border-neutral-800 pb-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-white font-medium">{signal.moduleTitle}</p>
                  <span
                    className={`text-xs ${
                      signal.expectedOutcome === 'YES'
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {signal.expectedOutcome}
                  </span>
                </div>
                <p className="text-sm text-neutral-400">
                  {signal.note.trim() || 'No rationale added for this signal yet.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )

  const renderStep = () => {
    const currentStepId = wizardSteps[step]?.id

    if (currentStepId === 'claim') return renderClaimStep()
    if (currentStepId === 'case') return renderCaseStep()
    if (currentStepId === 'signals') return renderSignalsStep()
    return renderReviewStep()
  }

  const isLastStep = step === wizardSteps.length - 1
  const createDisabled = !trimmedStatement || (marketDuration === 'infinite' && !trimmedArgument)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 min-h-[80vh]">
      <nav className="mb-8">
        <Link to="/" className="text-sm text-neutral-400 hover:text-white">
          Back to Markets
        </Link>
        <span className="ml-2 text-sm text-neutral-500">Create Market</span>
      </nav>

      <div className="border-b border-neutral-800">
        <div className="flex gap-6 overflow-x-auto">
          {wizardSteps.map((wizardStep, index) => {
            const isActive = index === step
            const isComplete = index < step

            return (
              <button
                key={wizardStep.id}
                type="button"
                onClick={() => setStep(index)}
                className={`border-b-2 pb-4 text-left transition-colors ${
                  isActive
                    ? 'border-white text-white'
                    : isComplete
                      ? 'border-neutral-600 text-neutral-300'
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className="mb-1 text-xs uppercase tracking-[0.18em]">
                  {index + 1}
                </div>
                <div className="font-medium">{wizardStep.label}</div>
              </button>
            )
          })}
        </div>
      </div>

      <section className="py-10">
        {renderStep()}
      </section>

      <div className="flex flex-col gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className={`text-sm font-medium transition-colors ${
            step === 0
              ? 'cursor-not-allowed text-neutral-600'
              : 'text-neutral-300 hover:text-white'
          }`}
        >
          Back
        </button>

        {!isLastStep ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              canAdvance
                ? 'bg-white text-neutral-950 hover:bg-neutral-100'
                : 'cursor-not-allowed bg-neutral-800 text-neutral-500'
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreateThesis}
            disabled={createDisabled}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              !createDisabled
                ? 'bg-white text-neutral-950 hover:bg-neutral-100'
                : 'cursor-not-allowed bg-neutral-800 text-neutral-500'
            }`}
          >
            Launch market
          </button>
        )}
      </div>
    </div>
  )
}
