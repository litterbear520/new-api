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
  CircleUser,
  Package,
  RectangleVertical,
  Smartphone,
  Sticker,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { coverOf, roomItems, useDrawStore } from '@/stores/draw-store'

import {
  DRAW_GUIDE_URL,
  getIdeas,
  getRatioOptions,
  type DrawIdea,
} from '../constants'
import { useImageUrl } from '../hooks/use-image-url'
import type { DrawRoom } from '../types'
import { Bear, PokeBear } from './bear'
import { Composer } from './composer'
import { useDrawPage } from './draw-context'
import { useRelativeTime } from './relative-time'
import { Tip } from './tip'

const IDEA_ICONS = {
  avatar: CircleUser,
  phone: Smartphone,
  sticker: Sticker,
  poster: RectangleVertical,
  product: Package,
} as const

function greeting(t: (key: string) => string) {
  const h = new Date().getHours()
  if (h < 5) return t('It’s late')
  if (h < 11) return t('Good morning')
  if (h < 13) return t('Good noon')
  if (h < 18) return t('Good afternoon')
  return t('Good evening')
}

function RecentCard(props: { room: DrawRoom }) {
  const { t } = useTranslation()
  const ago = useRelativeTime()
  const setCur = useDrawStore((s) => s.setCur)
  const cover = coverOf(props.room)
  const url = useImageUrl(cover?.id, 'thumb')
  const items = roomItems(props.room)
  const count = items.filter((it) => it.img).length
  const drawing = items.some((it) => it.status === 'pending')
  return (
    <button
      type='button'
      className='dw-rc'
      onClick={() => setCur(props.room.id)}
    >
      <span className='dw-cv'>
        {url && <img src={url} alt='' loading='lazy' decoding='async' />}
        {count > 1 && (
          <span className='dw-n'>{t('{{count}} pictures', { count })}</span>
        )}
      </span>
      <b>{props.room.title}</b>
      <small>
        {drawing ? (
          <>
            <Bear mode='hop' className='dw-kb-mini' />
            {t('Drawing…')}
          </>
        ) : (
          ago(props.room.t)
        )}
      </small>
    </button>
  )
}

/** The new-conversation page: greeting, the composer, ideas and recent conversations. */
export function StartPage(props: { room: DrawRoom }) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const user = useAuthStore((s) => s.auth.user)
  const rooms = useDrawStore((s) => s.rooms)
  const ideaId = useDrawStore((s) => s.idea)
  const setIdea = useDrawStore((s) => s.setIdea)
  const setDraft = useDrawStore((s) => s.setDraft)
  const ideas = getIdeas(t)
  const ratios = getRatioOptions(t)
  const open = ideas.find((c) => c.id === ideaId)
  const recent = [...rooms].sort((a, b) => b.t - a.t)
  const name = user?.display_name || user?.username || ''

  const pick = (idea: DrawIdea) => {
    setDraft({ text: idea.text, ratio: idea.ratio, clear: Boolean(idea.clear) })
    setIdea(null)
    ctx.focusComposer()
  }

  return (
    <div className='dw-startp'>
      <div className='dw-st'>
        <div className='dw-hello'>
          <PokeBear label={t('Little bear')} />
          <h1>
            {name
              ? t('{{greeting}}, {{name}}', { greeting: greeting(t), name })
              : greeting(t)}
          </h1>
        </div>
        <p className='dw-sub'>
          {t('Say one sentence to draw; keep changing it until you like it.')}{' '}
          <a
            className='dw-guide'
            href={DRAW_GUIDE_URL}
            target='_blank'
            rel='noreferrer'
          >
            {t('Usage guide')}
          </a>
        </p>
        <div className='dw-slot'>
          <Composer room={props.room} />
        </div>
        <div className='dw-chips' role='group' aria-label={t('Ideas')}>
          {ideas.map((c) => {
            const Icon = IDEA_ICONS[c.id as keyof typeof IDEA_ICONS]
            return (
              <button
                key={c.id}
                type='button'
                className='dw-chip'
                aria-expanded={ideaId === c.id}
                onClick={() => setIdea(ideaId === c.id ? null : c.id)}
              >
                <Icon aria-hidden='true' />
                {c.label}
              </button>
            )
          })}
        </div>
        {open && (
          <div className='dw-ideas'>
            <div className='dw-ideas-hd'>
              {(() => {
                const Icon = IDEA_ICONS[open.id as keyof typeof IDEA_ICONS]
                return <Icon aria-hidden='true' />
              })()}
              {open.label}
              <Tip label={t('Close')}>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className='ml-auto'
                  aria-label={t('Close')}
                  onClick={() => setIdea(null)}
                >
                  <X />
                </Button>
              </Tip>
            </div>
            {open.items.map((idea) => (
              <button
                key={idea.text}
                type='button'
                className='dw-idea'
                onClick={() => pick(idea)}
              >
                <span>{idea.text}</span>
                <small>
                  {idea.clear
                    ? t('Transparent background')
                    : ratios.find((r) => r.id === idea.ratio)?.name}
                </small>
              </button>
            ))}
          </div>
        )}
        {recent.length > 0 && (
          <section className='dw-recent'>
            <div className='dw-rh'>
              <h2>{t('Recent conversations')}</h2>
              <span>{t('Kept only in this browser on this device')}</span>
            </div>
            <div className='dw-grid'>
              {recent.map((r) => (
                <RecentCard key={r.id} room={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
