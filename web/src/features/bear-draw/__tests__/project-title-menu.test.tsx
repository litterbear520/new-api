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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { TitleMenu } from '../components/project/title-menu'
import type { Project } from '../types'

const project = (n: number): Project => ({
  id: `p${n}`,
  title: `项目 ${n}`,
  createdAt: n,
  updatedAt: 1000 - n,
  cost: 0,
  messages: [],
  transcript: [],
  groups: [],
  nodes: [],
})

function renderMenu(count: number) {
  useBearDrawStore.setState({
    projects: Array.from({ length: count }, (_, i) => project(i + 1)),
  })
  const root = createRootRoute()
  const draw = createRoute({
    getParentRoute: () => root,
    path: '/draw',
    component: () => {
      const current = useBearDrawStore((s) =>
        s.projects.find((p) => p.id === 'p1')
      )
      return current ? <TitleMenu project={current} /> : null
    },
  })
  const router = createRouter({
    routeTree: root.addChildren([draw]),
    history: createMemoryHistory({ initialEntries: ['/draw?p=p1'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  useBearDrawStore.setState({ projects: [] })
})

describe('project title menu', () => {
  it('deletes a recent project from its own row and stays in this one', async () => {
    const user = userEvent.setup()
    const router = renderMenu(3)
    await user.click(await screen.findByRole('button', { name: /项目 1/ }))

    // the current project is not in the list, the other two are
    expect(
      screen.getAllByRole('menuitem', { name: /^Delete project/ })
    ).toHaveLength(2)
    expect(
      screen.queryByRole('menuitem', { name: 'Delete project “项目 1”' })
    ).toBeNull()

    await user.click(
      screen.getByRole('menuitem', { name: 'Delete project “项目 3”' })
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Confirm deleting “项目 3”' })
    )
    expect(useBearDrawStore.getState().projects.map((p) => p.id)).toEqual([
      'p1',
      'p2',
    ])
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(router.state.location.search).toEqual({ p: 'p1' })
    // deleting this project still goes through its own confirm dialog
    expect(
      screen.getByRole('menuitem', { name: 'Delete this project' })
    ).toBeTruthy()
  })

  it('arms with the keyboard too: Enter twice deletes', async () => {
    const user = userEvent.setup()
    renderMenu(2)
    await user.click(await screen.findByRole('button', { name: /项目 1/ }))
    screen.getByRole('menuitem', { name: 'Delete project “项目 2”' }).focus()
    await user.keyboard('{Enter}')
    expect(useBearDrawStore.getState().projects).toHaveLength(2)
    expect(
      screen.getByRole('menuitem', { name: 'Confirm deleting “项目 2”' })
    ).toBe(document.activeElement)
    await user.keyboard('{Enter}')
    expect(useBearDrawStore.getState().projects.map((p) => p.id)).toEqual([
      'p1',
    ])
  })

  it('moves the focus to the next row after a delete', async () => {
    const user = userEvent.setup()
    renderMenu(4)
    await user.click(await screen.findByRole('button', { name: /项目 1/ }))
    screen.getByRole('menuitem', { name: 'Delete project “项目 2”' }).focus()
    await user.keyboard('{Enter}{Enter}')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('menuitem', { name: 'Delete project “项目 3”' })
      )
    )
    // the last row hands the focus to the one above it
    screen.getByRole('menuitem', { name: 'Delete project “项目 4”' }).focus()
    await user.keyboard('{Enter}{Enter}')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('menuitem', { name: 'Delete project “项目 3”' })
      )
    )
    await user.keyboard('{Enter}{Enter}')
    expect(useBearDrawStore.getState().projects.map((p) => p.id)).toEqual([
      'p1',
    ])
  })
})
