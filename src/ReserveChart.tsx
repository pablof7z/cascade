import { useEffect, useRef } from 'react'
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

type DataPoint = { time: number; value: number }

type Props = {
  data: DataPoint[]
  height?: number
}

function formatAsSats(value: number) {
  return `$${value.toFixed(0)}`
}

export default function ReserveChart({ data, height = 120 }: Props) {
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
        vertLine: { color: 'rgba(255, 255, 255, 0.08)' },
        horzLine: { color: 'rgba(255, 255, 255, 0.08)' },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(147, 130, 255, 0.8)',
      topColor: 'rgba(147, 130, 255, 0.2)',
      bottomColor: 'rgba(147, 130, 255, 0.02)',
      lineWidth: 2,
      priceScaleId: 'right',
      priceFormat: {
        type: 'custom',
        formatter: formatAsSats,
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
    if (data.length < 2) return

    seriesRef.current.setData(
      data.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })),
    )
    chartRef.current.timeScale().fitContent()
  }, [data])

  return <div className="reserve-chart-container" ref={containerRef} />
}
