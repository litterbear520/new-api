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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { HomeFeed } from '../components/home/home-feed'

function Feed() {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={scrollRef}>
      <HomeFeed
        scrollRef={scrollRef}
        onUse={vi.fn()}
        onOpenSkill={vi.fn()}
        onAddSkill={vi.fn()}
      />
    </div>
  )
}

function renderFeed() {
  const root = createRootRoute()
  const draw = createRoute({
    getParentRoute: () => root,
    path: '/draw',
    component: Feed,
  })
  const router = createRouter({
    routeTree: root.addChildren([draw]),
    history: createMemoryHistory({ initialEntries: ['/draw'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('HomeFeed', () => {
  it('opens on the ideas wall and switches to the skills in one click', async () => {
    const user = userEvent.setup()
    const view = renderFeed()

    const ideas = await screen.findByRole('tab', { name: 'Ideas' })
    expect(ideas).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('tablist', { name: 'Ideas and skills' })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('tablist', { name: 'Idea categories' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My skills' })).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Skills' }))

    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'For you' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My skills' })).toBeInTheDocument()
    expect(
      screen.queryByRole('tablist', { name: 'Idea categories' })
    ).toBeNull()

    // back from a project: the home page shows the tab the user left on
    view.unmount()
    renderFeed()
    expect(await screen.findByRole('tab', { name: 'Skills' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })
})
