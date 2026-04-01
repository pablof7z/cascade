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

export default function AggregatePnLChart({ data, height = 160 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

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

    const series = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(74, 222, 128, 0.8)',
      topColor: 'rgba(74, 222, 128, 0.18)',
      bottomColor: 'rgba(74, 222, 128, 0.02)',
      lineWidth: 2,
      priceScaleId: 'right',
      priceFormat: {
        type: 'custom',
        formatter: formatAsDollars,
      },
    })

    chartRef.current = chart
    seriesRef.current = series

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
      seriesRef.current = null
    }
  }, [height])

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return
    if (data.length === 0) return

    // Aggregate P&L across all agents at each timestamp
    const aggregated = new Map<number, number>()
    for (const agent of data) {
      for (const pt of agent.dataPoints) {
        aggregated.set(pt.timestamp, (aggregated.get(pt.timestamp) ?? 0) + pt.pnl)
      }
    }

    const chartData = Array.from(aggregated.entries())
      .sort(([a], [b]) => a - b)
      .map(([time, value]) => ({ time: time as UTCTimestamp, value }))

    if (chartData.length < 2) return

    seriesRef.current.setData(chartData)
    chartRef.current.timeScale().fitContent()
  }, [data])

  return (
    <div>
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">
        Portfolio P&L
      </p>
      <div ref={containerRef} />
    </div>
  )
}
