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
import { FileUp, Pencil, Plus, Search, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { SKILL_CATEGORIES } from '../../data/skills'
import { openDialog } from '../dialogs/dialog-bus'
import { categoryIcon } from './skill-display'
import type { LibraryTab } from './skill-filter'

type CategoryPillsProps = { value: string; onChange: (value: string) => void }

/** 全部 / 电商 / 品牌…: narrows the explore tab to one category. */
export function CategoryPills(props: CategoryPillsProps) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      value={[props.value]}
      onValueChange={(value: unknown[]) => {
        const next = value.find((v) => v !== props.value)
        if (typeof next === 'string') props.onChange(next)
      }}
      aria-label={t('Skill categories')}
      className='bd-cats'
      spacing={2}
    >
      <ToggleGroupItem value='all' className='bd-cat'>
        {t('All')}
      </ToggleGroupItem>
      {SKILL_CATEGORIES.map((c) => {
        const Icon = categoryIcon(c.id)
        return (
          <ToggleGroupItem key={c.id} value={c.id} className='bd-cat'>
            <Icon aria-hidden='true' />
            {c.name}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

/** Nothing to show: no own skills yet, no favourites, or no search hits. */
export function LibraryEmpty(props: { tab: LibraryTab; searching: boolean }) {
  const { t } = useTranslation()
  if (props.searching || props.tab === 'explore') {
    return (
      <EmptyState
        className='bd-empty'
        icon={Search}
        title={t('Nothing found')}
        description={t('Try another word.')}
      />
    )
  }
  if (props.tab === 'mine') {
    return (
      <EmptyState
        className='bd-empty'
        icon={Pencil}
        title={t('You have no skills of your own yet')}
        description={t('Import a SKILL.md, or write one yourself.')}
        action={
          <div className='bd-empty-a'>
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
        }
      />
    )
  }
  return (
    <EmptyState
      className='bd-empty'
      icon={Star}
      title={t('No favourites yet')}
      description={t('Open a skill and press the star to keep it here.')}
    />
  )
}
