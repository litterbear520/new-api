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
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { SKILL_CATEGORIES, SKILLS } from '../../data/skills'
import type { Skill } from '../../types'
import { SkillCard } from '../library/skill-card'
import { FloatingStrip } from './floating-strip'

type FeedProps = {
  onOpen: (skill: Skill) => void
  onAdd: (skill: Skill) => void
}

function Grid(props: FeedProps & { skills: readonly Skill[] }) {
  const favorites = useBearDrawStore((s) => s.favorites)
  return (
    <div className='bd-grid'>
      {props.skills.map((s) => (
        <SkillCard
          key={s.id}
          skill={s}
          favorite={favorites.includes(s.id)}
          onOpen={props.onOpen}
          onAdd={props.onAdd}
        />
      ))}
    </div>
  )
}

/** 为你推荐: a first row of skills, then a floor per category. */
function ForYou(props: FeedProps & { onCategory: (id: string) => void }) {
  return (
    <>
      <Grid
        skills={SKILLS.slice(0, 8)}
        onOpen={props.onOpen}
        onAdd={props.onAdd}
      />
      {SKILL_CATEGORIES.map((c) => {
        const list = SKILLS.filter((s) => s.category === c.id).slice(0, 4)
        if (!list.length) return null
        return (
          <div key={c.id} className='bd-floor'>
            <button
              type='button'
              className='bd-floor-t'
              onClick={() => props.onCategory(c.id)}
            >
              {c.name}
              <ChevronRight aria-hidden='true' />
            </button>
            <Grid skills={list} onOpen={props.onOpen} onAdd={props.onAdd} />
          </div>
        )
      })}
    </>
  )
}

/** The 技能 tab of the home feed: category tabs, cards open the skill. */
export function SkillsPanel(props: FeedProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('all')

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(String(v))}
      className='bd-tabs-root'
    >
      <FloatingStrip className='bd-cats-slot'>
        <TabsList
          variant='line'
          className='bd-tabs bd-cats'
          aria-label={t('Skill categories')}
        >
          <TabsTrigger value='all' className='bd-tab'>
            {t('For you')}
          </TabsTrigger>
          {SKILL_CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className='bd-tab'>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </FloatingStrip>
      <TabsContent value={tab} className='bd-tabpanel'>
        {tab === 'all' ? (
          <ForYou
            onOpen={props.onOpen}
            onAdd={props.onAdd}
            onCategory={setTab}
          />
        ) : (
          <Grid
            skills={SKILLS.filter((s) => s.category === tab)}
            onOpen={props.onOpen}
            onAdd={props.onAdd}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
