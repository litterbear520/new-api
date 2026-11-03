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
import { Link } from '@tanstack/react-router'
import {
  type CSSProperties,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react'

import { getLobeIcon } from '@/lib/lobe-icon'

import {
  MODEL_LOGOS,
  TOOL_LOGOS,
  type Logo,
} from '../night-sea/sections-content'
import { runGateway } from './gateway-strands'
import { STACKED_QUERY, layoutNow, subscribeLayout } from './support'
import hub740 from './tex/gateway-hole-740.webp'
import hub1000 from './tex/gateway-hole-1000.webp'
import hubUrl from './tex/gateway-hole.webp'

/** A model (its prices in the model square) or a tool (its guide) */
function Chip(props: { logo: Logo; index: number }) {
  const { logo } = props
  const style = { '--i': props.index } as CSSProperties
  const inner = (
    <>
      <span className='ns-gw-icon' aria-hidden='true'>
        {getLobeIcon(logo.icon, 16)}
      </span>
      {logo.name}
    </>
  )
  return (
    <li style={style}>
      {logo.vendor ? (
        <Link
          to='/pricing'
          search={{ vendor: logo.vendor }}
          className='ns-gw-chip'
          data-id={logo.name}
        >
          {inner}
        </Link>
      ) : (
        // The docs are a separate site behind the same domain: full page load.
        <a href={logo.href} className='ns-gw-chip' data-id={logo.name}>
          {inner}
        </a>
      )}
    </li>
  )
}

/**
 * The screen after the first: the models on the left, the tools on the
 * right and the black hole between them (a still picture), the requests
 * flying through it drawn on the canvas while the screen shows.
 */
export function Gateway() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  // models above and tools below on narrow screens: the strands start again when that changes
  const layout = useSyncExternalStore(subscribeLayout, layoutNow, () => '')
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    const core = coreRef.current
    const hub = hubRef.current
    const picker = pickerRef.current
    if (!stage || !canvas || !core || !hub || !picker) return
    return runGateway({
      stage,
      canvas,
      core,
      hub,
      picker,
      stacked: window.matchMedia(STACKED_QUERY).matches,
      still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    })
  }, [layout])
  return (
    <section className='ns-gateway' aria-labelledby='ns-gw-title'>
      <div ref={stageRef} className='ns-gw-stage'>
        <canvas ref={canvasRef} className='ns-gw-lines' aria-hidden='true' />
        <div className='ns-gw-head'>
          <p className='ns-eyebrow'>模型与工具</p>
          <h2 id='ns-gw-title' className='ns-h2'>
            <span className='ns-phrase'>所有模型</span>{' '}
            <span className='ns-phrase'>一个入口</span>
          </h2>
          <p className='ns-lead'>
            Claude、GPT、Gemini、DeepSeek 等{` ${MODEL_LOGOS.length}\u00a0家`}
            模型的请求都从这里经过，
            {'Claude\u00a0Code'}、Codex、OpenCode 这些工具换一个地址就能接上。
          </p>
        </div>
        <div ref={pickerRef} className='ns-gw'>
          <ul className='ns-gw-side ns-gw-in' aria-label='模型'>
            {MODEL_LOGOS.map((logo, i) => (
              <Chip key={logo.name} logo={logo} index={i} />
            ))}
          </ul>
          <div ref={coreRef} className='ns-gw-core' aria-hidden='true'>
            <div ref={hubRef} className='ns-gw-hub'>
              <img
                src={hubUrl}
                srcSet={`${hub740} 740w, ${hub1000} 1000w, ${hubUrl} 1472w`}
                sizes='(max-width: 640px) 100vw, 39vw'
                alt=''
                loading='lazy'
                decoding='async'
              />
            </div>
          </div>
          <ul className='ns-gw-side ns-gw-out' aria-label='工具'>
            {TOOL_LOGOS.map((logo, i) => (
              <Chip key={logo.name} logo={logo} index={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
