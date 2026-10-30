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
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { usageLogSchema } from '../../data/schema'
import { UsageLogsProvider } from '../usage-logs-provider'
import { UsageLogsTable } from '../usage-logs-table'

// Tailwind classes that clip the content (any breakpoint) and corner radii
// that differ from corner to corner.
const CLIP = /^(?:[\w-]+:)*overflow(?:-[xy])?-(?:hidden|clip|auto|scroll)$/
const UNEVEN_RADIUS =
  /^(?:[\w-]+:)*rounded-(?:[tblrse]|tl|tr|bl|br|ss|se|es|ee)(?:-|$)/

const log = usageLogSchema.parse({
  id: 1,
  user_id: 1,
  created_at: 1788840000,
  type: 2,
  content: '',
  model_name: 'gpt-5.5',
  quota: 5000,
})

async function renderTable() {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    let data: unknown = { quota: 0, rpm: 0, tpm: 0 }
    if (url.startsWith('/api/log?')) data = { items: [log], total: 1 }
    else if (url === '/api/subscription/admin/plans') data = []
    else if (url === '/api/group/') data = []
    return { data: { success: true, data } }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: () => <UsageLogsTable logCategory='common' />,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: ['/usage-logs/common'] }),
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <UsageLogsProvider>
        <RouterProvider router={router} />
      </UsageLogsProvider>
    </QueryClientProvider>
  )
  return screen.findByRole('row', { name: /gpt-5\.5/ })
}

function clippingAncestors(element: HTMLElement): HTMLElement[] {
  const clips: HTMLElement[] = []
  for (let node = element.parentElement; node; node = node.parentElement) {
    if ([...node.classList].some((name) => CLIP.test(name))) clips.push(node)
  }
  return clips
}

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  localStorage.clear()
})

it('clips the toolbar and the logs table with one evenly rounded card', async () => {
  const row = await renderTable()

  const clips = clippingAncestors(row)

  expect(
    clips.find((clip) => clip.classList.contains('sm:overflow-hidden'))
  ).toHaveClass('sm:rounded-lg', 'sm:border')
  for (const clip of clips) {
    const uneven = [...clip.classList].filter((name) =>
      UNEVEN_RADIUS.test(name)
    )
    expect(uneven).toEqual([])
  }
})
