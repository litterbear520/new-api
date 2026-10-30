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
import { cn } from '@/lib/utils'

/*
 * The light around the composer while a picture is drawing: a cool aurora
 * (Apple Intelligence style). Blue, cyan and violet flow round the whole rim,
 * so the ring never breaks; one brighter streak rides the colours. The
 * gradient turns about the box centre, so the streak rushes through the
 * corners and slows along the long edges. The glow behind the glass breathes.
 * The turning is a transform on a square inside a masked ring, so it runs on
 * the compositor instead of repainting every frame.
 */

/** Behind the glass: the blurred, breathing glow and the ready flash. */
export function HaloGlow(props: {
  mounted: boolean
  on: boolean
  flash: number
}) {
  return (
    <>
      <span className={cn('dw-cglow', props.on && 'dw-on')} aria-hidden='true'>
        {props.mounted && (
          <span className='dw-au-g'>
            <span className='dw-au-gi' />
          </span>
        )}
      </span>
      <span
        key={props.flash}
        className={cn('dw-cflash-g', props.flash > 0 && 'dw-flash')}
        aria-hidden='true'
      />
    </>
  )
}

/** On the glass: the crisp ring and the ready flash. */
export function HaloRing(props: {
  mounted: boolean
  on: boolean
  flash: number
}) {
  return (
    <>
      <span className={cn('dw-cring', props.on && 'dw-on')} aria-hidden='true'>
        {props.mounted && <span className='dw-au-r' />}
      </span>
      <span
        key={props.flash}
        className={cn('dw-cflash', props.flash > 0 && 'dw-flash')}
        aria-hidden='true'
      />
    </>
  )
}
