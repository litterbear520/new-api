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

import { ResumeStrip } from '../components/home/resume-strip'
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

function renderStrip(count: number) {
  useBearDrawStore.setState({
    projects: Array.from({ length: count }, (_, i) => project(i + 1)),
  })
  const root = createRootRoute()
  const draw = createRoute({
    getParentRoute: () => root,
    path: '/draw',
    component: ResumeStrip,
  })
  const router = createRouter({
    routeTree: root.addChildren([draw]),
    history: createMemoryHistory({ initialEntries: ['/draw'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  useBearDrawStore.setState({ projects: [] })
})

describe('继续上次', () => {
  it('shows the three latest projects and the rest in 「全部」', async () => {
    const user = userEvent.setup()
    const router = renderStrip(5)

    const nav = await screen.findByRole('navigation', {
      name: 'Recent projects',
    })
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      expect.stringContaining('项目 1'),
      expect.stringContaining('项目 2'),
      expect.stringContaining('项目 3'),
    ])

    await user.click(screen.getByRole('button', { name: /All 5/ }))
    const rows = await screen.findAllByRole('menuitem', { name: /^项目 \d/ })
    expect(rows).toHaveLength(5)
    expect(
      screen.getAllByRole('menuitem', { name: /^Delete project/ })
    ).toHaveLength(5)
    await user.click(rows[4])
    expect(router.state.location.search).toEqual({ p: 'p5' })
  })

  it('deletes a project from 「全部」 on the second press and stays open', async () => {
    const user = userEvent.setup()
    const router = renderStrip(5)
    await user.click(await screen.findByRole('button', { name: /All 5/ }))

    await user.click(
      await screen.findByRole('menuitem', { name: 'Delete project “项目 5”' })
    )
    // the first press only arms the button
    expect(useBearDrawStore.getState().projects).toHaveLength(5)
    const confirm = screen.getByRole('menuitem', {
      name: 'Confirm deleting “项目 5”',
    })
    expect(confirm.textContent).toContain('Confirm delete')

    await user.click(confirm)
    expect(useBearDrawStore.getState().projects.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ])
    // still in the menu, still on the home page
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /项目 5/ })).toBeNull()
    expect(router.state.location.search).toEqual({})

    // down to three: the menu stays until it is closed
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete project “项目 4”' })
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Confirm deleting “项目 4”' })
    )
    expect(useBearDrawStore.getState().projects).toHaveLength(3)
    expect(screen.getByRole('menu')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /All/ })).toBeNull()
    )
  })

  it('disarms the delete button when the pointer moves to another row', async () => {
    const user = userEvent.setup()
    renderStrip(5)
    await user.click(await screen.findByRole('button', { name: /All 5/ }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Delete project “项目 2”' })
    )
    expect(
      screen.getByRole('menuitem', { name: 'Confirm deleting “项目 2”' })
    ).toBeTruthy()

    await user.hover(screen.getByRole('menuitem', { name: /^项目 3/ }))
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Delete project “项目 2”' })
      ).toBeTruthy()
    )
    expect(useBearDrawStore.getState().projects).toHaveLength(5)
  })

  it('has no 「全部」 menu with three projects or fewer', async () => {
    renderStrip(3)
    await screen.findByRole('navigation', { name: 'Recent projects' })
    expect(screen.queryByRole('button', { name: /All/ })).toBeNull()
  })
})
