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

import {
  chime,
  createTabIcon,
  ensureAudio,
  readAlertPrefs,
  showNotification,
  type TabBadge,
} from '@/features/draw/lib/alerts'
import { formatClock } from '@/features/draw/lib/reveal'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useDrawDotStore } from '@/stores/draw-dot-store'

import { onPictureFinished } from '../lib/engine'
import type { Project } from '../types'

/*
 * Pictures keep drawing after the user leaves the page, so once the page
 * has opened these alerts run for the rest of the visit, on every console
 * page: the tab shows a clock while drawing and "画好了" when a picture
 * finished in the background, a toast offers to go back, the sidebar's
 * 画图 item gets a red dot, and closing the tab while drawing asks first.
 */

let openProject: (id: string) => void = () => {}
let currentProject: string | null = null
let started = false

/** Starts times of every picture drawing right now. */
function drawingStarts(projects: Project[]): number[] {
  const out: number[] = []
  for (const p of projects) {
    for (const m of p.messages) {
      if (m.role !== 'agent' || m.status === 'done') continue
      for (const part of m.parts) {
        if (part.type !== 'progress') continue
        for (const it of part.items) {
          if (it.status === 'drawing') out.push(it.startedAt ?? Date.now())
          else if (it.status === 'queued') out.push(Date.now())
        }
      }
    }
  }
  return out
}

function busy(): boolean {
  const s = useBearDrawStore.getState()
  return (
    drawingStarts(s.projects).length > 0 ||
    Object.values(s.live).some((l) => l.phase !== 'wait')
  )
}

/** Used by the page: starts the alerts, keeps the sidebar dot off, tracks the open project. */
export function useBearDrawAlerts(projectId: string | null) {
  const navigate = useNavigate()

  useEffect(() => {
    openProject = (id) => void navigate({ to: '/draw', search: { p: id } })
    startAlerts()
    useDrawDotStore.getState().pageOpened()
    return () => useDrawDotStore.getState().pageClosed()
  }, [navigate])

  useEffect(() => {
    currentProject = projectId
    return () => {
      currentProject = null
    }
  }, [projectId])
}

function startAlerts() {
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
    const starts = drawingStarts(useBearDrawStore.getState().projects)
    let title = baseTitle
    let badge: TabBadge = starts.length ? 'busy' : ''
    if (document.hidden && (away.done || away.err)) {
      title = `${away.done ? t('✓ Ready') : t('✕ Not drawn')} · ${baseTitle}`
      if (away.done > 1) {
        title = `${t('✓ {{count}} ready', { count: away.done })} · ${baseTitle}`
      }
      badge = away.done ? 'done' : 'err'
    } else if (starts.length) {
      const secs = Math.max(
        ...starts.map((s) => Math.floor((Date.now() - s) / 1000))
      )
      const what =
        starts.length > 1
          ? t('Drawing {{count}}', { count: starts.length })
          : t('Drawing now')
      title = `${what} ${formatClock(secs)} · ${baseTitle}`
    }
    if (document.title !== title) document.title = title
    shownTitle = title
    icon.set(badge)
    if (starts.length && !timer) timer = setInterval(sync, 1000)
    if (!starts.length && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onPictureFinished((e) => {
    const p = useBearDrawStore
      .getState()
      .projects.find((x) => x.id === e.projectId)
    const onPage = useDrawDotStore.getState().open
    useDrawDotStore.getState().finished()
    if (e.notSaved) {
      toast.warning(
        t(
          'Browser storage is full, so this picture lasts only until you close the page. Download it, or delete old projects.'
        )
      )
    }
    const title = p?.title || t('Untitled project')
    // the address is the surest sign of which project is on screen
    const shown =
      onPage &&
      (currentProject === e.projectId ||
        new URLSearchParams(window.location.search).get('p') === e.projectId)
    if (p && !shown) {
      toast(
        e.ok
          ? t('“{{title}}” is ready', { title })
          : t('“{{title}}” was not drawn', { title }),
        {
          action: { label: t('Take a look'), onClick: () => openProject(p.id) },
        }
      )
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
            ? `${title} · ${e.label}`
            : t('You were not charged. Come back and try again.'),
          e.nodeId,
          () => p && openProject(p.id)
        )
      }
    }
    sync()
  })

  // A new picture starts the clock.
  useBearDrawStore.subscribe((state, prev) => {
    if (state.projects !== prev.projects && !timer) sync()
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) away.done = away.err = 0
    sync()
  })

  // Sound needs one click first (Safari: per audio element); any click will do.
  document.addEventListener('click', ensureAudio, true)
  document.addEventListener('keydown', ensureAudio, true)

  window.addEventListener('beforeunload', (e) => {
    if (!busy()) return
    e.preventDefault()
    e.returnValue = ''
  })

  sync()
}
