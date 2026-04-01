import { useEffect, useRef } from 'react'
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { AgentPnLData } from './lib/mockPnLData'

type Props = {
  data: AgentPnLData[]
  height?: number
}

function formatAsDollars(value: number) {
  return `$${value.toFixed(2)}`
}

// Muted color palette — all at 0.8 line opacity with emerald-family hues
const SERIES_COLORS = [
  { line: 'rgba(74, 222, 128, 0.8)', top: 'rgba(74, 222, 128, 0.18)', bottom: 'rgba(74, 222, 128, 0.02)' },
  { line: 'rgba(52, 211, 153, 0.8)', top: 'rgba(52, 211, 153, 0.18)', bottom: 'rgba(52, 211, 153, 0.02)' },
  { line: 'rgba(110, 231, 183, 0.8)', top: 'rgba(110, 231, 183, 0.18)', bottom: 'rgba(110, 231, 183, 0.02)' },
  { line: 'rgba(167, 243, 208, 0.8)', top: 'rgba(167, 243, 208, 0.18)', bottom: 'rgba(167, 243, 208, 0.02)' },
  { line: 'rgba(16, 185, 129, 0.8)', top: 'rgba(16, 185, 129, 0.18)', bottom: 'rgba(16, 185, 129, 0.02)' },
]

export default function PerAgentPnLChart({ data, height = 160 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<ISeriesApi<'Area'>[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      leftPriceScale: { visible: false },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
      },
      timeScale: {
        visible: false,
        borderVisible: false,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLine: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    })

    chartRef.current = chart
    seriesRefs.current = []

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width })
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRefs.current = []
    }
  }, [height])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (data.length === 0) return

    // Remove old series and recreate for the current data shape
    for (const s of seriesRefs.current) {
      chart.removeSeries(s)
    }
    seriesRefs.current = []

    for (let i = 0; i < data.length; i++) {
      const agent = data[i]
      const color = SERIES_COLORS[i % SERIES_COLORS.length]

      const series = chart.addSeries(AreaSeries, {
        lineColor: color.line,
        topColor: color.top,
        bottomColor: color.bottom,
        lineWidth: 2,
        priceScaleId: 'right',
        priceFormat: {
          type: 'custom',
          formatter: formatAsDollars,
        },
      })

      const chartData = agent.dataPoints
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((pt) => ({ time: pt.timestamp as UTCTimestamp, value: pt.pnl }))

      if (chartData.length >= 2) {
        series.setData(chartData)
      }

      seriesRefs.current.push(series)
    }

    if (seriesRefs.current.length > 0) {
      chart.timeScale().fitContent()
    }
  }, [data])

  const agentNames = data.map((a) => a.agentName)

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
          Per-Agent P&L
        </p>
        <div className="flex items-center gap-3">
          {agentNames.map((name, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length]
            return (
              <span key={name} className="flex items-center gap-1 text-xs text-neutral-400">
                <span
                  className="inline-block w-3 h-px"
                  style={{ backgroundColor: color.line, height: '2px' }}
                />
                {name}
              </span>
            )
          })}
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  )
}
