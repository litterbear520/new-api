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
import { useEffect, useRef, type RefObject } from 'react'

import { mountNightSky, type NightSky } from '../lib/night-sky'

type NightSkyProps = {
  /** Horizon in px from the top of the chat area. */
  horizon: () => number
  /** The bear's <svg>; its lantern lights a path on the sea. */
  bear: RefObject<SVGSVGElement | null>
  still: boolean
  /** Changes when the horizon moves (composer height, empty → chat). */
  layoutKey: string
}

/** Lantern position in the bear's viewBox (-8 -9 40 31). */
const LAMP_X = (-3 + 8) / 40
const LAMP_Y = (3.3 + 9) / 31

export function NightSkyCanvas(props: NightSkyProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sky = useRef<NightSky | null>(null)
  const horizon = useRef(props.horizon)
  horizon.current = props.horizon
  const stillAtMount = useRef(props.still)
  const { bear, still } = props

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    sky.current = mountNightSky(cv, {
      horizon: () => horizon.current(),
      still: stillAtMount.current,
      lantern: () => {
        const svg = bear.current
        if (!svg || !cv.isConnected) return null
        const c = cv.getBoundingClientRect()
        const r = svg.getBoundingClientRect()
        if (!r.width) return null
        return {
          x: r.left - c.left + LAMP_X * r.width,
          y: r.top - c.top + LAMP_Y * r.height,
        }
      },
    })
    return () => {
      sky.current?.dispose()
      sky.current = null
    }
  }, [bear])

  useEffect(() => {
    sky.current?.setStill(still)
  }, [still])

  useEffect(() => {
    sky.current?.refresh()
  }, [props.layoutKey])

  return <canvas ref={ref} className='bc-sky' aria-hidden='true' />
}
