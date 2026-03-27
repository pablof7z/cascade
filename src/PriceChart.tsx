import { useEffect, useRef } from 'react'
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

export type HistoryPoint = {
  time: number
  priceLong: number
  reserve: number
}

type Props = {
  data: HistoryPoint[]
}

function formatAsPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatAsSats(value: number) {
  return `$${value.toFixed(0)}`
}

export default function PriceChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const priceSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const reserveSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 160,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      leftPriceScale: {
        visible: true,
        borderVisible: false,
      },
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

    const priceSeries = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(74, 222, 128, 0.8)',
      topColor: 'rgba(74, 222, 128, 0.18)',
      bottomColor: 'rgba(74, 222, 128, 0.02)',
      lineWidth: 2,
      priceScaleId: 'left',
      priceFormat: {
        type: 'custom',
        formatter: formatAsPercent,
      },
    })

    const reserveSeries = chart.addSeries(LineSeries, {
      color: 'rgba(217, 176, 112, 0.6)',
      lineWidth: 1,
      priceScaleId: 'right',
      priceFormat: {
        type: 'custom',
        formatter: formatAsSats,
      },
    })

    chartRef.current = chart
    priceSeriesRef.current = priceSeries
    reserveSeriesRef.current = reserveSeries

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
      priceSeriesRef.current = null
      reserveSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!priceSeriesRef.current || !reserveSeriesRef.current || !chartRef.current) return
    if (data.length < 2) return

    const priceData = data.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.priceLong,
    }))

    const reserveData = data.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.reserve,
    }))

    priceSeriesRef.current.setData(priceData)
    reserveSeriesRef.current.setData(reserveData)
    chartRef.current.timeScale().fitContent()
  }, [data])

  return <div className="price-chart-container" ref={containerRef} />
}
