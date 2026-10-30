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
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import { useSiteBarStore } from '@/components/site-bar/store'
import { dropHeroShell } from '@/features/home/night-sea/hero-shell'
import { bootstrapAuthentication } from '@/lib/auth-session'
import { installBuildMetadata } from '@/lib/build-metadata'
import '@/lib/dayjs'
import { applyFaviconToDom } from '@/lib/dom-utils'
import { initializeFrontendCache } from '@/lib/frontend-cache'
import { createAppQueryClient } from '@/lib/query-client'
import { readCachedStatus, statusQueryOptions } from '@/lib/status-query'
import { clearRetiredThemePreferences } from '@/lib/theme-storage'

import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { prefetchSetupStatus } from './features/setup/api'
import { i18nReady } from './i18n/config'
// Generated Routes
import { routeTree } from './routeTree.gen'

// Styles
import './styles/index.css'

// Ensure VChart theme is initialized before any chart mounts (prevents white default theme flash)
// VChart theme is driven by our ThemeProvider (html.light/html.dark) via per-chart `theme` prop.
initializeFrontendCache()
clearRetiredThemePreferences()
installBuildMetadata()

const queryClient = createAppQueryClient(() => {
  void router.navigate({ to: '/500' })
})

/**
 * Whether a page sits on the dark night sky (home and the sign-in pages).
 * The page on screen says so itself (useDarkSiteBar); the next one can only
 * be guessed from its route, which misses a home page the admin replaced:
 * then two light pages cross-fade, which does no harm.
 */
function onNightSky(pathname: string) {
  return router
    .matchRoutes(pathname)
    .some(
      (match) => match.routeId === '/' || match.routeId.startsWith('/(auth)')
    )
}

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  // Going between the night sky and the light pages cross-fades the whole
  // screen under the site bar, which stays put (see
  // components/site-bar/site-bar.css); other page changes only fade the page in.
  defaultViewTransition: {
    types: ({ fromLocation, toLocation, pathChanged }) => {
      if (!fromLocation || !pathChanged) return false
      const fromDark = useSiteBarStore.getState().darkPages > 0
      if (fromDark === onNightSky(toLocation.pathname)) {
        return false
      }
      return ['page']
    },
  },
})

// The home page's first screen comes with the HTML (features/home/night-sea/
// hero-shell.ts); any other page takes it away, and so does an error in place
// of the home page (the home page itself does once it shows its own)
router.subscribe('onResolved', ({ toLocation }) => {
  const failed = router.state.matches.some(
    (match) => match.status === 'error' || match.status === 'notFound'
  )
  if (toLocation.pathname !== '/' || failed) dropHeroShell()
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// What the first page waits for (the session and setup checks the root guard
// makes, and the page's own code) starts now, alongside the language file,
// instead of one after the other once React renders. Both checks are shared
// with the guard, so nothing is requested twice.
void bootstrapAuthentication().catch(() => undefined)
prefetchSetupStatus()
try {
  for (const match of router.matchRoutes(router.latestLocation)) {
    const route = router.looseRoutesById[match.routeId]
    if (route) router.loadRouteChunk(route)?.catch(() => undefined)
  }
} catch {
  // the router loads them itself when it renders
}

// Render the app
const rootElement = document.querySelector<HTMLElement>('#root')
if (!rootElement) {
  throw new Error('Root element not found')
}
// Set document.title and favicon from cached status, then refresh from network
;(function initSystemBranding() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const apply = (name: string) => {
      document.title = name
      const metaTitle = document.querySelector(
        'meta[name="title"]'
      ) as HTMLMetaElement | null
      if (metaTitle) metaTitle.setAttribute('content', name)
    }
    // Cache-first
    const cached = readCachedStatus()
    if (cached?.system_name) apply(cached.system_name as string)
    if (cached?.logo) applyFaviconToDom(cached.logo as string)

    // Background refresh through the shared cache. This primes ['status']
    // before React mounts, so the root guard and every status consumer reuse
    // this one request instead of firing their own. `fetchStatus` owns the
    // localStorage write and the system-config store sync.
    queryClient
      .ensureQueryData(statusQueryOptions)
      .then((s) => {
        if (s?.system_name) apply(s.system_name as string)
        if (s?.logo) applyFaviconToDom(s.logo as string)
      })
      .catch(() => {
        /* empty */
      })
  } catch {
    /* empty */
  }
})()
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  // Wait for the interface language's chunk, so the first paint is never English.
  void i18nReady.then(() =>
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FontProvider>
              <DirectionProvider>
                <RouterProvider router={router} />
              </DirectionProvider>
            </FontProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>
    )
  )
}
