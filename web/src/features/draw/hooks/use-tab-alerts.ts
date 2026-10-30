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
import { t } from 'i18next'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useDrawDotStore } from '@/stores/draw-dot-store'
import { pendingItems, useDrawStore } from '@/stores/draw-store'

import { selectItem } from '../lib/actions'
import {
  chime,
  createTabIcon,
  ensureAudio,
  readAlertPrefs,
  showNotification,
  type TabBadge,
} from '../lib/alerts'
import { onDrawFinished } from '../lib/generate'
import { formatClock } from '../lib/reveal'

/*
 * Pictures keep drawing after the user leaves the page (see lib/generate.ts),
 * so once the page has opened these alerts run for the rest of the visit, on
 * every console page: the tab shows a ring and the elapsed time while
 * drawing, and a dot plus "画好了" when a picture finished in the background.
 * A toast tells about pictures that finish in another conversation or while
 * the user is on another page, where the sidebar's 画图 item also gets a red
 * dot. Closing the tab while drawing asks first.
 */

let openDrawPage = () => {}
let started = false

/** Used by the draw page: starts the alerts and keeps the sidebar dot off. */
export function useTabAlerts() {
  const navigate = useNavigate()

  useEffect(() => {
    openDrawPage = () => void navigate({ to: '/draw' })
    startTabAlerts()
    useDrawDotStore.getState().pageOpened()
    return () => useDrawDotStore.getState().pageClosed()
  }, [navigate])
}

/** Shows the picture in its conversation, opening the draw page if needed. */
function showPicture(roomId: string | undefined, itemId: string) {
  if (roomId) useDrawStore.getState().setCur(roomId)
  selectItem(itemId)
  if (!useDrawDotStore.getState().open) openDrawPage()
}

function startTabAlerts() {
  if (started) return
  started = true
  const icon = createTabIcon()
  const away = { done: 0, err: 0 }
  let baseTitle = document.title
  let shownTitle = ''
  let timer: ReturnType<typeof setInterval> | null = null

  const sync = () => {
    // Someone else changed the title (e.g. the site name loaded): build on it.
    if (document.title !== shownTitle) baseTitle = document.title
    const pending = pendingItems(useDrawStore.getState().rooms)
    let title = baseTitle
    let badge: TabBadge = pending.length ? 'busy' : ''
    if (document.hidden && (away.done || away.err)) {
      title = `${away.done ? t('✓ Ready') : t('✕ Not drawn')} · ${baseTitle}`
      if (away.done > 1) {
        title = `${t('✓ {{count}} ready', { count: away.done })} · ${baseTitle}`
      }
      badge = away.done ? 'done' : 'err'
    } else if (pending.length) {
      const secs = Math.max(
        ...pending.map((it) => Math.floor((Date.now() - it.start) / 1000))
      )
      const what =
        pending.length > 1
          ? t('Drawing {{count}}', { count: pending.length })
          : t('Drawing now')
      title = `${what} ${formatClock(secs)} · ${baseTitle}`
    }
    if (document.title !== title) document.title = title
    shownTitle = title
    icon.set(badge)
    // The clock in the title ticks only while something is drawing.
    if (pending.length && !timer) timer = setInterval(sync, 1000)
    if (!pending.length && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onDrawFinished((e) => {
    const s = useDrawStore.getState()
    const room = s.rooms.find((r) => r.id === e.roomId)
    const onPage = useDrawDotStore.getState().open
    useDrawDotStore.getState().finished()
    if (e.notSaved) {
      toast.warning(
        t(
          'Browser storage is full, so this picture lasts only until you close the page. Download it, or delete old conversations.'
        )
      )
    }
    if (room && (!onPage || s.curId !== room.id)) {
      const msg = e.ok
        ? t('“{{title}}” is ready', { title: room.title })
        : t('“{{title}}” was not drawn', { title: room.title })
      toast(msg, {
        action: {
          label: t('Take a look'),
          onClick: () => showPicture(room.id, e.item.id),
        },
      })
    }
    if (document.hidden) {
      if (e.ok) away.done++
      else away.err++
      const prefs = readAlertPrefs()
      if (prefs.sound) chime(e.ok)
      if (prefs.notify) {
        showNotification(
          e.ok ? t('Done drawing') : t('This picture was not drawn'),
          e.ok
            ? e.item.req.text.slice(0, 60)
            : t('You were not charged. Come back and try again.'),
          e.item.id,
          () => showPicture(room?.id, e.item.id)
        )
      }
    }
    sync()
  })

  // A new picture starts the clock.
  useDrawStore.subscribe((state, prev) => {
    if (state.rooms !== prev.rooms && !timer) sync()
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) away.done = away.err = 0
    sync()
  })

  // Sound needs one click first (Safari: per audio element); any click will do.
  document.addEventListener('click', ensureAudio, true)
  document.addEventListener('keydown', ensureAudio, true)

  window.addEventListener('beforeunload', (e) => {
    if (!pendingItems(useDrawStore.getState().rooms).length) return
    e.preventDefault()
    e.returnValue = ''
  })

  sync()
}
