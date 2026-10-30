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
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MODEL_LOGOS, TOOL_LOGOS } from '../../night-sea/sections-content'
import { Gateway } from '../gateway'
import {
  MODELS,
  ROUTES,
  hubRadius,
  linkedTo,
  pickRequest,
  requestFormat,
  shownShare,
} from '../gateway-strands'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({
    to,
    search,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    search?: { vendor?: string }
  }) => (
    <a href={search?.vendor ? `${to}?vendor=${search.vendor}` : to} {...rest}>
      {children}
    </a>
  ),
}))

// jsdom has no 2D canvas: the strands draw nothing here
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => null
  )
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('the gateway', () => {
  it('lists the eight model makers we sell, each opening the model square on its vendor', () => {
    render(<Gateway />)

    const links = within(
      screen.getByRole('list', { name: '模型' })
    ).getAllByRole('link')
    const sold = [
      ['Claude', '/pricing?vendor=Anthropic'],
      ['OpenAI', '/pricing?vendor=OpenAI'],
      ['Gemini', '/pricing?vendor=Google'],
      ['DeepSeek', '/pricing?vendor=DeepSeek'],
      ['Qwen', '/pricing?vendor=阿里巴巴'],
      ['Kimi', '/pricing?vendor=Moonshot'],
      ['GLM', '/pricing?vendor=智谱'],
      ['MiniMax', '/pricing?vendor=MiniMax'],
    ]
    expect(links).toHaveLength(sold.length)
    sold.forEach(([name, href], i) => {
      expect(links[i]).toHaveAccessibleName(name)
      expect(links[i]).toHaveAttribute('href', href)
    })
  })

  it('lists the tools, each opening its guide', () => {
    render(<Gateway />)

    expect(
      screen.getByRole('region', { name: '所有模型 一个入口' })
    ).toBeInTheDocument()
    const links = within(
      screen.getByRole('list', { name: '工具' })
    ).getAllByRole('link')
    const guides = [
      ['Claude Code', '/docs/tools/claude-code/'],
      ['Codex', '/docs/tools/codex/'],
      ['Gemini CLI', '/docs/tools/gemini-cli/'],
      ['Pi', '/docs/tools/pi/'],
      ['Cherry Studio', '/docs/tools/cherry-studio/'],
      ['Cline', '/docs/tools/cline/'],
      ['Cursor', '/docs/tools/cursor/'],
      ['OpenCode', '/docs/tools/opencode/'],
    ]
    expect(links).toHaveLength(guides.length)
    guides.forEach(([name, href], i) => {
      expect(links[i]).toHaveAccessibleName(name)
      expect(links[i]).toHaveAttribute('href', href)
    })
  })

  it('puts the hole between the models and the tools as a picture screen readers pass over', () => {
    const { container } = render(<Gateway />)

    const hole = container.querySelector('.ns-gw-core img')
    expect(hole).toHaveAttribute('alt', '')
    expect(hole?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(container.querySelector('canvas')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })
})

describe('the hole in the gateway', () => {
  it.each([1280, 1440, 1920])(
    'leaves the strands room between the chips, side by side (%i px wide)',
    (w) => {
      const core = { width: w - 2 * 200 - 2 * 0.044 * w, height: 420 }
      const r = hubRadius(false, core, w)
      expect(r).toBeGreaterThanOrEqual(30)
      // the disk's ends (3.25 radii out) stay clear of the chips by 120 px or more
      expect(core.width / 2 - 3.25 * r).toBeGreaterThanOrEqual(120)
    }
  )

  it.each([2560, 3440, 5120])(
    'keeps its arc inside the gap on very wide screens (%i px wide)',
    (w) => {
      const core = { width: w - 2 * 200 - 2 * 72, height: 460 }
      const r = hubRadius(false, core, w)
      expect((2.15 + 1.75) * r).toBeLessThanOrEqual(core.height)
      expect(core.width / 2 - 3.25 * r).toBeGreaterThanOrEqual(120)
    }
  )

  it.each([
    [390, 260],
    [430, 300],
    [820, 420],
    [999, 380],
  ])('fits the gap when stacked, %i px wide', (w, coreH) => {
    const r = hubRadius(true, { width: w - 32, height: coreH }, w)
    expect(r).toBeGreaterThanOrEqual(30)
    // its arc and the ring under it stay inside the gap
    expect((2.15 + 1.75) * r).toBeLessThanOrEqual(coreH)
  })
})

describe('how much of the gateway shows', () => {
  const entry = (shown: number, height: number, screen: number | null) => ({
    isIntersecting: shown > 0,
    intersectionRect: { height: shown } as DOMRectReadOnly,
    boundingClientRect: { height } as DOMRectReadOnly,
    rootBounds:
      screen === null ? null : ({ height: screen } as DOMRectReadOnly),
  })

  it('is the share of the stage on the screen', () => {
    expect(shownShare(entry(450, 900, 900), 900)).toBe(0.5)
    expect(shownShare(entry(900, 900, 900), 900)).toBe(1)
    expect(shownShare(entry(0, 900, 900), 900)).toBe(0)
  })

  it('is all of it once a stage taller than the screen fills it (a phone turned sideways)', () => {
    expect(shownShare(entry(360, 720, 360), 360)).toBe(1)
    expect(shownShare(entry(180, 720, 360), 360)).toBe(0.5)
  })

  it('falls back to the window when the observer has no root bounds', () => {
    expect(shownShare(entry(360, 720, null), 360)).toBe(1)
  })
})

describe('the routes', () => {
  it('run between the chips the home page shows', () => {
    expect([...MODELS]).toEqual(MODEL_LOGOS.map((l) => l.name))
    expect(Object.keys(ROUTES).sort()).toEqual(
      TOOL_LOGOS.map((l) => l.name).sort()
    )
  })

  it('light a model with the tools that take it, and a tool with its models', () => {
    expect(linkedTo(null)).toBeNull()
    expect(linkedTo('Codex')).toEqual(new Set(['Codex', 'OpenAI']))
    expect(linkedTo('OpenAI')).toEqual(
      new Set([
        'OpenAI',
        'Codex',
        'Pi',
        'Cherry Studio',
        'Cline',
        'Cursor',
        'OpenCode',
      ])
    )
    expect(linkedTo('Gemini')).toEqual(
      new Set(['Gemini', 'Gemini CLI', 'Cherry Studio', 'Cline', 'Cursor'])
    )
    // the five other makers serve Claude's format and OpenAI's chat format
    // both, so they reach the same tools as Claude
    const claudeTools = [
      'Claude Code',
      'Pi',
      'Cherry Studio',
      'Cline',
      'Cursor',
      'OpenCode',
    ]
    expect(linkedTo('Claude')).toEqual(new Set(['Claude', ...claudeTools]))
    for (const maker of ['DeepSeek', 'Qwen', 'Kimi', 'GLM', 'MiniMax']) {
      expect(linkedTo(maker)).toEqual(new Set([maker, ...claudeTools]))
    }
    expect(linkedTo('OpenCode')).toEqual(
      new Set([
        'OpenCode',
        'Claude',
        'OpenAI',
        'DeepSeek',
        'Qwen',
        'Kimi',
        'GLM',
        'MiniMax',
      ])
    )
  })
})

/** Draws in fixed steps across 0..1, so a share of draws is a share of the line */
function evenly(n: number) {
  let i = 0
  return () => ((i++ % n) + 0.5) / n
}

describe('the requests in flight', () => {
  it('come mostly from Claude, OpenAI and Gemini, yet from every maker', () => {
    const seen = new Map<string, number>()
    const rand = evenly(997)
    for (let i = 0; i < 997 * 7; i++) {
      const [model, tool] = pickRequest(null, rand) ?? []
      expect(ROUTES[tool ?? '']).toContain(model)
      seen.set(model ?? '', (seen.get(model ?? '') ?? 0) + 1)
    }
    expect([...seen.keys()].sort()).toEqual([...MODELS].sort())
    const share = (m: string) => (seen.get(m) ?? 0) / (997 * 7)
    for (const big of ['Claude', 'OpenAI', 'Gemini']) {
      for (const other of ['DeepSeek', 'Qwen', 'Kimi', 'GLM', 'MiniMax']) {
        expect(share(big)).toBeGreaterThan(share(other))
      }
    }
    expect(share('Claude') + share('OpenAI') + share('Gemini')).toBeGreaterThan(
      0.5
    )
  })

  it('run only along the routes of the chip being looked at', () => {
    const rand = evenly(101)
    for (let i = 0; i < 300; i++) {
      expect(pickRequest('Codex', rand)).toEqual(['OpenAI', 'Codex'])
      const [model, tool] = pickRequest('Kimi', rand) ?? []
      expect(model).toBe('Kimi')
      expect(linkedTo('Kimi')).toContain(tool)
    }
  })

  it('are called by the format their tool sends', () => {
    expect(requestFormat('Claude', 'Claude Code')).toBe('Messages')
    expect(requestFormat('GLM', 'Claude Code')).toBe('Messages')
    expect(requestFormat('OpenAI', 'Codex')).toBe('Responses')
    expect(requestFormat('Gemini', 'Gemini CLI')).toBe('generateContent')
    expect(requestFormat('OpenAI', 'Pi')).toBe('Responses')
    expect(requestFormat('Kimi', 'Pi')).toBe('Messages')
    expect(requestFormat('OpenAI', 'OpenCode')).toBe('Responses')
    expect(requestFormat('Qwen', 'OpenCode')).toBe('Messages')
    expect(requestFormat('Claude', 'Cline')).toBe('Chat Completions')
    expect(requestFormat('GLM', 'Cherry Studio')).toBe('Chat Completions')
  })
})
