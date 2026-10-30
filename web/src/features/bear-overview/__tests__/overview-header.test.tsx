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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, expect, test } from 'vitest'

import { OverviewHeader } from '../components/overview-header'
import type { UsageSummary } from '../lib/usage'

const DOLLAR = 500000

const SUMMARY: UsageSummary = {
  days: [],
  todayQuota: 0,
  perDayQuota: DOLLAR,
  monthQuota: 0,
  monthEndQuota: 0,
  change: 0.2,
  topModel: { name: 'gpt-6.1-sol', share: 0.8 },
  hourShape: [],
  families: [],
}

afterEach(async () => {
  await i18next.changeLanguage('en')
})

async function renderHeader(props: {
  kind: 'new' | 'active'
  summary: UsageSummary | null
}) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <OverviewHeader
          name='Bear'
          kind={props.kind}
          credit={5 * DOLLAR}
          balance={5 * DOLLAR}
          runwayDays={null}
          summary={props.summary}
          access={null}
        />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return screen.findByRole('heading', { name: 'Overview' })
}

function lead(): string {
  return document.querySelector('.bo-lead')?.textContent ?? ''
}

test('an English greeting ends in a full stop and a space before the next sentence', async () => {
  await renderHeader({ kind: 'new', summary: null })

  expect(lead()).toMatch(/, Bear\. Your \$5 free credit is here\.$/)
})

test('English sentences of the lead are separated by a space', async () => {
  await renderHeader({ kind: 'active', summary: SUMMARY })

  expect(lead()).toMatch(
    /, Bear\. You spent 20% more in the last 7 days than in the 7 days before\. Most of it went to gpt-6\.1-sol\.$/
  )
})

test('sentences whose translation ends in a full-width stop follow each other without a space', async () => {
  i18next.addResourceBundle('zh', 'translation', {
    '{{greeting}}, {{name}}.': '{{greeting}}，{{name}}。',
    'You spent {{percent}} more in the last 7 days than in the 7 days before.':
      '近 7 天比前 7 天多花了 {{percent}}。',
    'Most of it went to <m>{{model}}</m>.': '大部分花在 <m>{{model}}</m>。',
  })
  await i18next.changeLanguage('zh')

  await renderHeader({ kind: 'active', summary: SUMMARY })

  expect(lead()).toMatch(
    /，Bear。近 7 天比前 7 天多花了 20%。大部分花在 gpt-6\.1-sol。$/
  )
})
