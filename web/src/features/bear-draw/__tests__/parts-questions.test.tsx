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
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { QuestionsCard } from '../components/parts/questions-card'
import { answer } from '../lib/engine'
import type { Part } from '../types'

vi.mock('../lib/engine', () => ({ answer: vi.fn() }))

type QuestionsPart = Extract<Part, { type: 'questions' }>

const card = (patch: Partial<QuestionsPart> = {}): QuestionsPart => ({
  id: 'pt1',
  type: 'questions',
  callId: 'call1',
  items: [
    { q: 'Which style?', options: ['Clean', 'Bold'] },
    {
      q: 'Which platforms?',
      options: ['Taobao', 'JD', 'Douyin'],
      multi: true,
      other: true,
    },
  ],
  answers: null,
  ...patch,
})

describe('QuestionsCard', () => {
  it('sends every answer in question order when the last page is submitted', async () => {
    const user = userEvent.setup()
    render(<QuestionsCard projectId='p1' part={card()} status='waiting' />)

    // a single-choice pick moves on to the next question
    await user.click(screen.getByRole('button', { name: 'Bold' }))
    // the pick shows for a moment first
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(await screen.findByText('Which platforms?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Taobao' }))
    await user.click(screen.getByRole('button', { name: 'Douyin' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Something else' }),
      'Pinduoduo'
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(answer).toHaveBeenCalledWith('p1', 'pt1', [
      { q: 'Which style?', answer: 'Bold' },
      { q: 'Which platforms?', answer: 'Taobao、Douyin、Pinduoduo' },
    ])
  })

  it('picks an option by its number key', async () => {
    const user = userEvent.setup()
    render(<QuestionsCard projectId='p1' part={card()} status='waiting' />)

    screen.getByRole('button', { name: 'Clean' }).focus()
    await user.keyboard('2')

    expect(await screen.findByText('Which platforms?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous question' }))
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('Enter in 「其他」 while Safari composes (keyCode 229) does not submit', async () => {
    vi.mocked(answer).mockClear()
    const user = userEvent.setup()
    render(<QuestionsCard projectId='p1' part={card()} status='waiting' />)
    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await screen.findByText('Which platforms?')
    const other = screen.getByRole('textbox', { name: 'Something else' })

    fireEvent.keyDown(other, { key: 'Enter', keyCode: 229 })
    expect(answer).not.toHaveBeenCalled()

    fireEvent.keyDown(other, { key: 'Enter', keyCode: 13 })
    expect(answer).toHaveBeenCalledTimes(1)
  })

  it('跳过 on every question skips the questions', async () => {
    vi.mocked(answer).mockClear()
    const user = userEvent.setup()
    render(<QuestionsCard projectId='p1' part={card()} status='waiting' />)

    await user.click(screen.getByRole('button', { name: 'Skip this one' }))
    expect(answer).not.toHaveBeenCalled()
    expect(screen.getByText('Which platforms?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip this one' }))

    expect(answer).toHaveBeenCalledWith('p1', 'pt1', 'skip')
  })

  it('跳过 on a later question keeps the answers already given', async () => {
    vi.mocked(answer).mockClear()
    const user = userEvent.setup()
    render(<QuestionsCard projectId='p1' part={card()} status='waiting' />)

    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await screen.findByText('Which platforms?')
    await user.click(screen.getByRole('button', { name: 'Taobao' }))
    await user.click(screen.getByRole('button', { name: 'Skip this one' }))

    expect(answer).toHaveBeenCalledWith('p1', 'pt1', [
      { q: 'Which style?', answer: 'Bold' },
      { q: 'Which platforms?', answer: '' },
    ])
  })

  it('typing under 「其他」 takes the place of a single-choice pick', async () => {
    vi.mocked(answer).mockClear()
    const user = userEvent.setup()
    const one = card()
    one.items = [one.items[0]]
    render(<QuestionsCard projectId='p1' part={one} status='waiting' />)

    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Something else' }),
      'Retro'
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(answer).toHaveBeenCalledWith('p1', 'pt1', [
      { q: 'Which style?', answer: 'Retro' },
    ])
  })

  it('shows the answers as one line once answered, without the form', () => {
    const answered = card({
      answers: [
        { q: 'Which style?', answer: 'Bold' },
        { q: 'Which platforms?', answer: 'Taobao' },
      ],
    })
    render(<QuestionsCard projectId='p1' part={answered} status='done' />)

    expect(screen.getByText('Your answers: Bold · Taobao')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })
})
