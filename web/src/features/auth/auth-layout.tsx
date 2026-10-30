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
import nightSea from '@/assets/auth/night-sea.jpg'
import { useDarkSiteBar } from '@/components/site-bar/store'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
  /** Pinned to the bottom of the page, e.g. the legal notice */
  footer?: React.ReactNode
}

/**
 * Shared shell for every auth page: the home page's night-sea sky behind a
 * centered column. Always dark, whatever the console theme; the `dark` class
 * is scoped to this subtree, so the user's saved theme is left untouched;
 * the site bar above it wears its dark glass too.
 */
export function AuthLayout(props: AuthLayoutProps) {
  const { logo, loading } = useSystemConfig()
  useDarkSiteBar()

  return (
    <div className='auth-cosmos dark bg-background text-foreground relative min-h-svh'>
      <div aria-hidden='true' className='fixed inset-0 overflow-hidden'>
        <img
          src={nightSea}
          alt=''
          decoding='async'
          className='h-[70vh] w-full object-cover object-[58%_0] sm:h-full sm:object-[62%_0]'
        />
        <div className='auth-cosmos-veil absolute inset-0' />
      </div>

      <div className='relative flex min-h-svh flex-col items-center px-4 pt-(--app-header-height) pb-5'>
        <main className='flex w-full max-w-[360px] flex-1 flex-col items-center pt-[22vh] pb-9 sm:justify-center sm:py-9'>
          {loading ? (
            <Skeleton className='mb-5 size-14 rounded-xl sm:size-16' />
          ) : (
            <img
              src={logo}
              alt=''
              className='auth-cosmos-mark mb-5 size-14 object-contain sm:size-16'
            />
          )}
          {props.children}
        </main>

        {props.footer && (
          <footer className='w-full max-w-[360px]'>{props.footer}</footer>
        )}
      </div>
    </div>
  )
}
