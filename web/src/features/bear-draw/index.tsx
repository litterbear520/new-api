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
import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { useAuthStore } from '@/stores/auth-store'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { DialogHost } from './components/dialogs/dialog-bus'
import { HomeView } from './components/home/home-view'
import { loadLibraryView, loadProjectView } from './components/lazy-views'
import { useBearDrawAlerts } from './hooks/use-alerts'
import {
  type BearDrawEnv,
  useBearDrawEnv,
  useDrawTokenSync,
} from './hooks/use-env'
import { useBearDrawPersistence } from './hooks/use-persistence'
import { useRailRestore } from './hooks/use-rail-restore'
import { setAgentModels, setBalanceSource } from './lib/agent/run'
import { setPicturesEnv } from './lib/pictures'

import './css/base.css'
import './css/home.css'
import './css/gallery.css'
import './css/library.css'
import './css/dialogs.css'
import './css/composer.css'

/*
 * 画图: the drawing page as a design agent. One route, three views picked
 * by the search params: the home page (?), the skills library
 * (?view=skills) and a project (?p=<id>).
 */

export type BearDrawSearch = {
  p?: string
  view?: 'skills'
  tab?: string
  skill?: string
}

const ProjectView = lazy(() =>
  loadProjectView().then((m) => ({ default: m.ProjectView }))
)
const LibraryView = lazy(() =>
  loadLibraryView().then((m) => ({ default: m.LibraryView }))
)

let balance: number | null = null
setBalanceSource(() => balance)

/** Hands the models, prices and balance to the engine (which runs outside React). */
function useEngineEnv(env: BearDrawEnv) {
  balance = env.balanceUsd
  useEffect(() => {
    if (env.uid == null) return
    setPicturesEnv({
      uid: env.uid,
      imageModels: env.imageModels.map((m) => m.id),
      prices: env.prices,
      groupRatio: env.groupRatio,
    })
  }, [env.uid, env.imageModels, env.prices, env.groupRatio])
  useEffect(() => {
    setAgentModels(env.brainModels.map((m) => m.id))
  }, [env.brainModels])
}

export function BearDraw(props: { search: BearDrawSearch }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.auth.user)
  const load = useBearDrawPersistence(user?.id)
  const env = useBearDrawEnv()
  useEngineEnv(env)
  useDrawTokenSync(env)
  const projectId = props.search.p ?? null
  useBearDrawAlerts(projectId)
  const exists = useBearDrawStore((s) =>
    projectId ? s.projects.some((p) => p.id === projectId) : false
  )
  useRailRestore(Boolean(projectId && exists))

  // A project that is gone (deleted, other browser): back to the home page.
  useEffect(() => {
    if (load === 'ready' && projectId && !exists) {
      void navigate({ to: '/draw', search: {}, replace: true })
    }
  }, [load, projectId, exists, navigate])

  let view: ReactNode
  if (load === 'loading') {
    view = <LoadingState className='bd-loading' />
  } else if (!env.loading && !env.imageModels.length) {
    view = (
      <EmptyState
        title={t('No drawing models are available to your account')}
        description={t(
          'Ask the site admin to open an image model for your group.'
        )}
      />
    )
  } else if (projectId && exists) {
    view = <ProjectView key={projectId} projectId={projectId} />
  } else if (props.search.view === 'skills') {
    view = <LibraryView tab={props.search.tab} skillId={props.search.skill} />
  } else {
    view = <HomeView />
  }

  return (
    <div className='bd'>
      <Suspense fallback={<LoadingState className='bd-loading' />}>
        {view}
      </Suspense>
      <DialogHost />
    </div>
  )
}
