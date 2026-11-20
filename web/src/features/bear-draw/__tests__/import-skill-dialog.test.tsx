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
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { ImportSkillDialog } from '../components/dialogs/import-skill-dialog'
import { MAX_FILE_BYTES } from '../lib/skill-import'

/** Starts a --- header and never closes it. */
const BROKEN = '---\nname: x'

function renderDialog() {
  const root = createRootRoute()
  const draw = createRoute({
    getParentRoute: () => root,
    path: '/draw',
    component: () => <ImportSkillDialog open onOpenChange={vi.fn()} />,
  })
  const router = createRouter({
    routeTree: root.addChildren([draw]),
    history: createMemoryHistory({ initialEntries: ['/draw'] }),
  })
  render(<RouterProvider router={router} />)
}

const box = () => screen.findByRole('textbox', { name: 'SKILL.md text' })
const errorBox = () =>
  screen.queryByText('This does not read as a SKILL.md')?.closest('[id]') ??
  null

afterEach(() => {
  useBearDrawStore.setState({ mySkills: [] })
})

describe('导入技能 errors', () => {
  it('says nothing while the text is being typed, only after leaving the box', async () => {
    const user = userEvent.setup()
    renderDialog()
    const ta = await box()
    await user.click(ta)
    await user.paste(BROKEN)
    expect(errorBox()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(ta).toHaveAttribute('aria-invalid', 'false')

    await user.tab()
    const error = errorBox()
    expect(error).toHaveAttribute('role', 'status')
    expect(ta).toHaveAttribute('aria-invalid', 'true')
    expect(ta).toHaveAccessibleDescription(
      expect.stringContaining('the --- header at the top is not closed')
    )
  })

  it('takes the error away again as soon as the text is changed', async () => {
    const user = userEvent.setup()
    renderDialog()
    const ta = await box()
    await user.click(ta)
    await user.paste(BROKEN)
    await user.tab()
    expect(errorBox()).not.toBeNull()

    await user.type(ta, 'y')
    expect(errorBox()).toBeNull()
    expect(ta).toHaveAttribute('aria-invalid', 'false')
  })

  it('a failed import shows the error and puts the focus in the box', async () => {
    const user = userEvent.setup()
    renderDialog()
    const ta = await box()
    fireEvent.change(ta, { target: { value: BROKEN } })
    await user.click(
      screen.getByRole('button', { name: 'Import to My skills' })
    )
    expect(errorBox()).not.toBeNull()
    expect(document.activeElement).toBe(ta)
    expect(useBearDrawStore.getState().mySkills).toEqual([])
  })

  it('does not read a file that is too big, and says so at once', async () => {
    renderDialog()
    await box()
    const file = new File(['# big'], 'SKILL.md', { type: 'text/markdown' })
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 })
    const read = vi.spyOn(file, 'text')
    const input = document.querySelector<HTMLInputElement>('input[type=file]')
    if (!input) throw new Error('no file input')

    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() =>
      expect(
        screen.getByText('Not a SKILL.md: the file is larger than 200 KB')
      ).toBeTruthy()
    )
    expect(read).not.toHaveBeenCalled()
    expect(await box()).toHaveValue('')
  })
})
