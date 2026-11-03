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
import { Link, useNavigate } from '@tanstack/react-router'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useTheme } from '@/context/theme-provider'
import { Meteors } from '@/features/bear-chat/components/meteor'
import {
  DAWN_MS,
  spreadSky,
  useSighting,
} from '@/features/bear-chat/lib/meteor-sky'
import { cn } from '@/lib/utils'
import { useNightSeaStore } from '@/stores/night-sea-store'

import type { GalleryItem } from '../../data/gallery'
import { createProject, send, type SendInput } from '../../lib/engine'
import type { Skill } from '../../types'
import { Composer, type ComposerHandle } from '../composer/composer'
import { warmProject } from '../lazy-views'
import { useKept, useSkill } from '../library/use-skills'
import { Hero } from './hero'
import { HomeSky, MiniComposer } from './home-chrome'
import { HomeFeed } from './home-feed'
import {
  pageScroller,
  useHomeDraft,
  useScrolledAway,
  useWarmOnUse,
} from './use-home'

// opened from a skill card: its module (sample carousel…) loads the first time
const SkillDetail = lazy(() =>
  import('../library/skill-detail').then((m) => ({ default: m.SkillDetail }))
)

/** Long enough for the smooth scroll to the top and a dialog to close. */
const FOCUS_AFTER_MS = 350

/** /draw without a project: greeting, composer, 玩法 and skills. */
export function HomeView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  // the night sea is found by wishing on a meteor (bear-chat Meteors)
  const nightOn = useNightSeaStore((s) => s.on)
  const night = dark && nightOn
  const homeRef = useRef<HTMLDivElement>(null)
  const { sighting, hinted, onSighting, onNotice } = useSighting()
  const notice = sighting && dark && !night
  const [dawn, setDawn] = useState(false)
  const wishAt = useRef<{ x: number; y: number } | null>(null)
  const composer = useRef<ComposerHandle>(null)
  const flightsRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = useSkill(detailId)
  const shownDetail = useKept(detail)
  const away = useScrolledAway(slotRef)

  useHomeDraft(composer)
  useWarmOnUse(slotRef)

  useEffect(() => {
    // a keyboard and mouse: start typing right away (no keyboard pop-up on phones)
    if (window.matchMedia?.('(pointer: fine)').matches) {
      composer.current?.focus()
    }
  }, [])

  // up to the composer; focus once the scroll (or a closing dialog) is done
  const toComposer = useCallback(() => {
    const slot = slotRef.current
    if (slot) pageScroller(slot)?.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => composer.current?.focus(), FOCUS_AFTER_MS)
  }, [])

  const onSend = useCallback(
    (input: SendInput) => {
      const project = createProject()
      send(project.id, input)
      void navigate({ to: '/draw', search: { p: project.id } })
    },
    [navigate]
  )

  const applyPreset = useCallback(
    (item: GalleryItem) => {
      warmProject()
      composer.current?.applyPreset(item)
      toComposer()
    },
    [toComposer]
  )

  const pickSkill = useCallback((skill: Skill, text: string) => {
    warmProject()
    composer.current?.setSkill(skill.id)
    if (text) composer.current?.setText(text)
    composer.current?.focus()
  }, [])

  const addSkill = useCallback(
    (skill: Skill) => {
      composer.current?.setSkill(skill.id)
      toComposer()
      toast(
        t('Added “{{name}}”; now tell the bear about your product', {
          name: skill.name,
        })
      )
    },
    [t, toComposer]
  )

  const trySkill = useCallback(
    (skill: Skill, text: string) => {
      setDetailId(null)
      composer.current?.setSkill(skill.id)
      if (text) composer.current?.setText(text)
      toComposer()
    },
    [toComposer]
  )

  const openSkill = useCallback((skill: Skill) => setDetailId(skill.id), [])

  // meteors stay above the composer while it is in view
  const meteorFloor = useCallback(() => {
    const flights = flightsRef.current
    const slot = slotRef.current
    if (!flights || !slot) return null
    const top =
      slot.getBoundingClientRect().top - flights.getBoundingClientRect().top
    return top > 140 ? top - 28 : null
  }, [])

  // a wish on a meteor: the night sky spreads from where it was caught
  const onWish = useCallback(
    (x: number, y: number) => {
      const first = !useNightSeaStore.getState().found
      wishAt.current = { x, y }
      setDawn(true)
      setTheme('dark')
      useNightSeaStore.getState().setOn(true)
      window.setTimeout(() => setDawn(false), DAWN_MS)
      if (first) {
        window.setTimeout(
          () =>
            toast(
              t(
                'You found the night sea. Use the theme button at the top right to switch to it.'
              )
            ),
          DAWN_MS
        )
      }
    },
    [setTheme, t]
  )
  useLayoutEffect(() => {
    const home = homeRef.current
    const at = wishAt.current
    if (!night || !at || !home) return
    wishAt.current = null
    const sky = home.querySelector<HTMLElement>('.bd-home-sky')
    if (sky) spreadSky(sky, sky, at)
  }, [night])

  return (
    <div
      ref={homeRef}
      className={cn('bd-home', night && 'bd-night', dawn && 'bd-dawn')}
    >
      {night && <HomeSky />}
      {dark && (
        <div ref={flightsRef} className='bd-home-layer bd-home-flights'>
          <Meteors
            active={!night}
            floor={meteorFloor}
            onSighting={onSighting}
            onWish={onWish}
          />
        </div>
      )}
      <div className='bd-home-page'>
        <Hero
          composer={
            <div ref={slotRef} className='bd-hero-comp'>
              <Composer
                variant='home'
                ref={composer}
                onSend={onSend}
                notice={notice}
                hint={notice && hinted}
                onNotice={onNotice}
              />
            </div>
          }
          onPick={pickSkill}
        />
        <HomeFeed
          onUse={applyPreset}
          onOpenSkill={openSkill}
          onAddSkill={addSkill}
        />
        <footer className='bd-home-foot'>
          <Link to='/draw/classic' className='bd-home-classic'>
            {t('Back to the old drawing page')}
          </Link>
        </footer>
      </div>
      <div className='bd-mini-slot'>
        <MiniComposer on={away} onClick={toComposer} />
      </div>
      {shownDetail && (
        <Suspense fallback={null}>
          <SkillDetail
            skill={shownDetail}
            open={detail != null}
            onOpenChange={(open) => {
              if (!open) setDetailId(null)
            }}
            onTry={trySkill}
          />
        </Suspense>
      )}
    </div>
  )
}
