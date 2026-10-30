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

import { classifyError } from '../errors'

describe('classifyError', () => {
  test.each([
    [
      {
        message: '当前分组 default 下对于模型 gpt-5.5 无可用渠道',
        code: 'model_not_found',
        status: 503,
      },
      'model',
    ],
    [
      { message: '用户额度不足', code: 'insufficient_user_quota', status: 403 },
      'balance',
    ],
    [{ message: 'Session expired!' }, 'login'],
    [{ message: 'Too Many Requests', status: 429 }, 'busy'],
    [
      {
        message: "This model's maximum context length is 128000 tokens",
        code: 'context_length_exceeded',
        status: 400,
      },
      'long',
    ],
    [{ message: 'Failed to fetch', code: 'network' }, 'network'],
    [{ message: 'upstream error: bad gateway', status: 502 }, 'upstream'],
  ])('%o is shown as %s', (err, kind) => {
    expect(classifyError(err).kind).toBe(kind)
  })
})
