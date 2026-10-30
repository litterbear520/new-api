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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountQuotaCard } from '../components/account-quota-card'
import type { AccountQuota, ResetResult } from '../lib/account-quota'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const NOW = new Date(2026, 9, 26, 12, 0).getTime()
const S = Math.floor(NOW / 1000)

function quota(over: Partial<AccountQuota> = {}): AccountQuota {
  return {
    group: 'team_a',
    plan: 'plus',
    windows: [
      { id: 'five_hour', left: 34, resetAt: S + 3600 },
      { id: 'weekly', left: 65, resetAt: S + 6 * 86400 },
    ],
    fetchedAt: S - 120,
    nextRefreshAt: S - 1,
    resets: null,
    stale: false,
    error: false,
    ...over,
  }
}

function renderCard(
  q: AccountQuota,
  onRefresh = vi.fn(),
  onReset?: (id: string) => Promise<ResetResult>
) {
  render(
    <AccountQuotaCard
      quota={q}
      refreshing={false}
      onRefresh={onRefresh}
      onReset={onReset}
      now={NOW}
    />
  )
  return onRefresh
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountQuotaCard', () => {
  it('shows what is left in each window, with the plan and group', async () => {
    const onRefresh = renderCard(quota())
    expect(screen.getByText('Dedicated account quota')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT Plus')).toBeInTheDocument()
    expect(
      screen.getByText('Keys in the team_a group use only this account')
    ).toBeInTheDocument()
    expect(screen.getByText('5-hour limit')).toBeInTheDocument()
    expect(screen.getByText('34% left')).toBeInTheDocument()
    expect(screen.getByText('65% left')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: '5-hour limit' })).toHaveAttribute(
      'aria-valuenow',
      '34'
    )
    expect(screen.getByText(/^Resets Today/)).toBeInTheDocument()
    expect(screen.queryByText(/Numbers may have changed/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('warns when almost used up and explains a used-up window', () => {
    renderCard(
      quota({
        windows: [
          { id: 'five_hour', left: 0, resetAt: S + 3600 },
          { id: 'weekly', left: 8, resetAt: S + 86400 },
        ],
      })
    )
    expect(screen.getByText('Used up')).toBeInTheDocument()
    expect(screen.getByText(/^Back Today/)).toBeInTheDocument()
    expect(screen.getByText(/^Almost used up · Resets/)).toBeInTheDocument()
    expect(
      screen.getByText(/keys in the team_a group return errors/)
    ).toBeInTheDocument()
  })

  it('holds the refresh button until the next read is allowed and says why in visible text', () => {
    renderCard(quota({ nextRefreshAt: S + 200 }))
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button).toBeDisabled()
    // A title alone never shows on touch screens
    expect(
      screen.getByText('Refreshes at most once every 5 minutes')
    ).toBeVisible()
    expect(button).toHaveAccessibleDescription(
      'Refreshes at most once every 5 minutes'
    )
  })

  it('drops the wait reason once a refresh is allowed again', () => {
    renderCard(quota({ nextRefreshAt: S - 1 }))
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    expect(
      screen.queryByText('Refreshes at most once every 5 minutes')
    ).not.toBeInTheDocument()
  })

  it('marks only the first manual reset amber when several expire within 3 days', () => {
    renderCard(
      quota({
        resets: {
          available: 2,
          usable: 2,
          expiresAt: [S + 86400 + 600, S + 2 * 86400 + 600],
        },
      })
    )
    expect(screen.getByText(/ · in 1 day$/)).toHaveClass('bo-qx-soon')
    expect(screen.getByText(/ · in 2 days$/)).not.toHaveClass('bo-qx-soon')
  })

  it('marks old numbers and an empty read', () => {
    renderCard(quota({ stale: true }))
    expect(screen.getByText(/Numbers may have changed/)).toBeInTheDocument()
    cleanup()
    renderCard(quota({ windows: [], error: true, fetchedAt: null }))
    expect(
      screen.getByText("Can't read the quota right now.")
    ).toBeInTheDocument()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('colours each window green, amber or red by what is left', () => {
    renderCard(
      quota({
        windows: [
          { id: 'five_hour', left: 70, resetAt: S + 3600 },
          { id: 'weekly', left: 30, resetAt: S + 86400 },
          { id: 'monthly', left: 29.4, resetAt: null },
        ],
      })
    )
    const [five, week, month] = screen.getAllByRole('meter')
    expect(five).toHaveClass('bo-qx-good')
    expect(week).toHaveClass('bo-warn')
    expect(month).toHaveClass('bo-qx-bad')
    expect(screen.getByText('70% left')).toHaveClass('bo-qx-good-t')
    expect(screen.getByText('30% left')).toHaveClass('bo-qx-warn-t')
    expect(screen.getByText('29% left')).toHaveClass('bo-qx-bad-t')
  })

  it('lists when each manual reset expires and warns when OpenAI says a reset would change nothing', async () => {
    const onReset = vi.fn()
    renderCard(
      quota({
        resets: {
          available: 2,
          usable: 0,
          expiresAt: [S + 2 * 86400 + 3600, S + 10 * 86400 + 600],
        },
      }),
      vi.fn(),
      onReset
    )
    expect(screen.getByText(/^Manual reset expiry \(GMT/)).toBeInTheDocument()
    expect(screen.getByText('Reset 1')).toBeInTheDocument()
    const first = screen.getByText(/ · in 2 days$/)
    expect(first).toHaveClass('bo-qx-soon')
    expect(screen.getByText(/ · in 10 days$/)).not.toHaveClass('bo-qx-soon')
    // A reset left is enough; the upstream decides whether it helps.
    await userEvent.click(screen.getByRole('button', { name: 'Reset quota' }))
    expect(
      screen.getByText(
        'There is still quota left, so a reset may change nothing.'
      )
    ).toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('shows neither the box nor the button without resets, and no button without an onReset', () => {
    renderCard(
      quota({ resets: { available: 0, usable: 0, expiresAt: [] } }),
      vi.fn(),
      vi.fn()
    )
    expect(screen.queryByText(/Manual reset expiry/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset quota' })).toBeNull()
    cleanup()
    renderCard(quota({ resets: { available: 1, usable: 1, expiresAt: [] } }))
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset quota' })).toBeNull()
  })

  it('spends a reset only after the confirmation', async () => {
    const onReset = vi.fn(async (_id: string): Promise<ResetResult> => 'reset')
    renderCard(
      quota({
        resets: { available: 1, usable: 1, expiresAt: [S + 20 * 86400] },
      }),
      vi.fn(),
      onReset
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reset quota' }))
    expect(screen.getByText('Reset quota?')).toBeInTheDocument()
    expect(screen.queryByText(/expires first is used/)).toBeNull()
    expect(screen.queryByText(/may change nothing/)).toBeNull()
    expect(onReset).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Reset now' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(onReset.mock.calls[0][0]).toMatch(UUID)
    expect(toast.success).toHaveBeenCalledWith(
      'Quota reset. Both limits are full again.'
    )
    expect(screen.queryByText('Reset quota?')).toBeNull()
  })

  it('keeps the request id for a retry when the outcome is unknown', async () => {
    const results: ResetResult[] = ['unknown', 'not_needed']
    const onReset = vi.fn(
      async (_id: string): Promise<ResetResult> => results.shift() ?? 'unknown'
    )
    renderCard(
      quota({
        resets: { available: 2, usable: 2, expiresAt: [S + 86400] },
      }),
      vi.fn(),
      onReset
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reset quota' }))
    expect(screen.getByText(/expires first is used/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reset now' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't confirm the reset."
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onReset).toHaveBeenCalledTimes(2)
    expect(onReset.mock.calls[1][0]).toBe(onReset.mock.calls[0][0])
    expect(toast.error).toHaveBeenCalledWith(
      'OpenAI says no reset is needed right now.'
    )
    expect(screen.queryByText('Reset quota?')).toBeNull()
  })
})
