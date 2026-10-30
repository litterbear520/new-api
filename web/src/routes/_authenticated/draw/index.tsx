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
import { z } from 'zod'

import { Main } from '@/components/layout'
import { BearDraw } from '@/features/bear-draw'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const drawSearchSchema = z.object({
  // the open project
  p: z.string().optional().catch(undefined),
  // the skills library, its tab and an open skill
  view: z.enum(['skills']).optional().catch(undefined),
  tab: z.string().optional().catch(undefined),
  skill: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/draw/')({
  validateSearch: drawSearchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'draw')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: DrawPage,
})

function DrawPage() {
  const search = Route.useSearch()
  return (
    <Main className='p-0'>
      <BearDraw search={search} />
    </Main>
  )
}
