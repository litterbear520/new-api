import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { apiKeySchema, type ApiKey } from '../../types'
import { ApiKeyNotes } from '../api-key-notes'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const base = apiKeySchema.parse({
  id: 1,
  name: 'demo',
  key: 'demo********1234',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 0,
  accessed_time: 0,
  group: 'default',
  model_limits_enabled: false,
})

function renderNotes(overrides: Partial<ApiKey>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ApiKeyNotes apiKey={{ ...base, ...overrides }} />
    </I18nextProvider>
  )
}

describe('API key note line', () => {
  it('counts one model limit without a plural-only wording', () => {
    const { container } = renderNotes({
      model_limits_enabled: true,
      model_limits: 'model-alpha',
    })
    expect(container).toHaveTextContent('Models: 1')
    expect(container).not.toHaveTextContent('1 models')
  })

  it('shows an Auto key as cross-group with its Auto ratio instead of the raw group name', () => {
    const { container } = renderNotes({
      group: 'auto',
      cross_group_retry: true,
    })
    expect(container).toHaveTextContent('Cross-group · Auto')
    expect(container).not.toHaveTextContent(/\bauto\b/)
    expect(screen.getByText('Cross-group')).toHaveClass('text-info')
  })

  it('keeps a plain group name with the other notes', () => {
    const { container } = renderNotes({
      group: 'team-a',
      model_limits_enabled: true,
      model_limits: 'model-alpha,model-beta',
      allow_ips: '192.0.2.1',
    })
    expect(container).toHaveTextContent('team-a · Models: 2 · IP Restriction')
  })
})
