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
import { useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useSiteBarStore } from '@/components/site-bar/store'
import {
  nextLook,
  ThemeSwitch,
  type ThemeLook,
  type ThemeSwitchState,
} from '@/components/site-bar/theme-switch'
import { useTheme } from '@/context/theme-provider'
import { useNightSeaStore } from '@/stores/night-sea-store'

/**
 * The theme switch in the site bar: click it or drag its knob. Light and
 * dark, then 夜海 once a meteor on the chat page was caught in this browser.
 * The knob and everything that moves with it are in theme-switch.ts; until
 * the first switch the page follows the system.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const nightFound = useNightSeaStore((s) => s.found)
  const nightOn = useNightSeaStore((s) => s.on)
  const setNight = useNightSeaStore((s) => s.setOn)
  const pinned = useSiteBarStore((s) => s.darkPages > 0)

  // resolvedTheme catches up one render after a choice: reading it alone, the
  // switch would see the old theme and take the knob out of the reader's hand
  const chosen = theme === 'system' ? resolvedTheme : theme
  const look: ThemeLook = nightOn && chosen === 'dark' ? 'night' : chosen
  const labels = {
    light: t('Switch to light theme'),
    dark: t('Switch to dark theme'),
    night: t('Switch to night sea'),
  }
  const name = labels[nextLook(look, nightFound)]

  // flushSync: the page has to change in the frame the veil is thickest
  const show = (next: ThemeLook) =>
    flushSync(() => {
      setNight(next === 'night')
      setTheme(next === 'light' ? 'light' : 'dark')
    })

  const state: ThemeSwitchState = { look, pinned, nightFound, labels }
  const latest = useRef({ state, show })
  useLayoutEffect(() => {
    latest.current = { state, show }
  })

  const hostRef = useRef<HTMLButtonElement>(null)
  const switchRef = useRef<ThemeSwitch | null>(null)
  useLayoutEffect(() => {
    if (!hostRef.current) return
    const themeSwitch = new ThemeSwitch(hostRef.current, {
      ...latest.current.state,
      onLook: (next) => latest.current.show(next),
    })
    switchRef.current = themeSwitch
    return () => {
      themeSwitch.dispose()
      switchRef.current = null
    }
  }, [])
  useLayoutEffect(() => {
    switchRef.current?.update(latest.current.state)
  })

  return (
    <button
      ref={hostRef}
      type='button'
      data-bar-skip=''
      aria-label={name}
      title={name}
    />
  )
}
