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
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { useMoney } from '@/features/draw/hooks/use-money'
import { cachedImageUrl, loadImageUrl } from '@/features/draw/lib/images'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useNightSeaStore } from '@/stores/night-sea-store'

import { createCanvas } from '../../lib/canvas/canvas'
import type { CanvasApi, CanvasState } from '../../lib/canvas/types'
import type { CanvasNode, Project } from '../../types'
import { type CanvasCallbacks, runCanvasAction } from './canvas-actions'
import { canvasLabels } from './canvas-labels'
import { applyCanvasState, projectToState, syncCanvas } from './canvas-sync'
import { createHalftones, type Halftones } from './halftones'

export type CanvasViewProps = CanvasCallbacks & {
  project: Project
}

/** Writes canvas moves back into the project, ~400 ms after they stop. */
function createSaver() {
  let timer = 0
  let job: { pid: string; state: CanvasState } | null = null
  const flush = () => {
    window.clearTimeout(timer)
    const j = job
    job = null
    if (!j) return
    useBearDrawStore
      .getState()
      .updateProject(j.pid, (p) => applyCanvasState(p, j.state))
  }
  const schedule = (pid: string, state: CanvasState) => {
    if (job && job.pid !== pid) flush()
    job = { pid, state }
    window.clearTimeout(timer)
    timer = window.setTimeout(flush, 400)
  }
  return { schedule, flush }
}

const srcOf = (n: CanvasNode) =>
  n.img ? cachedImageUrl(n.img.id, 'full') : null
const thumbOf = (n: CanvasNode) =>
  n.img ? cachedImageUrl(n.img.id, 'thumb') : null

/**
 * Keeps one canvas in step with a project: shows its frames and pictures,
 * loads picture files, runs the dot screens, saves moves back.
 */
function createProjectSync(
  cv: CanvasApi,
  halftones: Halftones,
  current: () => Project,
  beforeSwitch: () => void
) {
  let prev: Project | null = null
  const loading = new Set<string>()
  const missing = new Set<string>()
  let alive = true

  /**
   * Finished pictures whose files aren't in memory yet: the thumbnail
   * first (what the canvas shows zoomed out), then the full picture. A
   * picture shows once its full file is known (the thumbnail can be
   * missing, e.g. on old pictures).
   */
  function loadFiles(p: Project) {
    for (const n of p.nodes) {
      const id = n.img?.id
      if (n.status !== 'ready' || !id || srcOf(n)) continue
      if (loading.has(id) || missing.has(id)) continue
      loading.add(id)
      loadImageUrl(id, 'thumb')
        .catch(() => null)
        .then(() => loadImageUrl(id, 'full'))
        .then((url) => {
          loading.delete(id)
          if (!url) missing.add(id)
          else if (alive) apply(current())
        })
        .catch(() => loading.delete(id))
    }
  }

  function apply(next: Project) {
    if (!alive) return
    if (!prev || prev.id !== next.id) {
      // Another project in the same view: save the old one's moves first.
      if (prev) beforeSwitch()
      cv.setState(projectToState(next, srcOf, thumbOf))
      if (!next.camera) cv.focus(null, { animate: false })
    } else {
      const added = syncCanvas(cv, prev, next, srcOf, thumbOf)
      const uploads = added.filter(
        (id) => next.nodes.find((n) => n.id === id)?.meta.upload
      )
      if (uploads.length) cv.focus(uploads, { animate: true })
    }
    prev = next
    halftones.update(next)
    loadFiles(next)
  }

  return {
    apply,
    stop: () => {
      alive = false
    },
  }
}

export function useCanvasView(props: CanvasViewProps) {
  const { t } = useTranslation()
  const theme = useTheme().resolvedTheme
  const nightOn = useNightSeaStore((s) => s.on)
  const money = useMoney()
  const labels = useMemo(() => canvasLabels(t), [t])
  const hostRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const cvRef = useRef<CanvasApi | null>(null)
  const syncRef = useRef<ReturnType<typeof createProjectSync> | null>(null)
  // The latest render's values, for the canvas's callbacks.
  const latest = useRef({ props, labels, money, t })
  useLayoutEffect(() => {
    latest.current = { props, labels, money, t }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const get = () => latest.current
    const halftones = createHalftones(() => get().props.project)
    const saver = createSaver()
    const cv: CanvasApi = createCanvas(host, {
      labels: get().labels,
      formatCost: (usd) => get().money.cost(usd),
      renderPending: (slot, node) => halftones.mount(slot, node.id),
      revealer: (media, img, _old, node) =>
        halftones.reveal(node.id, img, media),
      onRendered: (_el, node) => halftones.settle(node.id, node.status),
      onChange: (state) => saver.schedule(get().props.project.id, state),
      onAction: (id, payload) =>
        runCanvasAction(
          {
            project: get().props.project,
            cb: get().props,
            cv,
            t: get().t,
            pickFiles: () => fileRef.current?.click(),
          },
          id,
          payload
        ),
    })
    const sync = createProjectSync(
      cv,
      halftones,
      () => get().props.project,
      saver.flush
    )
    cvRef.current = cv
    syncRef.current = sync
    sync.apply(get().props.project)
    return () => {
      sync.stop()
      saver.flush()
      cv.destroy()
      halftones.destroyAll()
      cvRef.current = null
      syncRef.current = null
    }
  }, [])

  useEffect(() => {
    syncRef.current?.apply(props.project)
  }, [props.project])

  // the canvas reads the night sea when its theme is applied
  useEffect(() => {
    cvRef.current?.setTheme(theme)
  }, [theme, nightOn])

  useEffect(() => {
    cvRef.current?.setLabels(labels)
  }, [labels])

  return { hostRef, fileRef, cvRef }
}
