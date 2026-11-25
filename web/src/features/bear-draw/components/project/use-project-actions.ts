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
import { useCallback, useMemo, useRef, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { isQuotaError } from '@/features/draw/lib/storage'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { SKIPPED_PICTURES_TEXT, storeFailedText } from '../../lib/attachments'
import type { MarkInfo } from '../../lib/canvas/types'
import { storeMarked, uploadToCanvas } from '../../lib/engine'
import { exportGroup } from '../../lib/export'
import type { ProjectLayout } from '../../types'
import type { ComposerHandle } from '../composer/composer'
import type { PartActions } from '../parts/part-actions'

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩'

type Options = {
  projectId: string
  /** No room for both: the canvas comes as a sheet over the chat. */
  narrow: boolean
  composerRef: RefObject<ComposerHandle | null>
  /** Centre the canvas on pictures once it is there. */
  focusCanvas: (ids?: string[]) => void
  /** Shows or hides the canvas sheet (narrow cards; not remembered). */
  setSheet: (on: boolean) => void
  balanceUsd: number | null
  busy: boolean
  goHome: () => void
}

/**
 * What the project page does for its parts: switch between chat and
 * canvas (remembered per project), pack a set, fill the composer, and take
 * pictures from the canvas into the composer as @ references.
 */
export function useProjectActions(o: Options) {
  const { t } = useTranslation()
  // called below, so the hooks depend on the functions themselves
  const focusCanvas = o.focusCanvas
  const setSheet = o.setSheet
  const goHome = o.goHome

  /** On a narrow card only the sheet changes; elsewhere the project keeps it. */
  const setLayout = useCallback(
    (layout: ProjectLayout) => {
      if (o.narrow) {
        setSheet(layout === 'canvas')
        return
      }
      useBearDrawStore
        .getState()
        .updateProject(o.projectId, (x) =>
          (x.layout ?? 'split') === layout ? x : { ...x, layout }
        )
    },
    [o.projectId, o.narrow, setSheet]
  )

  const layoutNow = useCallback(
    () => findProject(o.projectId)?.layout ?? 'split',
    [o.projectId]
  )

  const openCanvas = useCallback(
    (ids?: string[]) => {
      focusCanvas(ids)
      if (o.narrow) setSheet(true)
      else if (layoutNow() === 'chat') setLayout('split')
    },
    [focusCanvas, o.narrow, setSheet, layoutNow, setLayout]
  )

  /**
   * The composer is about to be used: bring the chat back if it is hidden,
   * at once (canvas clicks are native events), so it can take the focus.
   */
  const showChat = useCallback(() => {
    flushSync(() => {
      if (o.narrow) setSheet(false)
      else if (layoutNow() === 'canvas') setLayout('split')
    })
  }, [o.narrow, setSheet, layoutNow, setLayout])

  const packGroup = useCallback(
    async (groupId: string) => {
      const project = findProject(o.projectId)
      if (!project) return
      try {
        const n = await exportGroup(project, groupId)
        if (!n) toast(t('This set has no finished pictures yet'))
      } catch {
        toast.error(t('Could not pack the pictures. Try again.'))
      }
    },
    [o.projectId, t]
  )

  /** Canvas pictures go into the composer as @ references. */
  const onEdit = useCallback(
    (nodeIds: string[]) => {
      const nodes = findProject(o.projectId)?.nodes ?? []
      const refs = nodeIds.flatMap((id) => {
        const node = nodes.find((n) => n.id === id)
        return node?.img
          ? [{ ...node.img, nodeId: node.id, label: node.label }]
          : []
      })
      if (!refs.length) return
      o.composerRef.current?.addRefs(refs)
      showChat()
      o.composerRef.current?.focus()
    },
    [o.projectId, o.composerRef, showChat]
  )

  /** The notes last put into the composer for each circled picture. */
  const markNotes = useRef(new Map<string, string>())

  const onMarked = useCallback(
    async (nodeId: string, png: Blob, marks?: MarkInfo[]) => {
      const att = await storeMarked(o.projectId, nodeId, png).catch(() => null)
      if (!att) {
        toast.error(t('Could not keep the circled picture. Try again.'))
        return
      }
      // no room for the circled picture: its notes stay out too
      if (o.composerRef.current?.addRefs([att]) === false) return
      // 「①杯身换成白色；②…」: the notes written on the marks
      const notes = (marks ?? [])
        .filter((m) => m.note.trim())
        .map((m) => `${CIRCLED[m.n - 1] ?? `${m.n}.`}${m.note.trim()}`)
        .join('；')
      // circled again: the new notes take the place of the earlier ones
      const earlier = markNotes.current.get(nodeId)
      if (notes) o.composerRef.current?.appendText(notes, earlier)
      markNotes.current.set(nodeId, notes)
      showChat()
      o.composerRef.current?.focus()
    },
    [o.projectId, o.composerRef, showChat, t]
  )

  const onUpload = useCallback(
    async (files: File[]) => {
      try {
        const placed = await uploadToCanvas(o.projectId, files)
        if (placed < files.length) toast(t(SKIPPED_PICTURES_TEXT))
      } catch (error) {
        toast.error(
          t(
            isQuotaError(error)
              ? storeFailedText(error)
              : 'Could not add these pictures'
          )
        )
      }
    },
    [o.projectId, t]
  )

  const focusComposer = useCallback(
    () => o.composerRef.current?.focus(),
    [o.composerRef]
  )

  const parts = useMemo<PartActions>(
    () => ({
      balanceUsd: o.balanceUsd,
      busy: o.busy,
      openCanvas,
      exportGroup: (groupId) => void packGroup(groupId),
      setComposerText: (text) => {
        o.composerRef.current?.setText(text)
        o.composerRef.current?.focus()
      },
      focusComposer,
      newProject: goHome,
    }),
    [
      o.balanceUsd,
      o.busy,
      openCanvas,
      packGroup,
      o.composerRef,
      focusComposer,
      goHome,
    ]
  )

  return {
    setLayout,
    openCanvas,
    focusComposer,
    onEdit,
    onMarked,
    onUpload,
    parts,
  }
}
