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
import { ChevronLeft, FileUp, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { SKILL_CATEGORIES } from '../../data/skills'
import type { Skill } from '../../types'
import { openDialog } from '../dialogs/dialog-bus'
import { CategoryPills, LibraryEmpty } from './library-parts'
import { SkillCard } from './skill-card'
import { SkillDetail } from './skill-detail'
import { filterSkills, libraryCategory, libraryTab } from './skill-filter'
import { useAllSkills, useKept, useSkill } from './use-skills'

const CATEGORY_IDS = SKILL_CATEGORIES.map((c) => c.id)

/** The skills page: built-in skills, favourites and the user's own. */
export function LibraryView(props: { tab?: string; skillId?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const all = useAllSkills()
  const favorites = useBearDrawStore((s) => s.favorites)
  const setDraft = useBearDrawStore((s) => s.setDraft)
  const removeMySkill = useBearDrawStore((s) => s.removeMySkill)
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<Skill | null>(null)
  const tab = libraryTab(props.tab)
  const category = libraryCategory(props.tab, CATEGORY_IDS)
  const list = useMemo(
    () => filterSkills(all, { tab, category, query, favorites }),
    [all, tab, category, query, favorites]
  )
  const skill = useSkill(props.skillId)
  const shown = useKept(skill)
  const tabParam = props.tab

  const showTab = (next: string | undefined) =>
    void navigate({
      to: '/draw',
      search: { view: 'skills', tab: next },
      replace: true,
    })
  const open = useCallback(
    (s: Skill) =>
      void navigate({
        to: '/draw',
        search: { view: 'skills', tab: tabParam, skill: s.id },
      }),
    [navigate, tabParam]
  )
  const tryIt = useCallback(
    (s: Skill, text = '') => {
      setDraft({ text, mode: 'agent', refs: [], skillId: s.id })
      void navigate({ to: '/draw', search: {} })
    },
    [navigate, setDraft]
  )

  return (
    <div className='bd-lib'>
      <div className='bd-lib-in'>
        <header className='bd-lib-hd'>
          <div>
            <Link to='/draw' search={{}} className='bd-back'>
              <ChevronLeft aria-hidden='true' />
              {t('Draw pictures')}
            </Link>
            <h1>{t('Skills')}</h1>
            <p className='bd-muted'>
              {t(
                'A skill is a written way of working: what to ask you, which pictures to make, how to write each prompt. You can read every one, and import your own.'
              )}
            </p>
          </div>
          <div className='bd-lib-act'>
            <Button
              type='button'
              variant='outline'
              onClick={() => openDialog('import-skill')}
            >
              <FileUp aria-hidden='true' />
              {t('Import a skill')}
            </Button>
            <Button
              type='button'
              className='bd-btn-ink'
              onClick={() => openDialog('new-skill')}
            >
              <Plus aria-hidden='true' />
              {t('New skill')}
            </Button>
          </div>
        </header>
        <Tabs
          value={tab}
          onValueChange={(v) =>
            showTab(v === 'explore' ? undefined : String(v))
          }
          className='bd-lib-tabsroot'
        >
          <div className='bd-lib-bar'>
            <TabsList variant='line' className='bd-tabs bd-lib-tabs'>
              <TabsTrigger value='explore' className='bd-tab'>
                {t('Explore')}
              </TabsTrigger>
              <TabsTrigger value='fav' className='bd-tab'>
                {t('Favourites')}
              </TabsTrigger>
              <TabsTrigger value='mine' className='bd-tab'>
                {t('Mine')}
              </TabsTrigger>
            </TabsList>
            <Input
              type='search'
              className='bd-lib-q'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search skills, platforms…')}
              aria-label={t('Search skills')}
            />
          </div>
          <TabsContent value={tab} className='bd-tabpanel'>
            {tab === 'explore' && (
              <CategoryPills
                value={category}
                onChange={(c) => showTab(c === 'all' ? undefined : c)}
              />
            )}
            {list.length ? (
              <div className='bd-grid'>
                {list.map((s) => (
                  <SkillCard
                    key={s.id}
                    skill={s}
                    favorite={favorites.includes(s.id)}
                    onOpen={open}
                    onAdd={tryIt}
                    onDelete={tab === 'mine' ? setToDelete : undefined}
                  />
                ))}
              </div>
            ) : (
              <LibraryEmpty tab={tab} searching={query.trim() !== ''} />
            )}
          </TabsContent>
        </Tabs>
        <footer className='bd-lib-foot'>
          {t(
            'Skill texts are adapted from public methods in open-source projects by OpenAI, Anthropic and others, used under their licences.'
          )}
          <button
            type='button'
            className='bd-link'
            onClick={() => openDialog('credits')}
          >
            {t('See sources and licences')}
          </button>
        </footer>
      </div>
      <SkillDetail
        skill={shown}
        open={skill != null}
        onOpenChange={(o) => {
          if (!o) {
            void navigate({
              to: '/draw',
              search: { view: 'skills', tab: tabParam },
              replace: true,
            })
          }
        }}
        onTry={tryIt}
      />
      <ConfirmDialog
        open={toDelete != null}
        onOpenChange={(o) => {
          if (!o) setToDelete(null)
        }}
        title={t('Delete “{{name}}”?', { name: toDelete?.name ?? '' })}
        desc={t('It is removed from this device. This cannot be undone.')}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          if (toDelete) {
            removeMySkill(toDelete.id)
            toast(t('Deleted “{{name}}”', { name: toDelete.name }))
          }
          setToDelete(null)
        }}
      />
    </div>
  )
}
