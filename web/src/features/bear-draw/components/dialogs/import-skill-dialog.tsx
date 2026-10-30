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
import { useNavigate } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, FolderOpen } from 'lucide-react'
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { parseSkillMd } from '../../lib/skill-import'
import type { Skill } from '../../types'

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

type Parsed = { ok: true; skill: Skill } | { ok: false; reason: string }

function tryParse(text: string, fileName?: string): Parsed | null {
  if (!text.trim()) return null
  try {
    return { ok: true, skill: parseSkillMd(text, fileName) }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

function ImportForm(props: { formId: string; onDone: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const putMySkill = useBearDrawStore((s) => s.putMySkill)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | undefined>()
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => tryParse(text, fileName), [text, fileName])

  const take = async (file: File | undefined) => {
    if (!file) return
    if (/\.zip$/i.test(file.name)) {
      toast(t('ZIP files are not supported yet; pick the SKILL.md inside'))
      return
    }
    try {
      setText(await file.text())
      setFileName(file.name)
    } catch {
      toast.error(t('This file could not be read'))
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!parsed) {
      toast(t('Put a SKILL.md in first'))
      return
    }
    if (!parsed.ok) return
    const skill = parsed.skill
    putMySkill(skill)
    toast.success(t('Imported “{{name}}”', { name: skill.name }), {
      action: {
        label: t('Take a look'),
        onClick: () =>
          void navigate({
            to: '/draw',
            search: { view: 'skills', tab: 'mine' },
          }),
      },
    })
    props.onDone()
  }

  return (
    <form id={props.formId} className='bd-imp' onSubmit={submit}>
      <button
        type='button'
        className={cn('bd-imp-drop', over && 'bd-on')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void take(e.dataTransfer.files[0])
        }}
      >
        <FolderOpen aria-hidden='true' />
        <b>{t('Drop a SKILL.md here, or click to pick one')}</b>
        <span>{t('The same skill format as Claude Code and Codex')}</span>
      </button>
      <input
        ref={fileRef}
        type='file'
        accept='.md,.markdown,text/markdown,text/plain'
        hidden
        onChange={(e) => {
          void take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className='bd-imp-or'>{t('Or paste it here')}</div>
      <Textarea
        className='bd-imp-ta'
        rows={8}
        value={text}
        aria-label={t('SKILL.md text')}
        placeholder={t(
          '---\nname: my-poster-skill\ndescription: when to use it\n---\n\n# How to do it\n…'
        )}
        onChange={(e) => {
          setText(e.target.value)
          setFileName(undefined)
        }}
      />
      {parsed?.ok && (
        <div className='bd-imp-prev' role='status'>
          <CircleCheck aria-hidden='true' />
          <div>
            <b>{parsed.skill.name}</b>
            <span>
              {parsed.skill.description ||
                t('No description; the start of the text is used instead')}
            </span>
          </div>
        </div>
      )}
      {parsed && !parsed.ok && (
        <div className='bd-imp-prev bd-bad' role='alert'>
          <CircleAlert aria-hidden='true' />
          <div>
            <b>{t('This does not read as a SKILL.md')}</b>
            {/* parseSkillMd's messages are i18n keys */}
            <span>{t(parsed.reason)}</span>
          </div>
        </div>
      )}
    </form>
  )
}

/** 导入技能: a SKILL.md file or pasted text becomes one of 「我的技能」. */
export function ImportSkillDialog(props: DialogProps) {
  const { t } = useTranslation()
  const formId = useId()
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import a skill')}
      description={t('Imported skills work only on this device.')}
      contentClassName='bd-pop bd-dlg bd-dlg-md'
      titleClassName='bd-dlg-t'
      footer={
        <Button type='submit' form={formId} className='bd-btn-ink'>
          {t('Import to My skills')}
        </Button>
      }
    >
      <ImportForm formId={formId} onDone={() => props.onOpenChange(false)} />
    </Dialog>
  )
}
