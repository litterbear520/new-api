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
import '../../css/aurora.css'
import { cn } from '@/lib/utils'

/*
 * The light round the composer while the agent works (css/aurora.css), the
 * drawing page's cool aurora: blue, cyan and violet turn round the whole rim
 * with one brighter streak; the glow behind the glass breathes. One soft
 * flash round the rim when a run ends well. Driven by features/draw's
 * useHalo (mounted / on / flash).
 */

type AuroraProps = { mounted: boolean; on: boolean; flash: number }

/** Behind the glass: the blurred, breathing glow and the flash's halo. */
export function AuroraBack(props: AuroraProps) {
  return (
    <span className='bd-au-back' aria-hidden='true'>
      <span className={cn('bd-au-glow', props.on && 'bd-on')}>
        {props.mounted && (
          <span className='bd-au-g'>
            <span className='bd-au-gi' />
          </span>
        )}
      </span>
      <span
        key={props.flash}
        className={cn('bd-au-flash-g', props.flash > 0 && 'bd-flashing')}
      />
    </span>
  )
}

/** On the glass: the crisp ring and the flash. */
export function AuroraRing(props: AuroraProps) {
  return (
    <>
      <span
        className={cn('bd-au-ring', props.on && 'bd-on')}
        aria-hidden='true'
      >
        {props.mounted && <span className='bd-au-r' />}
      </span>
      <span
        key={props.flash}
        className={cn('bd-au-flash', props.flash > 0 && 'bd-flashing')}
        aria-hidden='true'
      />
    </>
  )
}
