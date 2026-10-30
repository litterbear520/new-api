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
import { describe, expect, it } from 'vitest'

import type { DrawRoom } from '@/features/draw/types'

import { resultFor } from '../lib/agent/finish'
import { composePrompt, needsConfirm } from '../lib/agent/plan'
import { roomToProject } from '../lib/migrate'
import { settleProject } from '../lib/storage'
import type { AgentMessage, PlanItem, Project } from '../types'

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  id: 'i',
  label: '首图',
  prompt: 'p',
  ratio: '1:1',
  model: 'gpt-image-2.5-sunburst',
  est: 0.02,
  on: true,
  ...over,
})

describe('plan confirmation', () => {
  const plan = (items: PlanItem[], adlaw = 0) => ({
    type: 'plan' as const,
    callId: 'c',
    title: 't',
    items,
    state: 'pending' as const,
    adlaw: Array.from({ length: adlaw }, () => ({
      itemId: 'i',
      word: '第一',
      fix: '人气',
    })),
  })

  it('starts one or two cheap pictures at once', () => {
    expect(needsConfirm(plan([item(), item()]), 10)).toBe(false)
  })

  it('waits for 开始画 from three pictures', () => {
    expect(needsConfirm(plan([item(), item(), item()]), 10)).toBe(true)
  })

  it('waits when the advertising-law check found words', () => {
    expect(needsConfirm(plan([item()], 1), 10)).toBe(true)
  })

  it('waits when the balance cannot pay for the plan', () => {
    expect(needsConfirm(plan([item({ est: 0.05 })]), 0.01)).toBe(true)
  })
})

describe('composePrompt', () => {
  it('names each input image, then the ratio and transparency', () => {
    const text = composePrompt('Make it brighter.', '3:4', true, [
      'the picture to edit',
      'a reference',
    ])

    expect(text.split('\n')).toEqual([
      'Image 1 is the picture to edit. Image 2 is a reference.',
      'Make it brighter.',
      'Aspect ratio 3:4 (portrait).',
      'Transparent background.',
    ])
  })
})

describe('settleProject after a reload', () => {
  const running: AgentMessage = {
    id: 'm1',
    role: 'agent',
    mode: 'agent',
    status: 'running',
    startedAt: 1,
    cost: 0,
    parts: [
      {
        id: 'pg',
        type: 'progress',
        groupId: 'g',
        items: [
          {
            id: 'a',
            nodeId: 'n1',
            label: 'A',
            model: 'm',
            prompt: 'p',
            status: 'drawing',
          },
          {
            id: 'b',
            nodeId: 'n2',
            label: 'B',
            model: 'm',
            prompt: 'p',
            status: 'queued',
          },
        ],
      },
    ],
  }
  const project: Project = {
    id: 'p',
    title: 't',
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [running],
    transcript: [],
    groups: [],
    nodes: [
      {
        id: 'n1',
        groupId: 'g',
        status: 'pending',
        w: 1,
        h: 1,
        label: 'A',
        meta: {},
      },
      {
        id: 'n2',
        groupId: 'g',
        status: 'pending',
        w: 1,
        h: 1,
        label: 'B',
        meta: {},
      },
    ],
  }

  it('marks drawing pictures lost and queued ones stopped', () => {
    const settled = settleProject(project)
    const m = settled.messages[0] as AgentMessage
    const part = m.parts[0]

    expect(m.status).toBe('lost')
    expect(
      part.type === 'progress' && part.items.map((it) => it.status)
    ).toEqual(['lost', 'stopped'])
    expect(settled.nodes.map((n) => n.status)).toEqual(['failed', 'stopped'])
  })

  it('leaves a project that waits for an answer untouched', () => {
    const waiting = {
      ...project,
      messages: [{ ...running, status: 'waiting' as const, parts: [] }],
      nodes: [],
    }

    expect(settleProject(waiting)).toBe(waiting)
  })
})

describe('resultFor', () => {
  it('counts done, failed and stopped pictures of a message', () => {
    const m: AgentMessage = {
      id: 'm',
      role: 'agent',
      mode: 'image',
      status: 'done',
      startedAt: 1000,
      endedAt: 31_000,
      cost: 0.05,
      parts: [
        {
          id: 'pg',
          type: 'progress',
          groupId: 'g',
          items: [
            {
              id: 'a',
              nodeId: 'n1',
              label: 'A',
              model: 'm',
              prompt: 'p',
              status: 'done',
            },
            {
              id: 'b',
              nodeId: 'n2',
              label: 'B',
              model: 'm',
              prompt: 'p',
              status: 'failed',
            },
            {
              id: 'c',
              nodeId: 'n3',
              label: 'C',
              model: 'm',
              prompt: 'p',
              status: 'stopped',
            },
          ],
        },
      ],
    }

    expect(resultFor(m)).toMatchObject({
      done: 1,
      failed: 1,
      stopped: 1,
      secs: 30,
      compact: true,
    })
  })
})

describe('resultFor timing', () => {
  it('counts from the first picture starting, not from the plan waiting for 开始画', () => {
    const m: AgentMessage = {
      id: 'm',
      role: 'agent',
      mode: 'agent',
      status: 'done',
      startedAt: 0,
      endedAt: 400_000,
      cost: 0.02,
      parts: [
        {
          id: 'pg',
          type: 'progress',
          groupId: 'g',
          items: [
            {
              id: 'a',
              nodeId: 'n1',
              label: 'A',
              model: 'm',
              prompt: 'p',
              status: 'done',
              startedAt: 356_000,
            },
          ],
        },
      ],
    }

    expect(resultFor(m)?.secs).toBe(44)
  })
})

describe('roomToProject', () => {
  it('copies a classic conversation as an image-mode project sharing its pictures', () => {
    const room: DrawRoom = {
      id: 'r1',
      title: '小熊',
      model: 'gpt-image-2',
      t: 5,
      msgs: [
        {
          id: 'u1',
          role: 'user',
          text: '一只小熊',
          imgs: [],
          ratio: 'square',
          clear: false,
        },
        {
          id: 'a1',
          role: 'ai',
          items: [
            {
              id: 'p1',
              req: {
                text: '一只小熊',
                imgs: [],
                ratio: 'square',
                clear: false,
                model: 'gpt-image-2',
                marks: null,
              },
              parent: null,
              start: 1,
              status: 'done',
              est: 0.01,
              img: { id: 'img1', w: 1024, h: 1024 },
              secs: 20,
              cost: 0.012,
            },
          ],
        },
      ],
    }

    const p = roomToProject(room)

    expect(p).toMatchObject({ id: 'mig-r1', migrated: true, cost: 0.012 })
    expect(p.nodes[0]).toMatchObject({ status: 'ready', img: { id: 'img1' } })
    expect(p.messages.map((m) => m.role)).toEqual(['user', 'agent'])
    const user = p.messages[0]
    expect(user.role === 'user' && user.image?.ratio).toBe('1:1')
  })
})
