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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  act,
  getDefaultNormalizer,
  render,
  screen,
} from '@testing-library/react'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { expect, it } from 'vitest'

import { usageLogSchema } from '../../data/schema'
import { useCommonLogsColumns } from '../columns/common-logs-columns'
import { UsageLogsMobileList } from '../usage-logs-mobile-card'
import { UsageLogsProvider } from '../usage-logs-provider'

const LANGUAGES = ['en', 'zhCN', 'zhTW', 'fr', 'ru', 'ja', 'vi'] as const
// French and Russian group digits with (narrow) no-break spaces; keep them.
const exactText = {
  normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
}

const log = usageLogSchema.parse({
  id: 1,
  user_id: 2,
  created_at: 1788840000,
  type: 2,
  content: '',
  model_name: 'gpt-5.5',
  quota: 5000,
  prompt_tokens: 1234567,
  completion_tokens: 7654321,
})

async function createI18n(language: string): Promise<I18n> {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: Object.fromEntries(
      LANGUAGES.map((code) => [code, { translation: {} }])
    ),
    interpolation: { escapeValue: false },
  })
  return i18n
}

function InputTokensCell() {
  const table = useReactTable({
    data: [log],
    columns: useCommonLogsColumns(false, false),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'prompt_tokens')
  if (!cell) throw new Error('The common logs must have an input column')
  return flexRender(cell.column.columnDef.cell, cell.getContext())
}

function PhoneCard() {
  const table = useReactTable({
    data: [log],
    columns: useCommonLogsColumns(false, false),
    getCoreRowModel: getCoreRowModel(),
  })
  return <UsageLogsMobileList table={table} logCategory='common' />
}

function renderIn(i18n: I18n, node: React.ReactNode) {
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <UsageLogsProvider>{node}</UsageLogsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

it.each([
  { language: 'en', text: '1,234,567' },
  { language: 'zhCN', text: '1,234,567' },
  { language: 'zhTW', text: '1,234,567' },
  { language: 'ja', text: '1,234,567' },
  { language: 'fr', text: '1\u202f234\u202f567' },
  { language: 'ru', text: '1\u00a0234\u00a0567' },
  { language: 'vi', text: '1.234.567' },
])(
  'groups the input tokens of a table row the $language way',
  async (props) => {
    renderIn(await createI18n(props.language), <InputTokensCell />)

    expect(screen.getByText(props.text, exactText)).toBeVisible()
  }
)

it('regroups the table tokens when the interface language changes', async () => {
  const i18n = await createI18n('en')
  renderIn(i18n, <InputTokensCell />)
  expect(screen.getByText('1,234,567')).toBeVisible()

  await act(() => i18n.changeLanguage('fr'))

  expect(screen.getByText('1\u202f234\u202f567', exactText)).toBeVisible()
})

it('groups the tokens of a phone card the interface-language way', async () => {
  renderIn(await createI18n('fr'), <PhoneCard />)

  expect(screen.getByText('1\u202f234\u202f567', exactText)).toBeVisible()
  expect(screen.getByText('7\u202f654\u202f321', exactText)).toBeVisible()
})
