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
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'

import { useBearChatStore } from '@/stores/bear-chat-store'

import { ArtifactPanel } from '../components/artifact-panel'
import type { Artifact } from '../types'

const page: Artifact = {
  id: 'r1:0',
  replyId: 'r1',
  kind: 'html',
  lang: 'html',
  code: '<p>hi</p>',
  closed: true,
  title: 'Demo',
  file: 'demo.html',
}

function renderPanel() {
  return render(
    <ArtifactPanel
      artifacts={[page]}
      writingId={null}
      cardW={1200}
      narrow={false}
      onDragging={() => undefined}
    />
  )
}

describe('artifact panel preview', () => {
  beforeEach(() => {
    useBearChatStore.getState().setPanel({ artId: page.id, view: 'preview' })
  })

  test('runs the page while the panel is open', () => {
    useBearChatStore.getState().setPanel({ open: true })
    const { container } = renderPanel()
    expect(container.querySelector('iframe')).not.toBeNull()
  })

  test('drops the page when the panel closes', () => {
    useBearChatStore.getState().setPanel({ open: true })
    const { container } = renderPanel()
    act(() => useBearChatStore.getState().closePanel())
    expect(container.querySelector('iframe')).toBeNull()
  })
})
