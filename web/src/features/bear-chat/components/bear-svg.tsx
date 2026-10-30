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
import { memo, useState, type Ref } from 'react'

import { bearMarkup } from '../lib/bear/svg'

type BearSvgProps = {
  boat?: boolean
  className?: string
  /** Receives the <svg> once it is in the page. */
  svgRef?: Ref<SVGSVGElement>
  act?: string
}

/**
 * The bear's static markup (built in lib/bear/svg.ts, no user input). It
 * never re-renders: acts are switched on the <svg>'s data-act by the
 * controller, outside React.
 */
export const BearSvg = memo(function BearSvg(props: BearSvgProps) {
  const [html] = useState(() => bearMarkup({ boat: props.boat }))
  const attach = (host: HTMLSpanElement | null) => {
    const svg = host?.querySelector('svg') ?? null
    if (svg && props.act) svg.dataset.act = props.act
    if (typeof props.svgRef === 'function') props.svgRef(svg)
    else if (props.svgRef) {
      ;(props.svgRef as { current: SVGSVGElement | null }).current = svg
    }
  }
  return (
    <span
      ref={attach}
      className={props.className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
