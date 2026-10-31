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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import z from 'zod'

import { Main } from '@/components/layout'
import { useSplitSiteBar } from '@/components/site-bar/store'
import { BearChat } from '@/features/bear-chat'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { useBearChatStore } from '@/stores/bear-chat-store'

export const Route = createFileRoute('/_authenticated/playground/')({
  validateSearch: z.object({
    model: z.string().optional().catch(undefined),
  }),
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PlaygroundPage,
})

function PlaygroundPage() {
  const { model } = Route.useSearch()
  const navigate = Route.useNavigate()
  useSplitSiteBar()

  // 「在聊天里试试」 on the model square: pick that model once, then tidy the URL
  useEffect(() => {
    if (!model) return
    useBearChatStore.getState().setSettings({ model })
    void navigate({ search: {}, replace: true })
  }, [model, navigate])

  return (
    <Main className='p-0'>
      <BearChat />
    </Main>
  )
}
