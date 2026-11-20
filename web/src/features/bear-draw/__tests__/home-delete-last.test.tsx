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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { HomeView } from '../components/home/home-view'
import type { Project } from '../types'

const only: Project = {
  id: 'p1',
  title: '项目 1',
  createdAt: 1,
  updatedAt: 999,
  cost: 0,
  messages: [],
  transcript: [],
  groups: [],
  nodes: [],
}

function renderHome() {
  useBearDrawStore.setState({ projects: [only] })
  const root = createRootRoute()
  const draw = createRoute({
    getParentRoute: () => root,
    path: '/draw',
    component: () => (
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <div data-slot='console-scroller'>
            <HomeView />
          </div>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([draw]),
    history: createMemoryHistory({ initialEntries: ['/draw'] }),
  })
  return render(<RouterProvider router={router} />)
}

afterEach(() => {
  useBearDrawStore.setState({ projects: [] })
})

test('deleting the last project from 「全部」 puts the focus back in the composer', async () => {
  const user = userEvent.setup()
  const { container } = renderHome()
  const all = await screen.findByRole('button', { name: 'All 1' })

  // keyboard only: open the menu, go to the trash button, press it twice
  all.focus()
  await user.keyboard('{Enter}')
  await waitFor(() =>
    expect(screen.getAllByRole('menuitem', { name: /项目 1/ })[0]).toBeTruthy()
  )
  await user.keyboard('{Home}{ArrowDown}')
  expect(document.activeElement).toBe(
    screen.getByRole('menuitem', { name: 'Delete project “项目 1”' })
  )
  await user.keyboard('{Enter}{Enter}')

  expect(useBearDrawStore.getState().projects).toEqual([])
  expect(
    screen.queryByRole('navigation', { name: 'Recent projects' })
  ).toBeNull()
  const composer = container.querySelector('textarea')
  await waitFor(() => expect(document.activeElement).toBe(composer))
})
