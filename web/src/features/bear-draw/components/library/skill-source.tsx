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
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber } from '@/lib/format'

import { loadSkillText, parseFrontmatter } from '../../lib/skill-text'
import type { Skill } from '../../types'
import { NewSkillDialog } from '../dialogs/new-skill-dialog'
import { Segmented } from '../dialogs/segmented'

const Markdown = lazy(() =>
  import('@/components/ui/markdown').then((m) => ({ default: m.Markdown }))
)

function Sources(props: { skill: Skill }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  if (!props.skill.sources.length) return null
  return (
    <div className='bd-src-from'>
      <b>{t('Sources')}</b>
      {props.skill.sources.map((x) => (
        <div key={`${x.repo}:${x.path}`}>
          <span className='bd-tag'>{x.license}</span>{' '}
          <a href={x.url} target='_blank' rel='noreferrer'>
            {x.repo}
          </a>
          {' · '}
          <code>{x.path}</code>
          {x.stars ? (
            <span className='bd-muted'>
              {' · '}
              {formatCompactNumber(x.stars, locale)}★
            </span>
          ) : null}
          {x.used ? <div className='bd-muted bd-src-used'>{x.used}</div> : null}
        </div>
      ))}
    </div>
  )
}

type SkillSourceProps = {
  skill: Skill
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 查看原文: the SKILL.md as a page or as source, with its sources and licences. */
export function SkillSourceDialog(props: SkillSourceProps) {
  const { t } = useTranslation()
  const s = props.skill
  const [view, setView] = useState('page')
  const [saveOpen, setSaveOpen] = useState(false)
  const query = useQuery({
    queryKey: ['bear-draw', 'skill-text', s.id],
    queryFn: () => loadSkillText(s.id),
    enabled: props.open && !s.text,
    staleTime: Infinity,
  })
  const text = s.text ?? query.data ?? null

  let content: ReactNode
  if (!text && !s.text && query.isPending) {
    content = <LoadingState className='bd-src-wait' />
  } else if (!text) {
    content = <p className='bd-muted'>{t('This skill has no text yet.')}</p>
  } else if (view === 'source') {
    content = <pre className='bd-src-raw'>{text}</pre>
  } else {
    content = (
      <Suspense fallback={<LoadingState className='bd-src-wait' />}>
        <Markdown className='bd-src-md'>{parseFrontmatter(text).body}</Markdown>
      </Suspense>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('{{name}} · source', { name: s.name })}
      description={t(
        'SKILL.md, the same format as Claude Code and Codex skills: you can take it and use it.'
      )}
      contentClassName='bd-pop bd-dlg bd-dlg-lg'
      titleClassName='bd-dlg-t'
      footer={
        <>
          <CopyButton
            value={text ?? ''}
            variant='outline'
            size='default'
            aria-label={t('Copy the text')}
          >
            {t('Copy the text')}
          </CopyButton>
          <Button
            type='button'
            className='bd-btn-ink'
            disabled={!text}
            onClick={() => setSaveOpen(true)}
          >
            <Pencil aria-hidden='true' />
            {t('Save as my own skill')}
          </Button>
        </>
      }
    >
      <Sources skill={s} />
      <Segmented
        value={view}
        options={[
          { value: 'page', label: t('Formatted') },
          { value: 'source', label: t('Source text') },
        ]}
        onChange={setView}
        aria-label={t('How to show the text')}
        className='bd-src-seg'
      />
      <div className='bd-src'>{content}</div>
      <NewSkillDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        seed={{
          name: t('{{name}} (my version)', { name: s.name }),
          description: s.tagline,
          text: text ?? '',
        }}
      />
    </Dialog>
  )
}
