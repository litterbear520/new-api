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
import { FileCode, Star, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import type { Skill } from '../../types'
import { stripSkillPrefix } from '../home/home-text'
import { SkillColumns, SkillCovers } from './skill-detail-body'
import { SkillSourceDialog } from './skill-source'

type SkillDetailProps = {
  /** Kept after closing, so the dialog fades out with its content. */
  skill: Skill | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 试用此技能, or one of its starter lines (without the skill prefix). */
  onTry: (skill: Skill, text: string) => void
}

function Header(props: {
  skill: Skill
  onSource: () => void
  onDelete: () => void
  onTry: () => void
}) {
  const { t } = useTranslation()
  const logo = useSystemConfigStore((s) => s.config.logo)
  const fav = useBearDrawStore((st) => st.favorites.includes(props.skill.id))
  const toggleFavorite = useBearDrawStore((st) => st.toggleFavorite)
  const s = props.skill
  const src = s.sources[0]

  const onFav = () => {
    toggleFavorite(s.id)
    toast(fav ? t('Removed from favourites') : t('Added to favourites'))
  }

  return (
    <div className='bd-sd-hd'>
      <div className='bd-sd-info'>
        <DialogTitle className='bd-sd-title'>{s.name}</DialogTitle>
        <DialogDescription className='bd-sd-desc'>
          {s.description || s.tagline}
        </DialogDescription>
        <div className='bd-sd-meta'>
          {s.mine ? (
            <span>{s.author || t('My skill')}</span>
          ) : (
            <>
              <img src={logo} alt='' />
              <span>{t('{{author}} official', { author: s.author })}</span>
            </>
          )}
          {src && (
            <span>
              {'· '}
              {t('Adapted from')} <b>{src.repo}</b> ({src.license})
            </span>
          )}
          {s.platforms.length > 0 && <span>· {s.platforms.join(' / ')}</span>}
        </div>
      </div>
      <div className='bd-sd-act'>
        <Button type='button' variant='outline' onClick={props.onSource}>
          <FileCode aria-hidden='true' />
          {t('View the source')}
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='bd-sd-fav'
          aria-pressed={fav}
          aria-label={t('Favourite')}
          onClick={onFav}
        >
          <Star aria-hidden='true' />
        </Button>
        {s.mine && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label={t('Delete this skill')}
            onClick={props.onDelete}
          >
            <Trash2 aria-hidden='true' />
          </Button>
        )}
        <Button type='button' className='bd-btn-ink' onClick={props.onTry}>
          {t('Try this skill')}
        </Button>
        <DialogClose
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label={t('Close')}
            />
          }
        >
          <X aria-hidden='true' />
        </DialogClose>
      </div>
    </div>
  )
}

function Body(props: {
  skill: Skill
  onTry: (skill: Skill, text: string) => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const removeMySkill = useBearDrawStore((s) => s.removeMySkill)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const s = props.skill

  return (
    <div className='bd-sd'>
      <Header
        skill={s}
        onSource={() => setSourceOpen(true)}
        onDelete={() => setConfirm(true)}
        onTry={() => props.onTry(s, '')}
      />
      <SkillCovers skill={s} />
      <SkillColumns
        skill={s}
        onStarter={(text) => props.onTry(s, stripSkillPrefix(text))}
      />
      <SkillSourceDialog
        skill={s}
        open={sourceOpen}
        onOpenChange={setSourceOpen}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('Delete “{{name}}”?', { name: s.name })}
        desc={t('It is removed from this device. This cannot be undone.')}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          removeMySkill(s.id)
          setConfirm(false)
          toast(t('Deleted “{{name}}”', { name: s.name }))
          props.onDeleted()
        }}
      />
    </div>
  )
}

/** A skill in full: samples, deliverables, questions, starter lines. */
export function SkillDetail(props: SkillDetailProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className='bd-pop bd-dlg bd-dlg-xl bd-dlg-skill'
        showCloseButton={false}
      >
        {props.skill && (
          <Body
            skill={props.skill}
            onTry={props.onTry}
            onDeleted={() => props.onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
