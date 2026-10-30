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
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { Link } from '@tanstack/react-router'
import { BookOpen, ChevronRight, FileUp, Pencil, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { GalleryItem } from '../../data/gallery'
import type { Skill } from '../../types'
import { openDialog } from '../dialogs/dialog-bus'
import { GalleryPanel } from '../gallery/gallery-section'
import { SkillsPanel } from './skills-feed'

export type FeedTab = 'ideas' | 'skills'

/** The tab last shown; kept while the page is open, so a project and back keeps it. */
let lastTab: FeedTab = 'ideas'

type HomeFeedProps = {
  /** The page's scroll box: a switch made down in the wall starts the other tab at its top. */
  scrollRef: RefObject<HTMLDivElement | null>
  onUse: (item: GalleryItem) => void
  onOpenSkill: (skill: Skill) => void
  onAddSkill: (skill: Skill) => void
}

/** True while the mark (just above the tab bar) has scrolled past the top of the root. */
function useStuck(
  root: RefObject<HTMLElement | null>,
  mark: RefObject<HTMLElement | null>
): boolean {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const r = root.current
    const el = mark.current
    if (!r || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        setStuck(
          !e.isIntersecting &&
            e.boundingClientRect.top < (e.rootBounds?.top ?? 0)
        )
      },
      { root: r, threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [root, mark])
  return stuck
}

/** 创意 | 技能 under the hero; the tab bar stays on top while the wall scrolls. */
export function HomeFeed(props: HomeFeedProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<FeedTab>(lastTab)
  const ref = useRef<HTMLElement>(null)
  const mark = useRef<HTMLDivElement>(null)
  const scrollRef = props.scrollRef
  // the bars get their background only once they are stuck over the wall
  const stuck = useStuck(scrollRef, mark)

  const pick = useCallback(
    (next: FeedTab) => {
      lastTab = next
      setTab(next)
      const box = scrollRef.current
      const feed = ref.current
      if (!box || !feed) return
      const top =
        feed.getBoundingClientRect().top - box.getBoundingClientRect().top
      // switched from down in the wall: the other tab starts at its top
      if (top < 0) {
        box.scrollTo({ top: box.scrollTop + top, behavior: 'instant' })
      }
    },
    [scrollRef]
  )

  return (
    <section ref={ref} className={cn('bd-sec bd-feed', stuck && 'is-stuck')}>
      <div ref={mark} aria-hidden='true' />
      <Tabs
        value={tab}
        onValueChange={(v) => pick(v === 'skills' ? 'skills' : 'ideas')}
        className='bd-tabs-root'
      >
        <div className='bd-feed-bar'>
          <TabsList className='bd-feed-tabs' aria-label={t('Ideas and skills')}>
            <TabsPrimitive.Indicator className='bd-feed-ind' />
            <TabsTrigger value='ideas' className='bd-feed-tab'>
              <Sparkles aria-hidden='true' />
              {t('Ideas')}
            </TabsTrigger>
            <TabsTrigger value='skills' className='bd-feed-tab'>
              <BookOpen aria-hidden='true' />
              {t('Skills')}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value='ideas' className='bd-tabpanel'>
          <GalleryPanel onUse={props.onUse} />
        </TabsContent>
        <TabsContent value='skills' className='bd-tabpanel'>
          <div className='bd-feed-acts'>
            <Link
              to='/draw'
              search={{ view: 'skills', tab: 'mine' }}
              className='bd-feed-act'
            >
              <Pencil aria-hidden='true' />
              {t('My skills')}
            </Link>
            <button
              type='button'
              className='bd-feed-act'
              onClick={() => openDialog('import-skill')}
            >
              <FileUp aria-hidden='true' />
              {t('Import')}
            </button>
            <Link
              to='/draw'
              search={{ view: 'skills' }}
              className='bd-link bd-feed-all'
            >
              {t('All skills')}
              <ChevronRight aria-hidden='true' />
            </Link>
          </div>
          <SkillsPanel onOpen={props.onOpenSkill} onAdd={props.onAddSkill} />
        </TabsContent>
      </Tabs>
    </section>
  )
}
