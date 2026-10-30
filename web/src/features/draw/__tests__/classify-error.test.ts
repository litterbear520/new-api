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
import { describe, expect, test } from 'vitest'

import { classifyError } from '../api'

describe('classifyError', () => {
  test('a token that hit its quota limit is a token problem', () => {
    expect(
      classifyError(
        403,
        'token quota is not enough, token remain quota: $0.01, need quota: $0.05',
        'pre_consume_token_quota_failed'
      )
    ).toBe('auth')
    expect(classifyError(401, '无效的令牌')).toBe('auth')
  })

  test('a low account balance is a balance problem', () => {
    expect(
      classifyError(
        403,
        '用户额度不足, 剩余额度: $0.01',
        'insufficient_user_quota'
      )
    ).toBe('balance')
  })
})
