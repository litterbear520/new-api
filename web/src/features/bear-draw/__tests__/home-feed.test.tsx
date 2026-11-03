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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HomeFeed } from '../components/home/home-feed'

function Feed() {
  return (
    <div data-slot='console-scroller' style={{ scrollPaddingTop: '56px' }}>
      <HomeFeed onUse={vi.fn()} onOpenSkill={vi.fn()} onAddSkill={vi.fn()} />
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
  const realScrollTo = Element.prototype.scrollTo

  beforeEach(() => {
    // jsdom has no scrolling
    Element.prototype.scrollTo = vi.fn()
  })

  afterEach(() => {
    Element.prototype.scrollTo = realScrollTo
  })

  it('starts the other tab at its top, just under the site bar', async () => {
    const user = userEvent.setup()
    renderFeed()
    const skills = await screen.findByRole('tab', { name: 'Skills' })
    const box = document.querySelector<HTMLElement>(
      '[data-slot="console-scroller"]'
    )
    const feed = document.querySelector<HTMLElement>('.bd-feed')
    if (!box || !feed) throw new Error('no feed')
    const scrollTo = vi.fn()
    box.scrollTo = scrollTo
    box.scrollTop = 3000
    feed.getBoundingClientRect = () => new DOMRect(0, -1000, 100, 5000)

    await user.click(skills)
    await user.click(screen.getByRole('tab', { name: 'Ideas' }))

    await waitFor(() => expect(scrollTo).toHaveBeenCalled())
    // 3000 + (-1000 - 56): the feed's top comes to rest below the 56 px bar
    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 1944,
      behavior: 'instant',
    })
  })

  it('leaves the scroll alone when the feed is not above the bar yet', async () => {
    const user = userEvent.setup()
    renderFeed()
    const ideas = await screen.findByRole('tab', { name: 'Ideas' })
    const box = document.querySelector<HTMLElement>(
      '[data-slot="console-scroller"]'
    )
    const feed = document.querySelector<HTMLElement>('.bd-feed')
    if (!box || !feed) throw new Error('no feed')
    const scrollTo = vi.fn()
    box.scrollTo = scrollTo
    feed.getBoundingClientRect = () => new DOMRect(0, 400, 100, 5000)

    await user.click(screen.getByRole('tab', { name: 'Skills' }))
    await user.click(ideas)

    expect(scrollTo).not.toHaveBeenCalled()
  })

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
