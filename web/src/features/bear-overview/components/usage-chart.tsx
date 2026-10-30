/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FAMILY_LABELS, type FamilyKey } from '../constants'

export interface ChartDay {
  /** Tooltip title and table row label */
  label: string
  /** X-axis label, or '' to leave the slot unlabelled */
  tick: string
  values: Partial<Record<FamilyKey, number>>
  today: boolean
}

const DEFAULT_HEIGHT = 132
const PAD_LEFT = 38
const PAD_TOP = 8
const PAD_BOTTOM = 20

/** 1, 2, 2.5 or 5 times a power of ten, at or above `max` */
function niceMax(max: number): number {
  if (max <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 2.5, 5, 10].find((n) => max / power <= n) ?? 10
  return step * power
}

/** A bar segment with a square bottom and a 4px rounded top */
function topPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/**
 * Stacked bars, one per day, coloured by model family (bottom first in the
 * fixed family order). Bars are thin with a 2px surface gap between segments;
 * today's bar is lighter because the day is not over. Hover shows the day's
 * breakdown; the numbers are also in a table for screen readers.
 */
export function UsageChart(props: {
  days: ChartDay[]
  families: FamilyKey[]
  barWidth: number
  format: (value: number) => string
  axisFormat: (value: number) => string
  /** Axis top when every day is zero */
  emptyMax: number
  /** Chart height in px (132 on the overview) */
  height?: number
}) {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const chartHeight = props.height ?? DEFAULT_HEIGHT

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const totals = props.days.map((day) =>
    props.families.reduce((sum, key) => sum + (day.values[key] ?? 0), 0)
  )
  const max = niceMax(Math.max(...totals, 0) || props.emptyMax)
  const plotH = chartHeight - PAD_TOP - PAD_BOTTOM
  const plotW = Math.max(0, width - PAD_LEFT)
  const slot = props.days.length ? plotW / props.days.length : 0
  const bw = Math.min(props.barWidth, slot * 0.62)
  const y = (value: number) => PAD_TOP + plotH - (value / max) * plotH

  const activeDay = active === null ? null : props.days[active]
  const tipRows = activeDay
    ? props.families.filter((key) => (activeDay.values[key] ?? 0) > 0).reverse()
    : []

  return (
    <div
      ref={boxRef}
      className='bo-chart-box'
      style={props.height ? { height: props.height } : undefined}
      onMouseLeave={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          className='bo-chart'
          width={width}
          height={chartHeight}
          viewBox={`0 0 ${width} ${chartHeight}`}
          aria-hidden='true'
        >
          {[0, 1, 2].map((step) => {
            const value = (max / 2) * step
            const lineY = Math.round(y(value)) + 0.5
            const label = props.axisFormat(value)
            // Tiny amounts can round to the same label; keep the ends only.
            const repeated =
              step === 1 &&
              (label === props.axisFormat(0) || label === props.axisFormat(max))
            return (
              <g key={step}>
                <line
                  className={step ? 'bo-gl' : 'bo-base'}
                  x1={PAD_LEFT}
                  x2={width}
                  y1={lineY}
                  y2={lineY}
                />
                {!repeated && (
                  <text x={PAD_LEFT - 6} y={y(value) + 4} textAnchor='end'>
                    {label}
                  </text>
                )}
              </g>
            )
          })}
          {props.days.map((day, index) => {
            const center = PAD_LEFT + slot * index + slot / 2
            const x0 = center - bw / 2
            const parts = props.families.filter(
              (key) => (day.values[key] ?? 0) > 0
            )
            let top = PAD_TOP + plotH
            return (
              <g key={day.label}>
                {parts.map((key, part) => {
                  const h = ((day.values[key] ?? 0) / max) * plotH
                  const gap = part === 0 ? 0 : 2
                  top -= h
                  const height = h - gap
                  if (height <= 0) return null
                  const cls = `bo-seg-fill bo-fam-${key}${day.today ? ' bo-today' : ''}`
                  return part === parts.length - 1 ? (
                    <path
                      key={key}
                      className={cls}
                      d={topPath(x0, top, bw, height)}
                    />
                  ) : (
                    <rect
                      key={key}
                      className={cls}
                      x={x0}
                      y={top}
                      width={bw}
                      height={height}
                    />
                  )
                })}
                {day.tick && (
                  <text x={center} y={chartHeight - 4} textAnchor='middle'>
                    {day.tick}
                  </text>
                )}
                <rect
                  className='bo-hit'
                  data-on={active === index ? '' : undefined}
                  x={PAD_LEFT + slot * index}
                  y={PAD_TOP}
                  width={slot}
                  height={plotH}
                  rx={4}
                  onMouseEnter={() => setActive(index)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {activeDay && active !== null && (
        <div
          className='bo-tip'
          style={{
            left: Math.min(
              Math.max(PAD_LEFT + slot * active + slot / 2 - 70, 0),
              Math.max(0, width - 150)
            ),
            bottom: chartHeight - y(totals[active]) + 10,
          }}
        >
          <b>{activeDay.label}</b>
          {tipRows.map((key) => (
            <div key={key} className='bo-tip-r'>
              <span>
                <i className={`bo-sw bo-fam-${key}`} />
                {t(FAMILY_LABELS[key])}
              </span>
              <span>{props.format(activeDay.values[key] ?? 0)}</span>
            </div>
          ))}
          <div className='bo-tip-r'>
            <span>{t('Total')}</span>
            <span>{props.format(totals[active])}</span>
          </div>
        </div>
      )}
    </div>
  )
}
