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
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  MessageCircleQuestionMark,
} from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { answer } from '../../lib/engine'
import type { AgentStatus, Part, QuestionAnswer } from '../../types'
import { QuestionsSummary } from './questions-summary'

type QuestionsPart = Extract<Part, { type: 'questions' }>

const LETTERS = 'ABCDEFGHIJ'

/** The answers to send: picked options, then the free text, per question. */
function collect(
  part: QuestionsPart,
  picks: string[][],
  others: string[]
): QuestionAnswer[] {
  return part.items.map((it, i) => ({
    q: it.q,
    answer: [...(picks[i] ?? []), (others[i] ?? '').trim()]
      .filter(Boolean)
      .join('、'),
  }))
}

/**
 * The agent's questions before it plans (Lovart's 提问 card): one question
 * per page, options picked by click or by their letter or number, an
 * 「其他」 line for anything else, 跳过 or 提交.
 */
function QuestionsForm(props: { projectId: string; part: QuestionsPart }) {
  const { t } = useTranslation()
  const part = props.part
  const items = part.items
  const [page, setPage] = useState(0)
  const [picks, setPicks] = useState<string[][]>(() => items.map(() => []))
  const [others, setOthers] = useState<string[]>(() => items.map(() => ''))
  const otherRef = useRef<HTMLInputElement>(null)
  const it = items[Math.min(page, items.length - 1)]
  if (!it) return null
  const last = page >= items.length - 1
  const allowOther = it.other !== false
  const chosen = picks[page] ?? []

  const pick = (option: string) => {
    const on = chosen.includes(option)
    let next: string[]
    if (it.multi) {
      next = on ? chosen.filter((x) => x !== option) : [...chosen, option]
    } else {
      next = on ? [] : [option]
    }
    setPicks((all) => all.map((x, i) => (i === page ? next : x)))
    if (!it.multi && !on && !last) setPage(page + 1)
  }

  const submit = () => {
    const answers = collect(part, picks, others)
    answer(
      props.projectId,
      part.id,
      answers.some((a) => a.answer) ? answers : 'skip'
    )
  }
  const next = () => (last ? submit() : setPage(page + 1))

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement || e.altKey || e.metaKey) return
    if (e.ctrlKey || e.key.length !== 1) return
    const key = e.key.toUpperCase()
    let index = LETTERS.indexOf(key)
    if (/\d/.test(key)) index = Number(key) - 1
    if (index < 0) return
    if (index < it.options.length) {
      e.preventDefault()
      pick(it.options[index])
    } else if (index === it.options.length && allowOther) {
      e.preventDefault()
      otherRef.current?.focus()
    }
  }

  return (
    <div
      className='bd-qa'
      role='group'
      aria-label={t('Questions')}
      onKeyDown={onKey}
    >
      <div className='bd-qa-hd'>
        <span className='bd-qa-t'>
          <MessageCircleQuestionMark aria-hidden='true' />
          {t('Questions')}
        </span>
        {items.length > 1 && (
          <span className='bd-qa-pg'>
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              className='bd-qa-pgb'
              aria-label={t('Previous question')}
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft aria-hidden='true' />
            </Button>
            <span className='bd-num'>
              {page + 1} / {items.length}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              className='bd-qa-pgb'
              aria-label={t('Next question')}
              disabled={last}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight aria-hidden='true' />
            </Button>
          </span>
        )}
      </div>
      <div className='bd-qa-q'>
        {it.q}
        {it.multi && <span className='bd-muted'>{t('(pick any)')}</span>}
      </div>
      <div className='bd-qa-opts'>
        {it.options.map((option, i) => {
          const on = chosen.includes(option)
          return (
            <button
              key={option}
              type='button'
              className={cn('bd-qa-o', on && 'is-on')}
              aria-pressed={on}
              onClick={() => pick(option)}
            >
              <span className='bd-qa-k' aria-hidden='true'>
                {LETTERS[i] ?? i + 1}
              </span>
              <span className='bd-qa-ot'>{option}</span>
              {on && <Check className='bd-qa-ck' aria-hidden='true' />}
            </button>
          )
        })}
        {allowOther && (
          <label className='bd-qa-o bd-qa-other'>
            <span className='bd-qa-k' aria-hidden='true'>
              {LETTERS[it.options.length] ?? it.options.length + 1}
            </span>
            <Input
              ref={otherRef}
              className='bd-qa-in'
              value={others[page] ?? ''}
              placeholder={t('Something else, tell me…')}
              aria-label={t('Something else')}
              onChange={(e) => {
                const v = e.target.value
                setOthers((all) => all.map((x, i) => (i === page ? v : x)))
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                e.preventDefault()
                next()
              }}
            />
          </label>
        )}
      </div>
      <div className='bd-qa-ft'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='bd-cb bd-cb-line'
          onClick={() => answer(props.projectId, part.id, 'skip')}
        >
          {t('Skip')}
        </Button>
        <Button
          type='button'
          size='sm'
          className='bd-cb bd-cb-ink'
          onClick={next}
        >
          {last ? t('Submit') : t('Next question')}
          <CornerDownLeft aria-hidden='true' />
        </Button>
      </div>
    </div>
  )
}

export function QuestionsCard(props: {
  projectId: string
  part: QuestionsPart
  /** Status of the agent message the card belongs to. */
  status: AgentStatus
}) {
  const part = props.part
  const open =
    !part.answers &&
    !part.skipped &&
    (props.status === 'waiting' || props.status === 'running')
  return (
    <>
      {part.intro && <p className='bd-qa-intro'>{part.intro}</p>}
      {open ? (
        <QuestionsForm key={part.id} projectId={props.projectId} part={part} />
      ) : (
        <QuestionsSummary part={part} status={props.status} />
      )}
    </>
  )
}
