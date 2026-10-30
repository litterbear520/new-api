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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'
import { useNightSeaStore } from '@/stores/night-sea-store'

// The sun and moon are traced from Claude's web theme toggle
// (academy.claude.com) on a 20-unit grid.
function SunIcon(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 20 20'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.27}
      strokeLinecap='round'
      aria-hidden='true'
      className={props.className ?? 'size-5'}
    >
      <circle cx='10' cy='10' r='3.5' />
      <path d='M10 2.64v1.09M10 16.27v1.09M2.64 10h1.09M16.27 10h1.09M4.8 4.8l.77.77M14.43 14.43l.77.77M4.8 15.2l.77-.77M14.43 5.57l.77-.77' />
    </svg>
  )
}

function MoonIcon(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 20 20'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.27}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className={props.className ?? 'size-5'}
    >
      <path d='M9 3.69A6.65 6.65 0 1 0 15.73 13.11A6.5 6.5 0 0 1 9 3.69Z' />
    </svg>
  )
}

// A four-point star for 夜海, drawn on the same grid.
function StarIcon(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 20 20'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.27}
      strokeLinejoin='round'
      aria-hidden='true'
      className={props.className ?? 'size-5'}
    >
      <path d='M10 2.64Q10.86 9.14 17.36 10Q10.86 10.86 10 17.36Q9.14 10.86 2.64 10Q9.14 9.14 10 2.64Z' />
    </svg>
  )
}

type ThemeLook = 'light' | 'dark' | 'night'

const ICONS = { light: SunIcon, dark: MoonIcon, night: StarIcon } as const

function nextLook(current: ThemeLook, nightFound: boolean): ThemeLook {
  if (current === 'light') return 'dark'
  if (current === 'dark' && nightFound) return 'night'
  return 'light'
}

/**
 * One-click theme switch: light and dark, then 夜海 once a meteor on the chat
 * page was caught in this browser. The icon shows the theme a click switches
 * to, as on Claude's site. Until the first click the page follows the system.
 */
export function ThemeToggle(props: { className?: string }) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const nightFound = useNightSeaStore((s) => s.found)
  const nightOn = useNightSeaStore((s) => s.on)
  const setNight = useNightSeaStore((s) => s.setOn)

  const current: ThemeLook =
    nightOn && resolvedTheme === 'dark' ? 'night' : resolvedTheme
  const next = nextLook(current, nightFound)
  const labels = {
    light: t('Switch to light theme'),
    dark: t('Switch to dark theme'),
    night: t('Switch to night sea'),
  }
  const Icon = ICONS[next]

  return (
    <Button
      variant='ghost'
      size='icon'
      aria-label={labels[next]}
      title={labels[next]}
      onClick={() => {
        if (next === 'night') {
          setTheme('dark')
          setNight(true)
        } else {
          setNight(false)
          setTheme(next)
        }
      }}
      className={cn('rounded-[8px] active:scale-95', props.className)}
    >
      <span
        key={next}
        className='animate-in fade-in spin-in-45 zoom-in-75 flex duration-300 motion-reduce:animate-none'
      >
        <Icon />
      </span>
    </Button>
  )
}
