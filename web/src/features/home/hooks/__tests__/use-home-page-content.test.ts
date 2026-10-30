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
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getHomePageContent } from '../../api'
import { useHomePageContent } from '../use-home-page-content'

vi.mock('../../api', () => ({ getHomePageContent: vi.fn() }))

const fetchContent = vi.mocked(getHomePageContent)

describe('useHomePageContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    fetchContent.mockReset()
  })

  test('shows the default home page at once when nothing is cached', async () => {
    fetchContent.mockResolvedValue({ success: true, data: '' })
    const { result } = renderHook(() => useHomePageContent())

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.content).toBe('')
    await waitFor(() => expect(fetchContent).toHaveBeenCalledOnce())
  })

  test('swaps in custom content that arrives after the first render', async () => {
    fetchContent.mockResolvedValue({ success: true, data: '# Hello' })
    const { result } = renderHook(() => useHomePageContent())

    await waitFor(() => expect(result.current.content).toBe('# Hello'))
    expect(localStorage.getItem('home_page_content')).toBe('# Hello')
  })

  test('waits for the server when custom content is cached', async () => {
    localStorage.setItem('home_page_content', '# Cached')
    fetchContent.mockResolvedValue({ success: true, data: '# Fresh' })
    const { result } = renderHook(() => useHomePageContent())

    expect(result.current.isLoaded).toBe(false)
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.content).toBe('# Fresh')
  })

  test('still loads the content when the browser blocks site storage', async () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.stubGlobal('localStorage', {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    })
    fetchContent.mockResolvedValue({ success: true, data: '# Hello' })
    const { result } = renderHook(() => useHomePageContent())

    expect(result.current.isLoaded).toBe(true)
    await waitFor(() => expect(result.current.content).toBe('# Hello'))
  })
})
