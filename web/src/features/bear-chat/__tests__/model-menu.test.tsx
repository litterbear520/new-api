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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ModelMenu } from '../components/model-menu'

function renderMenu(model: string) {
  render(
    <ModelMenu
      models={[]}
      groups={[]}
      model={model}
      group='default'
      onModel={() => undefined}
      onGroup={() => undefined}
    />
  )
}

describe('composer model chip', () => {
  test('its name holds the model shown on it', () => {
    renderMenu('gpt-5.4-mini')
    expect(
      screen.getByRole('button', { name: /gpt-5\.4-mini/ })
    ).toBeInTheDocument()
  })

  test('with no model it is named by its visible prompt', () => {
    renderMenu('')
    expect(
      screen.getByRole('button', { name: 'Choose a model' })
    ).toBeInTheDocument()
  })
})
