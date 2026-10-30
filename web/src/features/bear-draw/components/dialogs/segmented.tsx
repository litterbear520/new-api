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

export type SegmentedOption = { value: string; label: string }

type SegmentedProps = {
  value: string
  options: readonly SegmentedOption[]
  onChange: (value: string) => void
  'aria-label': string
  className?: string
}

/** One choice out of a few, as a pill strip (the prototype's lv-seg). */
export function Segmented(props: SegmentedProps) {
  return (
    <ToggleGroup
      value={[props.value]}
      onValueChange={(value: unknown[]) => {
        const next = value.find((v) => v !== props.value)
        if (typeof next === 'string') props.onChange(next)
      }}
      aria-label={props['aria-label']}
      className={cn('bd-seg', props.className)}
    >
      {props.options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} size='sm'>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
