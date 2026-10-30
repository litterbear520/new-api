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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

/**
 * A row of toggle buttons where one is pressed (spend/tokens, 7/30 days).
 * The shared ToggleGroup gives the group role and arrow-key focus; `.bo-seg`
 * in bear-overview.css draws the pill. The item classes put back what the
 * old ghost Button had and the toggle lacks: a 1px clear border with the
 * background clipped inside it, no text selection and the press nudge.
 */
export function Segmented<T extends string>(props: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <ToggleGroup
      aria-label={props.label}
      value={[props.value]}
      onValueChange={(values: unknown[]) => {
        // Clicking the pressed option would clear the group; keep one pressed.
        const next = props.options.find(
          (option) =>
            option.value !== props.value && values.includes(option.value)
        )
        if (next) props.onChange(next.value)
      }}
      className={cn('bo-seg', props.className)}
    >
      {props.options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          // no toggle size: .bo-seg sets the height, padding and type
          size={null}
          className='border border-transparent bg-clip-padding select-none active:translate-y-px'
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
