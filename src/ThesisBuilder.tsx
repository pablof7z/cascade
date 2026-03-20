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
    <div className="shell">
      <nav className="detail-breadcrumb">
        <Link to="/">← All Markets</Link>
        <span className="breadcrumb-type">New Thesis</span>
      </nav>

      <div className="builder-layout">
        <header className="builder-header">
          <h1 className="builder-title">Build a Thesis</h1>
          <p className="builder-subtitle">
            Combine existing modules as evidence to create a compound prediction
          </p>
        </header>

        <div className="builder-grid">
          {/* Left: Module Selection */}
          <div className="builder-modules">
            <div className="module-search">
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="available-modules">
              <h3 className="section-label">Available Modules</h3>
              <div className="module-list">
                {filteredModules.map((mod) => (
                  <div
                    key={mod.id}
                    className={`module-option ${isSelected(mod.id) ? 'selected' : ''}`}
                    onClick={() => !isSelected(mod.id) && addModule(mod)}
                  >
                    <div className="module-option-content">
                      <span className="module-option-title">{mod.title}</span>
                      <span className="module-option-meta">
                        {mod.category} • {formatPercent(mod.probability)}
                      </span>
                    </div>
                    {isSelected(mod.id) ? (
                      <span className="module-check">✓</span>
                    ) : (
                      <button type="button" className="module-add">+</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Thesis Configuration */}
          <div className="builder-config">
            <div className="thesis-form">
              <label className="form-label">
                <span>Thesis Title</span>
                <input
                  type="text"
                  value={thesisTitle}
                  onChange={(e) => setThesisTitle(e.target.value)}
                  placeholder="e.g., The Great Decoupling — AI gains don't raise wages"
                  className="form-input"
                />
              </label>

              <label className="form-label">
                <span>Description</span>
                <textarea
                  value={thesisDescription}
                  onChange={(e) => setThesisDescription(e.target.value)}
                  placeholder="Describe the thesis and resolution criteria..."
                  rows={3}
                  className="form-textarea"
                />
              </label>
            </div>

            {/* Selected Modules */}
            <div className="selected-modules">
              <h3 className="section-label">
                Evidence Modules ({selectedModules.length})
              </h3>

              {selectedModules.length === 0 ? (
                <div className="empty-evidence">
                  <p>Select modules from the left to use as evidence</p>
                </div>
              ) : (
                <div className="evidence-list">
                  {selectedModules.map((mod) => (
                    <div key={mod.id} className="evidence-item">
                      <div className="evidence-item-header">
                        <span className="evidence-item-title">{mod.title}</span>
                        <button
                          type="button"
                          className="evidence-remove"
                          onClick={() => removeModule(mod.id)}
                        >
                          ×
                        </button>
                      </div>

                      <div className="evidence-item-controls">
                        <div className="direction-toggle">
                          <button
                            type="button"
                            className={`direction-btn ${mod.direction === 'supports' ? 'active' : ''}`}
                            onClick={() => mod.direction !== 'supports' && toggleDirection(mod.id)}
                          >
                            YES supports
                          </button>
                          <button
                            type="button"
                            className={`direction-btn ${mod.direction === 'opposes' ? 'active' : ''}`}
                            onClick={() => mod.direction !== 'opposes' && toggleDirection(mod.id)}
                          >
                            YES opposes
                          </button>
                        </div>

                        <div className="weight-control">
                          <span className="weight-label">Weight</span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={mod.weight}
                            onChange={(e) => updateWeight(mod.id, Number(e.target.value))}
                            className="weight-slider"
                          />
                          <span className="weight-value">{mod.weight}</span>
                        </div>
                      </div>

                      <div className="evidence-item-impact">
                        <span className={`impact-text ${mod.direction}`}>
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
            <div className="thesis-preview">
              <h3 className="section-label">Preview Probability</h3>
              <div className="preview-probability">
                <span className="preview-prob-value">{formatPercent(previewProbability)}</span>
                <div className="preview-bar">
                  <div
                    className="preview-bar-fill"
                    style={{ width: `${previewProbability * 100}%` }}
                  />
                </div>
              </div>
              <p className="preview-note">
                Based on current module probabilities and your weight assignments
              </p>
            </div>

            {/* Create Button */}
            <button
              type="button"
              className="primary-button create-thesis-btn"
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
