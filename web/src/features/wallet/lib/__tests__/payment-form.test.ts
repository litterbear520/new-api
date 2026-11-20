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
import { afterEach, expect, test, vi } from 'vitest'

import { submitPaymentForm } from '../payment'

afterEach(() => vi.restoreAllMocks())

test('the cashier opens in the same tab, whatever the browser', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
  )
  const submit = vi
    .spyOn(HTMLFormElement.prototype, 'submit')
    .mockImplementation(() => undefined)
  submitPaymentForm('https://pay.example/submit', { out_trade_no: 'T1' })
  expect(submit).toHaveBeenCalledTimes(1)
  const form = submit.mock.contexts[0] as HTMLFormElement
  expect(form.target).toBe('')
  expect(form.action).toBe('https://pay.example/submit')
  expect(new FormData(form).get('out_trade_no')).toBe('T1')
})
