import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Dispatch } from 'react'
import type { Action } from './App'
import type { MarketEntry } from './storage'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatPercent(value: number) {
  return `${currencyFormatter.format(value * 100)}%`
}

// Mock available modules for selection
interface AvailableModule {
  id: string
  title: string
  probability: number
  category: string
}

const mockAvailableModules: AvailableModule[] = [
  { id: 'mod-1', title: 'AGI achieved by 2030', probability: 0.35, category: 'AI & Compute' },
  { id: 'mod-2', title: 'US implements UBI pilot program', probability: 0.42, category: 'Governance & Society' },
  { id: 'mod-3', title: 'First Mars landing with crew by 2035', probability: 0.28, category: 'Space & Frontier' },
  { id: 'mod-4', title: 'Lab-grown meat exceeds 10% market share by 2028', probability: 0.55, category: 'Biotech & Health' },
  { id: 'mod-5', title: 'Fusion power plant goes online', probability: 0.22, category: 'Energy & Climate' },
  { id: 'mod-6', title: 'Brain-computer interface reaches 1M users', probability: 0.38, category: 'Biotech & Health' },
  { id: 'mod-7', title: 'Major tech company announces mass AI layoffs', probability: 0.68, category: 'AI & Compute' },
  { id: 'mod-8', title: 'Carbon capture at gigaton scale', probability: 0.15, category: 'Energy & Climate' },
]

interface SelectedModule {
  id: string
  title: string
  probability: number
  direction: 'supports' | 'opposes'
  weight: number // 1-5
}

type Props = {
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

export default function ThesisBuilder({ dispatch }: Props) {
  const navigate = useNavigate()
  const [thesisTitle, setThesisTitle] = useState('')
  const [thesisDescription, setThesisDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModules, setSelectedModules] = useState<SelectedModule[]>([])

  // Filter available modules by search
  const filteredModules = mockAvailableModules.filter((mod) =>
    mod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mod.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if a module is already selected
  const isSelected = (id: string) => selectedModules.some((m) => m.id === id)

  // Add a module to selection
  const addModule = (mod: AvailableModule) => {
    if (isSelected(mod.id)) return
    setSelectedModules([
      ...selectedModules,
      {
        id: mod.id,
        title: mod.title,
        probability: mod.probability,
        direction: 'supports',
        weight: 3,
      },
    ])
  }

  // Remove a module from selection
  const removeModule = (id: string) => {
    setSelectedModules(selectedModules.filter((m) => m.id !== id))
  }

  // Toggle direction for a selected module
  const toggleDirection = (id: string) => {
    setSelectedModules(
      selectedModules.map((m) =>
        m.id === id
          ? { ...m, direction: m.direction === 'supports' ? 'opposes' : 'supports' }
          : m
      )
    )
  }

  // Update weight for a selected module
  const updateWeight = (id: string, weight: number) => {
    setSelectedModules(
      selectedModules.map((m) => (m.id === id ? { ...m, weight } : m))
    )
  }

  // Calculate preview probability based on selected modules
  const calculatePreviewProbability = (): number => {
    if (selectedModules.length === 0) return 0.5

    let totalWeight = 0
    let weightedSum = 0

    for (const mod of selectedModules) {
      const effectiveProb = mod.direction === 'supports' ? mod.probability : 1 - mod.probability
      weightedSum += effectiveProb * mod.weight
      totalWeight += mod.weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5
  }

  const previewProbability = calculatePreviewProbability()

  const handleCreateThesis = () => {
    if (!thesisTitle.trim() || selectedModules.length === 0) return

    dispatch({
      type: 'CREATE_MARKET',
      title: thesisTitle,
      description: thesisDescription,
      seedWithUser: false,
    })

    navigate('/')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <nav className="mb-6">
        <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">
          ← All Markets
        </Link>
        <span className="text-gray-500 text-sm ml-2">New Thesis</span>
      </nav>

      <div className="space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Build a Thesis</h1>
          <p className="text-gray-400">
            Combine existing modules as evidence to create a compound prediction
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Module Selection */}
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Available Modules
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredModules.map((mod) => (
                  <div
                    key={mod.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected(mod.id)
                        ? 'bg-blue-900/30 border-blue-700'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => !isSelected(mod.id) && addModule(mod)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{mod.title}</span>
                      <span className="text-xs text-gray-500">
                        {mod.category} • {formatPercent(mod.probability)}
                      </span>
                    </div>
                    {isSelected(mod.id) ? (
                      <span className="text-green-500 ml-2">✓</span>
                    ) : (
                      <button type="button" className="text-blue-400 hover:text-blue-300 ml-2 text-xl">
                        +
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Thesis Configuration */}
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-300 mb-1 block">Thesis Title</span>
                <input
                  type="text"
                  value={thesisTitle}
                  onChange={(e) => setThesisTitle(e.target.value)}
                  placeholder="e.g., The Great Decoupling — AI gains don't raise wages"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-300 mb-1 block">Description</span>
                <textarea
                  value={thesisDescription}
                  onChange={(e) => setThesisDescription(e.target.value)}
                  placeholder="Describe the thesis and resolution criteria..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </label>
            </div>

            {/* Selected Modules */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Evidence Modules ({selectedModules.length})
              </h3>

              {selectedModules.length === 0 ? (
                <div className="p-6 bg-gray-800/50 border border-dashed border-gray-700 rounded-lg text-center">
                  <p className="text-gray-500 text-sm">Select modules from the left to use as evidence</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedModules.map((mod) => (
                    <div key={mod.id} className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm text-white font-medium">{mod.title}</span>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-red-400 ml-2"
                          onClick={() => removeModule(mod.id)}
                        >
                          ×
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              mod.direction === 'supports'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                            onClick={() => mod.direction !== 'supports' && toggleDirection(mod.id)}
                          >
                            YES supports
                          </button>
                          <button
                            type="button"
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              mod.direction === 'opposes'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                            onClick={() => mod.direction !== 'opposes' && toggleDirection(mod.id)}
                          >
                            YES opposes
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Weight</span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={mod.weight}
                            onChange={(e) => updateWeight(mod.id, Number(e.target.value))}
                            className="flex-1 accent-blue-500"
                          />
                          <span className="text-xs text-white w-4 text-center">{mod.weight}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <span className={`text-xs ${mod.direction === 'supports' ? 'text-green-400' : 'text-red-400'}`}>
                          If "{mod.title}" → YES: Thesis {mod.direction === 'supports' ? '+' : '-'}
                          {Math.round(mod.weight * 5)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Preview Probability
              </h3>
              <div className="space-y-2">
                <span className="text-2xl font-bold text-white">{formatPercent(previewProbability)}</span>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${previewProbability * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Based on current module probabilities and your weight assignments
              </p>
            </div>

            {/* Create Button */}
            <button
              type="button"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors"
              onClick={handleCreateThesis}
              disabled={!thesisTitle.trim() || selectedModules.length === 0}
            >
              Create Thesis
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
